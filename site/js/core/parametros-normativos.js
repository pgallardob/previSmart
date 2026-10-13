import { parseLocal } from './dates.js';

const KEY = 'prevismart.parametros.v1';
const MAX_BYTES = 65536;
const copy = (value) => JSON.parse(JSON.stringify(value));
const fail = (message) => { throw new Error(message); };
const text = (value, max = 300) => typeof value === 'string' && value.trim() && value.length <= max;
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const validDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseLocal(value);
const hoyISO = () => fechaParametros();

export function onParametros(listener) {
  if (!globalThis.window) return () => {};
  const changed = (event) => { if (event.type === 'prevismart:parametros' || event.key === KEY || event.key === null) listener(); };
  window.addEventListener('prevismart:parametros', changed); window.addEventListener('storage', changed);
  return () => { window.removeEventListener('prevismart:parametros', changed); window.removeEventListener('storage', changed); };
}

/** Date-only inputs stay in their declared month; instants use the Chilean calendar. */
export function fechaParametros(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseLocal(value) ? value : null;
  if (value == null || value === '' || typeof value === 'boolean' || typeof value === 'number') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function officialURL(value, tipo) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && (tipo === 'impuesto-mensual' ? ['www.sii.cl', 'sii.cl'] : ['www.spensiones.cl', 'spensiones.cl']).includes(url.hostname);
  } catch { return false; }
}

export function validarParametro(raw, fechaRevision = hoyISO()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Parámetro inválido.');
  const common = ['tipo', 'fuente', 'url', 'publicadoEn'];
  const fields = raw.tipo === 'impuesto-mensual' ? [...common, 'periodo', 'tramos'] : [...common, 'desde', 'hasta', 'tasa'];
  if (!['impuesto-mensual', 'tasa-rp'].includes(raw.tipo) || Object.keys(raw).some((key) => !fields.includes(key))) fail('Tipo o campos de parámetro no admitidos.');
  if (!text(raw.fuente) || !text(raw.url, 1000) || !officialURL(raw.url, raw.tipo)
      || !validDay(raw.publicadoEn) || !validDay(fechaRevision) || raw.publicadoEn > fechaRevision) fail('Indica fuente oficial y fecha de publicación no futura.');
  if (raw.tipo === 'tasa-rp') {
    if (!validDay(raw.desde) || !validDay(raw.hasta) || raw.desde > raw.hasta
        || !finite(raw.tasa) || raw.tasa < 0 || raw.tasa > 0.2
        || (parseLocal(raw.hasta) - parseLocal(raw.desde)) / 86400000 > 366) fail('Tasa RP o período de vigencia inválidos.');
    return copy(raw);
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.periodo) || !Array.isArray(raw.tramos) || raw.tramos.length !== 8) fail('La tabla mensual debe indicar período y ocho tramos SII.');
  raw.tramos.forEach((t, i) => {
    const previous = raw.tramos[i - 1];
    if (!t || Object.keys(t).some((key) => !['desde', 'hasta', 'factor', 'rebaja'].includes(key))
        || !finite(t.desde) || t.desde < 0 || !finite(t.factor) || t.factor < 0 || t.factor > 0.6
        || !finite(t.rebaja) || t.rebaja < 0
        || (i === 0 && (t.desde !== 0 || t.factor !== 0 || t.rebaja !== 0))
        || (i === 7 ? t.hasta !== null : !finite(t.hasta) || t.hasta <= t.desde)
        || (previous && (Math.abs(t.desde - previous.hasta - 0.01) > 0.005 || t.factor < previous.factor
          || Math.abs(previous.hasta * (t.factor - previous.factor) - (t.rebaja - previous.rebaja)) > 0.1))) fail('Tramos SII discontinuos, incompletos o inválidos.');
  });
  return copy(raw);
}

const sameWindow = (a, b) => a.tipo === b.tipo && (a.tipo === 'impuesto-mensual'
  ? a.periodo === b.periodo : a.desde === b.desde && a.hasta === b.hasta);
function checkWindows(items) {
  for (const [i, a] of items.entries()) for (const b of items.slice(i + 1)) {
    if (a.tipo === 'tasa-rp' && b.tipo === a.tipo && !sameWindow(a, b) && a.desde <= b.hasta && b.desde <= a.hasta) fail('Hay períodos RP superpuestos; no se puede elegir una tasa inequívoca.');
  }
}

export function revisarPaqueteParametros(json, fechaRevision = hoyISO()) {
  if (typeof json !== 'string' || new TextEncoder().encode(json).length > MAX_BYTES) fail('El archivo de parámetros supera 64 KB.');
  let raw;
  try { raw = JSON.parse(json); } catch { fail('Archivo de parámetros JSON inválido.'); }
  if (raw?.schemaVersion !== 1 || Object.keys(raw).some((key) => !['schemaVersion', 'parametros'].includes(key))
      || !Array.isArray(raw.parametros) || !raw.parametros.length || raw.parametros.length > 24) fail('Paquete de parámetros incompatible.');
  const parametros = raw.parametros.map((p) => validarParametro(p, fechaRevision));
  checkWindows(parametros);
  if (parametros.some((p, i) => parametros.slice(i + 1).some((other) => sameWindow(p, other)))) fail('El paquete repite un mismo período.');
  return { schemaVersion: 1, parametros };
}

/** Imported history is installation-local, separate from every client and credential store. */
export function historialParametros() {
  try {
    const json = globalThis.localStorage?.getItem(KEY);
    if (!json) return { registros: [], error: null };
    if (new TextEncoder().encode(json).length > MAX_BYTES * 6) fail('Historial demasiado grande.');
    const data = JSON.parse(json);
    if (data.schemaVersion !== 1 || !Array.isArray(data.registros) || data.registros.length > 100) fail('Historial incompatible.');
    const registros = data.registros.map((r) => {
      if (!text(r.responsable, 200) || !validDay(r.revisadoEn) || r.revisadoEn > hoyISO()) fail('Revisión del historial inválida.');
      return { parametro: validarParametro(r.parametro, r.revisadoEn), responsable: r.responsable, revisadoEn: r.revisadoEn };
    });
    checkWindows(registros.map((r) => r.parametro));
    return { registros, error: null };
  } catch (error) { return { registros: [], error: `No se usan parámetros importados: ${error.message}` }; }
}

export function guardarPaqueteParametros(paquete, { responsable, confirmado, fecha = hoyISO() }, bases = []) {
  if (confirmado !== true || !text(responsable, 200) || !validDay(fecha) || fecha > hoyISO()) fail('Confirma el cotejo y registra al responsable de la revisión.');
  const validated = revisarPaqueteParametros(JSON.stringify(paquete), fecha);
  const before = globalThis.localStorage?.getItem(KEY) || null;
  const history = historialParametros();
  if (history.error) fail(history.error);
  checkWindows([...bases, ...history.registros.map((r) => r.parametro), ...validated.parametros]);
  const nuevos = validated.parametros.filter((p) => !history.registros.some((r) => JSON.stringify(r.parametro) === JSON.stringify(p)))
    .map((parametro) => ({ parametro, responsable: responsable.trim(), revisadoEn: fecha }));
  if (history.registros.length + nuevos.length > 100) fail('Historial lleno: exporta y revisa los parámetros antes de continuar.');
  if (!globalThis.localStorage) fail('Almacenamiento local no disponible.');
  if (localStorage.getItem(KEY) !== before) fail('Los parámetros cambiaron en otra pestaña; vuelve a revisar.');
  localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, registros: [...history.registros, ...nuevos] }));
  if (nuevos.length && globalThis.window) window.dispatchEvent(new Event('prevismart:parametros'));
  return { agregados: nuevos.length };
}

export function seleccionarParametro(tipo, fecha, base) {
  const day = fechaParametros(fecha);
  if (!day) return null;
  const history = historialParametros();
  if (history.error) return null;
  const matches = (p) => p.tipo === tipo && (tipo === 'impuesto-mensual'
    ? p.periodo === day.slice(0, 7) : p.desde <= day && p.hasta >= day);
  const imported = history.registros.filter((r) => matches(r.parametro)).at(-1);
  if (imported) return { ...copy(imported.parametro), origen: 'revisión local', responsable: imported.responsable, revisadoEn: imported.revisadoEn };
  return base && matches(base) ? { ...copy(base), origen: 'incluido en la aplicación' } : null;
}

export function exportarHistorialParametros() {
  const history = historialParametros();
  if (history.error) fail(history.error);
  return JSON.stringify({ schemaVersion: 1, registros: history.registros }, null, 2);
}
