/* PreviSmart · respaldo.js — persistencia de la cartera a un archivo real.
   Elige una carpeta una vez y la app escribe `prevismart-cartera.json`
   en ella automáticamente tras cada cambio (debounce 800ms).

   API: File System Access (showDirectoryPicker) — disponible en Chrome,
   Edge, Chromium y el lanzador .exe. El handle de la carpeta se conserva
   en IndexedDB para no pedirla de nuevo en cada sesión; el permiso puede
   pedirse otra vez (regla del navegador) con un clic en "Reconectar".

   localStorage sigue siendo la capa rápida: el archivo es la copia
   durable que puedes mover entre equipos o guardar en una nube local. */

import { subscribe, exportarCartera, restaurarCartera } from './store.js';

const IDB_DB = 'prevismart.fs';
const IDB_STORE = 'handles';
const IDB_KEY = 'carpetaRespaldo';
export const ARCHIVO_RESPALDO = 'prevismart-cartera.json';
export const respaldoSoportado = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

let dirHandle = null;
let ultimoGuardado = null;
let ultimoError = null;
const oyentes = new Set();
let timer = null;
let wired = false;
let generacion = 0;
let escrituras = Promise.resolve();
let protegerArchivo = false;

/* ---- IndexedDB mínimo para conservar el handle de la carpeta ---- */
function abrirIDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(clave) {
  const db = await abrirIDB();
  return new Promise((res, rej) => {
    const t = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(clave);
    t.onsuccess = () => { db.close(); res(t.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
}
async function idbSet(clave, valor) {
  const db = await abrirIDB();
  return new Promise((res, rej) => {
    const t = db.transaction(IDB_STORE, 'readwrite');
    t.objectStore(IDB_STORE).put(valor, clave);
    t.oncomplete = () => { db.close(); res(); };
    t.onerror = t.onabort = () => { db.close(); rej(t.error); };
  });
}

/* ---- estado público para la UI ---- */
export function estadoRespaldo() {
  return {
    soportado: respaldoSoportado,
    configurado: Boolean(dirHandle),
    carpeta: dirHandle?.name || null,
    ultimoGuardado,
    ultimoError,
    requiereConfirmacion: protegerArchivo
  };
}
function emitir() { oyentes.forEach((fn) => { try { fn(estadoRespaldo()); } catch { /* oyente defectuoso */ } }); }
export function onRespaldo(fn) { oyentes.add(fn); fn(estadoRespaldo()); return () => oyentes.delete(fn); }

/* ---- init: recupera el handle y suscribe el autoguardado ---- */
export async function initRespaldo() {
  if (!respaldoSoportado || wired) return;
  wired = true;
  try {
    const registro = await idbGet(IDB_KEY);
    dirHandle = registro?.handle || registro || null;
    protegerArchivo = Boolean(registro?.requiereConfirmacion);
    if (protegerArchivo) ultimoError = 'respaldo existente: restaura o confirma antes de sobrescribir';
  } catch { dirHandle = null; }
  emitir();
  subscribe(() => {
    if (!dirHandle || protegerArchivo) return;
    clearTimeout(timer);
    timer = setTimeout(respaldarAhora, 800);
  });
}

async function tienePermiso(handle) {
  if (!handle) return false;
  try { return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'; }
  catch { return false; }
}

/** Elige la carpeta de respaldo. Requiere gesto del usuario. */
export async function elegirCarpetaRespaldo() {
  if (!respaldoSoportado) return { ok: false, error: 'tu navegador no soporta guardado a archivo' };
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    generacion++;
    ultimoGuardado = null;
    ultimoError = null;
    protegerArchivo = true;
    await idbSet(IDB_KEY, { handle: dirHandle, requiereConfirmacion: true });
    try {
      await dirHandle.getFileHandle(ARCHIVO_RESPALDO);
      protegerArchivo = true;
      ultimoError = 'respaldo existente: restaura o confirma antes de sobrescribir';
      emitir();
      return { ok: true, carpeta: dirHandle.name };
    } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
      protegerArchivo = false;
      await idbSet(IDB_KEY, { handle: dirHandle, requiereConfirmacion: false });
    }
    emitir();
    const ok = await respaldarAhora();
    return { ok, carpeta: dirHandle.name };
  } catch (e) {
    return { ok: false, error: e?.name === 'AbortError' ? 'elección cancelada' : String(e?.message || e) };
  }
}

/** Re-pide el permiso sobre la carpeta ya elegida (gesto del usuario). */
export async function reconectarCarpeta() {
  if (!dirHandle) return elegirCarpetaRespaldo();
  try {
    const handle = dirHandle;
    const p = await handle.requestPermission({ mode: 'readwrite' });
    const ok = p === 'granted' && await respaldarAhora();
    return { ok, carpeta: handle.name };
  } catch (error) { return { ok: false, error: String(error?.message || error) }; }
}

/** Stop automatic backups and forget the handle; never delete exported files. */
export async function olvidarCarpetaRespaldo() {
  clearTimeout(timer);
  generacion++;
  dirHandle = null;
  protegerArchivo = false;
  await escrituras;
  await idbSet(IDB_KEY, null);
  emitir();
}

/** Escribe la cartera completa en el archivo. Se llama solo (debounce) o manual. */
export function respaldarAhora() {
  if (protegerArchivo) return Promise.resolve(false);
  const handle = dirHandle;
  const ticket = generacion;
  const contenido = exportarCartera();
  const tarea = escrituras.then(() => escribir(handle, ticket, contenido));
  escrituras = tarea.catch(() => false);
  return tarea;
}

/** Called only after explicit confirmation in the UI. */
export async function permitirSobrescrituraRespaldo() {
  await idbSet(IDB_KEY, { handle: dirHandle, requiereConfirmacion: false });
  protegerArchivo = false;
  ultimoError = null;
  emitir();
}

async function escribir(handle, ticket, contenido) {
  if (!handle || ticket !== generacion) return false;
  if (!(await tienePermiso(handle))) { ultimoError = 'permiso pendiente — reconecta la carpeta'; emitir(); return false; }
  let w;
  try {
    if (ticket !== generacion) return false;
    const fh = await handle.getFileHandle(ARCHIVO_RESPALDO, { create: true });
    w = await fh.createWritable();
    if (ticket !== generacion) { await w.abort(); return false; }
    await w.write(contenido);
    if (ticket !== generacion) { await w.abort(); return false; }
    await w.close();
    ultimoGuardado = new Date().toISOString();
    ultimoError = null;
    emitir();
    return true;
  } catch (e) {
    await w?.abort?.().catch(() => {});
    if (ticket !== generacion) return false;
    ultimoError = String(e?.message || e);
    emitir();
    return false;
  }
}

/** Lee el archivo de la carpeta e importa su contenido (gesto del usuario). */
export async function restaurarDesdeCarpeta() {
  if (!dirHandle) return { ok: false, error: 'elige primero la carpeta de respaldo' };
  try {
    const handle = dirHandle;
    const p = await handle.requestPermission({ mode: 'read' });
    if (p !== 'granted') return { ok: false, error: 'permiso denegado' };
    clearTimeout(timer);
    await escrituras;
    const fh = await handle.getFileHandle(ARCHIVO_RESPALDO);
    const archivo = await fh.getFile();
    const resultado = restaurarCartera(await archivo.text());
    if (resultado.ok) await permitirSobrescrituraRespaldo();
    return resultado;
  } catch (error) {
    return { ok: false, error: error?.name === 'NotFoundError' ? `no existe ${ARCHIVO_RESPALDO} en la carpeta elegida` : String(error?.message || error) };
  }
}
