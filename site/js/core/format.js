/* PreviSmart · format.js — formateadores es-CL (moneda, UF, %, fechas) */

import { parseLocal } from './dates.js';

const fechaLocal = (f) => f instanceof Date ? f : /^\d{4}-\d{2}-\d{2}$/.test(String(f)) ? parseLocal(f) : f ? new Date(f) : null;
const fmtCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0
});
const fmtCLP2 = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP',
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const fmtNum = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const fmtUF = new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: 2, maximumFractionDigits: 4
});
const fmtPct = new Intl.NumberFormat('es-CL', {
  style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2
});
const fmtFechaCorta = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});
const fmtFechaLarga = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric', month: 'long', year: 'numeric'
});

/** $41.082 */
export function clp(n) {
  if (!Number.isFinite(n)) return '—';
  return fmtCLP.format(Math.round(n));
}

/** $41.081,76 — para la UF y valores que exigen decimales */
export function clpDec(n) {
  if (!Number.isFinite(n)) return '—';
  return fmtCLP2.format(n);
}

/** 41,0818 UF */
export function uf(n) {
  if (!Number.isFinite(n)) return '—';
  return `${fmtUF.format(n)} UF`;
}

/** 70 % / 3,31 % */
export function pct(frac) {
  if (!Number.isFinite(frac)) return '—';
  return fmtPct.format(frac);
}

/** 12.345 */
export function numero(n) {
  if (!Number.isFinite(n)) return '—';
  return fmtNum.format(n);
}

/** 03-10-2026 */
export function fechaCorta(f) {
  const d = fechaLocal(f);
  return !d || Number.isNaN(d.getTime()) ? '—' : fmtFechaCorta.format(d);
}

/** 3 de octubre de 2026 */
export function fechaLarga(f) {
  const d = fechaLocal(f);
  return !d || Number.isNaN(d.getTime()) ? '—' : fmtFechaLarga.format(d);
}

/** "hoy", "ayer", "hace 3 días" */
export function relativo(f) {
  const d = fechaLocal(f);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(d); fecha.setHours(0, 0, 0, 0);
  const diff = Math.round((hoy - fecha) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  if (diff > 1) return `hace ${diff} días`;
  if (diff === -1) return 'mañana';
  return `en ${-diff} días`;
}

/** CLP → UF y UF → CLP con el valor vigente */
export function clpAuf(clpValor, valorUF) {
  return Number.isFinite(clpValor) && Number.isFinite(valorUF) && valorUF > 0 ? clpValor / valorUF : NaN;
}
export function ufAclp(ufValor, valorUF) {
  return Number.isFinite(ufValor) && Number.isFinite(valorUF) && valorUF > 0 ? ufValor * valorUF : NaN;
}
