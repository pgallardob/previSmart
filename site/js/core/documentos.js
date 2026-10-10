/* PreviSmart · documentos.js — custodia de documentos oficiales
   (presiso.md: carga del Certificado de Saldo y del Certificado de
   Ofertas SCOMP como respaldo legal de los datos ante la aseguradora).
    Los archivos viven en IndexedDB (bytes), nunca en localStorage:
   el expediente del cliente (store.js) queda liviano y los PDFs
   originales quedan preservados por cliente. */

import { exigirEdicion } from './store.js';
const DB_NOMBRE = 'prevismart-docs';
const DB_VERSION = 1;
const STORE = 'documentos';

const TIPOS = ['certificado-saldo', 'certificado-ofertas', 'certificado-afiliacion',
  'certificado-cotizaciones', 'cartola-resumen', 'otro'];

let dbPromise = null;

function abrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('clienteId', 'clienteId', { unique: false });
      }
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => { req.result.close(); dbPromise = null; };
      resolve(req.result);
    };
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function tx(modo) {
  return abrir().then((db) => db.transaction(STORE, modo).objectStore(STORE));
}

function promesa(req) {
  return new Promise((resolve, reject) => {
    // Request success is not durability: a write can still abort before commit.
    req.transaction.oncomplete = () => resolve(req.result);
    req.transaction.onabort = () => reject(req.transaction.error || new Error('transacción cancelada'));
    req.onerror = () => reject(req.error);
  });
}

/** Guarda un archivo asociado a un cliente. Devuelve el registro creado. */
export async function guardarDocumento({ clienteId, clienteNombre, tipo, archivo }) {
  return (await guardarDocumentos([{ clienteId, clienteNombre, tipo, archivo }]))[0];
}

export async function validarPDF(archivo) {
  if (!archivo || archivo.size <= 0 || archivo.size > 25 * 1024 * 1024) throw new Error('El PDF está vacío o supera 25 MB.');
  const buffer = await archivo.arrayBuffer();
  const inicio = new TextDecoder('latin1').decode(buffer.slice(0, 1024));
  const final = new TextDecoder('latin1').decode(buffer.slice(-2048));
  if (!/%PDF-\d\.\d/.test(inicio) || !/%%EOF/.test(final)) throw new Error('La descarga no es un PDF completo.');
  return buffer;
}

/** Prepare every file first, then commit the entire batch; hash IDs make retries idempotent. */
export async function guardarDocumentos(entradas, { maxDocumentos = 30 } = {}) {
  exigirEdicion();
  if (!Number.isInteger(maxDocumentos) || maxDocumentos < 1 || maxDocumentos > 1000 || !Array.isArray(entradas) || entradas.length > maxDocumentos) throw new Error('Lote de documentos inválido.');
  const docs = [];
  for (const { clienteId, clienteNombre, tipo, archivo } of entradas) {
    if (!clienteId || !archivo) throw new Error('faltan datos del documento');
    const buffer = archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name || '') ? await validarPDF(archivo) : await archivo.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    docs.push({ id: `d:${clienteId}:${sha256}`, sha256, clienteId, clienteNombre: clienteNombre || '', tipo: TIPOS.includes(tipo) ? tipo : 'otro',
      nombreArchivo: archivo.name || 'documento', mime: archivo.type || 'application/octet-stream', tamano: archivo.size,
       fecha: new Date().toISOString(), bytes: buffer });
  }
  if (!docs.length) return [];
  const store = await tx('readwrite');
  const resultados = new Map();
  await new Promise((resolve, reject) => {
    const transaction = store.transaction;
    transaction.oncomplete = resolve;
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('No se archivó el lote.'));
    for (const doc of docs) {
      const request = store.get(doc.id);
      request.onsuccess = () => {
        if (request.result) resultados.set(doc.id, request.result);
        else { store.put(doc); resultados.set(doc.id, doc); }
      };
    }
  });
  return Array.from(resultados.values(), ({ blob, bytes, ...meta }) => meta);
}

/** Metadatos de los documentos de un cliente (sin los blobs). */
export async function listarDocumentos(clienteId) {
  const todos = await promesa((await tx('readonly')).getAll());
  return todos
    .filter((d) => d.clienteId === clienteId)
    .map(({ blob, bytes, ...meta }) => meta)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Entrega el blob para abrir/descargar el original. */
export async function obtenerDocumento(id) {
  const doc = await promesa((await tx('readonly')).get(id));
  if (!doc) return doc;
  // ArrayBuffer is portable across engines that cannot persist File/Blob in IndexedDB.
  // Legacy records keep their existing Blob; no destructive database migration is needed.
  const { bytes, ...record } = doc;
  if (bytes instanceof ArrayBuffer) record.blob = new Blob([bytes], { type: doc.mime || 'application/octet-stream' });
  return record;
}

/** Elimina un documento (no toca el expediente del cliente). */
export async function eliminarDocumento(id) {
  exigirEdicion();
  await promesa((await tx('readwrite')).delete(id));
}

/** Remove all documents, or only those belonging to one deleted client. */
export async function eliminarDocumentosCliente(clienteId = null) {
  exigirEdicion();
  const store = await tx('readwrite');
  const transaction = store.transaction;
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    if (clienteId === null) store.clear();
    else {
      const request = store.index('clienteId').openCursor(IDBKeyRange.only(clienteId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
    }
  });
}

/** Texto legible del tipo de documento. */
export function etiquetaTipo(tipo) {
  return {
    'certificado-saldo': 'Certificado de Saldo',
    'certificado-ofertas': 'Certificado de Ofertas SCOMP',
    'certificado-afiliacion': 'Certificado de Afiliación AFP',
    'certificado-cotizaciones': 'Certificado de Cotizaciones AFP',
    'cartola-resumen': 'Cartola Resumen AFP',
    'otro': 'Otro documento'
  }[tipo] || 'Documento';
}
