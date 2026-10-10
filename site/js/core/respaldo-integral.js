import { exportarCartera, restaurarCartera, validarCartera } from './store.js';
import { listarDocumentos, obtenerDocumento, guardarDocumentos, eliminarDocumento } from './documentos.js';

const MAX_DOC_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const ITERATIONS = 600000;
const encoder = new TextEncoder();
function base64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function bytes(value, limit) {
  if (typeof value !== 'string' || value.length > Math.ceil(limit * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error('Contenido cifrado inválido.');
  const decoded = atob(value);
  if (decoded.length > limit) throw new Error('El respaldo supera los límites permitidos.');
  return Uint8Array.from(decoded, (c) => c.charCodeAt(0));
}
async function key(password, salt, usage) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Usa una contraseña de respaldo de al menos 12 caracteres.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

/** Encrypted complete backup; credentials/configuration are never part of the payload. */
export async function exportarIntegral(password, { clienteId = null } = {}) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Usa una contraseña de respaldo de al menos 12 caracteres.');
  const snapshot = exportarCartera();
  const cartera = JSON.parse(snapshot);
  if (clienteId !== null) {
    if (typeof clienteId !== 'string') throw new Error('Cliente inválido.');
    cartera.clientes = cartera.clientes.filter((c) => c.id === clienteId);
    if (cartera.clientes.length !== 1) throw new Error('El cliente ya no está disponible.');
  }
  const documentos = [];
  let total = 0;
  for (const cliente of cartera.clientes) {
    for (const meta of await listarDocumentos(cliente.id)) {
      const doc = await obtenerDocumento(meta.id);
      if (!doc?.blob) throw new Error('Falta un documento original. No se generó un respaldo incompleto.');
      total += doc.blob.size;
      if (total > MAX_DOC_BYTES || documentos.length >= 1000) throw new Error('El respaldo supera 50 MB de documentos o 1000 archivos.');
      const data = new Uint8Array(await doc.blob.arrayBuffer());
      const hash = await crypto.subtle.digest('SHA-256', data);
      documentos.push({ clienteId: cliente.id, tipo: doc.tipo, nombre: doc.nombreArchivo, mime: doc.mime,
        sha256: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join(''), base64: base64(data) });
    }
  }
  if (exportarCartera() !== snapshot) throw new Error('La cartera cambió durante el respaldo. Genera el archivo nuevamente.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = encoder.encode(JSON.stringify({ cartera, documentos }));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(password, salt, 'encrypt'), payload);
  return JSON.stringify({ tipo: clienteId === null ? 'prevismart-expedientes-cifrados' : 'prevismart-cliente-cifrado', version: 1, algoritmo: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
    salt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(encrypted)) });
}

async function leerCifrado(json, password, tipo) {
  if (typeof json !== 'string' || encoder.encode(json).length > MAX_FILE_BYTES) throw new Error('Respaldo demasiado grande.');
  let env;
  try { env = JSON.parse(json); } catch { throw new Error('Archivo de respaldo inválido.'); }
  if (env?.tipo !== tipo || env.version !== 1 || env.algoritmo !== 'AES-256-GCM' || env.kdf !== 'PBKDF2-SHA256' || env.iterations !== ITERATIONS) throw new Error('Formato de archivo cifrado no compatible.');
  const salt = bytes(env.salt, 16), iv = bytes(env.iv, 12);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Parámetros de cifrado inválidos.');
  let payload;
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(password, salt, 'decrypt'), bytes(env.ciphertext, MAX_FILE_BYTES));
    payload = JSON.parse(new TextDecoder().decode(decrypted));
  } catch { throw new Error('Contraseña incorrecta o respaldo alterado. No se modificaron datos.'); }
  const validacion = validarCartera(payload?.cartera);
  if (!validacion.ok || !Array.isArray(payload.documentos) || payload.documentos.length > 1000) throw new Error('Expedientes del respaldo inválidos.');
  const clientes = new Map(payload.cartera.clientes.map((c) => [c.id, c.nombre]));
  const entradas = [];
  let total = 0;
  const mimes = new Set(['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'application/octet-stream']);
  for (const doc of payload.documentos) {
    if (!clientes.has(doc?.clienteId) || !mimes.has(doc.mime) || typeof doc.nombre !== 'string') throw new Error('Documento del respaldo inválido.');
    const data = bytes(doc.base64, 25 * 1024 * 1024);
    total += data.length;
    if (total > MAX_DOC_BYTES) throw new Error('Los documentos del respaldo superan 50 MB.');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (b) => b.toString(16).padStart(2, '0')).join('');
    if (hash !== doc.sha256) throw new Error('Documento alterado. No se modificó la cartera.');
    entradas.push({ clienteId: doc.clienteId, clienteNombre: clientes.get(doc.clienteId), tipo: doc.tipo, archivo: new File([data], doc.nombre, { type: doc.mime }) });
  }
  return { payload, entradas, clientes };
}

export async function restaurarIntegral(json, password) {
  const { payload, entradas, clientes } = await leerCifrado(json, password, 'prevismart-expedientes-cifrados');
  return aplicarCifrado(payload, entradas, clientes);
}

/** Import one client without replacing the installation's existing portfolio or client IDs. */
export async function importarClienteCifrado(json, password, { vigente = () => true } = {}) {
  const { payload, entradas, clientes } = await leerCifrado(json, password, 'prevismart-cliente-cifrado');
  if (!vigente()) throw new Error('Apertura cancelada: no se importaron datos.');
  if (payload.cartera.clientes.length !== 1) throw new Error('El archivo debe contener un solo cliente.');
  const snapshot = exportarCartera();
  const actual = JSON.parse(snapshot);
  if (actual.clientes.some((c) => clientes.has(c.id))) throw new Error('Este cliente ya existe en la instalación; no se sobrescribieron datos.');
  payload.cartera = { ...actual, clientes: [...actual.clientes, ...payload.cartera.clientes] };
  return aplicarCifrado(payload, entradas, clientes, snapshot, vigente);
}

async function aplicarCifrado(payload, entradas, clientes, snapshot = null, vigente = () => true) {
  const anteriores = new Set();
  for (const id of clientes.keys()) for (const doc of await listarDocumentos(id)) anteriores.add(doc.id);
  if (!vigente()) throw new Error('Apertura cancelada antes de archivar.');
  const guardados = await guardarDocumentos(entradas, { maxDocumentos: 1000 });
  try {
    if (!vigente()) throw new Error('Apertura cancelada al archivar; no se reemplazó la cartera.');
    if (snapshot !== null && exportarCartera() !== snapshot) throw new Error('La cartera cambió durante la importación; reintenta para no sobrescribir nuevos datos.');
    const result = restaurarCartera(JSON.stringify(payload.cartera));
    if (!result.ok) throw new Error(result.error);
    return { ...result, documentos: guardados.length };
  } catch (error) {
    for (const doc of guardados) if (!anteriores.has(doc.id)) await eliminarDocumento(doc.id);
    throw error;
  }
}
