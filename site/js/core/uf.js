/* PreviSmart · uf.js — valor UF del día.
   Origen: mindicador.cl (API pública JSON). Cadena de respaldo:
   online → último valor cacheado (con fecha) → ingreso manual.
   El estado es global y los módulos se suscriben. */

import { aISO, parseLocal } from './dates.js';

const KEY = 'prevismart.uf.v1';
const API = 'https://mindicador.cl/api/uf';
const TIMEOUT_MS = 6000;

/** @type {{valor:number|null, fecha:string|null, origen:'consultando'|'online'|'guardada'|'manual'|'sin-valor'}} */
let estado = { valor: null, fecha: null, origen: 'sin-valor' };
const oyentes = new Set();
let revision = 0;

function leerCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return Number.isFinite(d?.valor) && d.valor > 0 && parseLocal(d.fecha) ? d : null;
  } catch { return null; }
}

function escribirCache(e) {
  try { localStorage.setItem(KEY, JSON.stringify(e)); } catch { /* sin espacio */ }
}

function emitir() {
  oyentes.forEach((fn) => { try { fn(estado); } catch { /* oyente defectuoso */ } });
}

/** Suscripción a cambios del valor UF. Devuelve función para desuscribir. */
export function onUF(fn) {
  oyentes.add(fn);
  fn(estado);
  return () => oyentes.delete(fn);
}

export function getUF() { return estado; }

/** Inicializa: consulta en línea desde el primer instante; mientras dura
   muestra el último valor conocido como "consultando" (nunca declara
   sin-conexión antes de intentarlo). Si el primer intento falla, reintenta
   una vez: la primera conexión TLS/VPN/antivirus puede ser lenta. */
export async function initUF() {
  const cache = leerCache();
  estado = { valor: cache?.valor ?? null, fecha: cache?.fecha ?? null, origen: 'consultando' };
  emitir();
  if (await refrescarUF()) return estado;
  if (estado.origen === 'manual') return estado;
  estado = { ...estado, origen: 'consultando' };
  emitir();
  await new Promise((r) => setTimeout(r, 2500));
  if (estado.origen === 'manual') return estado;
  await refrescarUF();
  return estado;
}

/** Consulta la API. Actualiza cache y emite. Devuelve true si hubo red. */
export async function refrescarUF() {
  const ticket = ++revision;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(API, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const hoy = data?.serie?.[0];
    if (!Number.isFinite(hoy?.valor) || hoy.valor <= 0 || !parseLocal(hoy?.fecha)) throw new Error('respuesta inválida');
    if (ticket !== revision) return false;
    const stale = resp.headers.get('X-PreviSmart-Cache') === 'stale';
    estado = { valor: hoy.valor, fecha: hoy.fecha.slice(0, 10), origen: stale ? 'guardada' : 'online' };
    escribirCache({ valor: estado.valor, fecha: estado.fecha });
    emitir();
    return !stale;
  } catch {
    if (ticket !== revision) return false;
    const cache = leerCache();
    if (cache) estado = { ...cache, origen: 'guardada' };
    else estado = { valor: null, fecha: null, origen: 'sin-valor' };
    emitir();
    return false;
  } finally { clearTimeout(t); }
}

/** Ingreso manual (persistente). */
export function setUFManual(valor) {
  const v = Number(valor);
  if (!Number.isFinite(v) || v <= 0) return false;
  revision++;
  const fecha = aISO(new Date());
  estado = { valor: v, fecha, origen: 'manual' };
  escribirCache({ valor: v, fecha });
  emitir();
  return true;
}

/** Etiqueta corta del origen para badges. */
export function etiquetaOrigen(e = estado) {
  return { 'consultando': 'consultando…', 'online': 'en línea', 'guardada': 'guardada', 'manual': 'manual', 'sin-valor': 'sin valor' }[e.origen];
}
