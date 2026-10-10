/* PreviSmart · dates.js — calendario chileno.
   Días CORRIDOS (todos los días cuentan: vigencia Certificado de Saldo = 35)
   vs días HÁBILES (lunes a viernes sin feriados: emisión Certificado = 10,
   vigencia ofertas SCOMP = 12). */

import { FERIADOS, FERIADOS_SET } from '../data/feriados.js';

const FERIADO_NOMBRE = new Map(FERIADOS.map((f) => [f.fecha, f.nombre]));

/** Date|'YYYY-MM-DD' → 'YYYY-MM-DD' en hora local (sin desfase UTC). */
export function aISO(d) {
  const f = d instanceof Date ? d : parseLocal(d);
  if (!f || Number.isNaN(f.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}

/** 'YYYY-MM-DD' → Date local, o null si inválida. */
export function parseLocal(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).slice(0, 10));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

export function hoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function esFeriado(d) {
  return FERIADOS_SET.has(aISO(d));
}

export function nombreFeriado(d) {
  return FERIADO_NOMBRE.get(aISO(d)) || null;
}

/** Hábil = lunes a viernes y no feriado. */
export function esHabil(d) {
  const dia = d.getDay();
  return dia >= 1 && dia <= 5 && !esFeriado(d);
}

/** Suma n días corridos (todos cuentan). */
export function addDiasCorridos(fecha, n) {
  const origen = fecha instanceof Date ? fecha : parseLocal(fecha);
  if (!origen || !Number.isInteger(n)) return new Date(NaN);
  const d = new Date(origen);
  d.setDate(d.getDate() + n);
  return d;
}

/** Suma n días hábiles. La fecha de partida no cuenta. */
export function addDiasHabiles(fecha, n) {
  const origen = fecha instanceof Date ? fecha : parseLocal(fecha);
  if (!origen || Number.isNaN(origen.getTime()) || !Number.isInteger(n)) return new Date(NaN);
  const d = new Date(origen);
  let restantes = Math.abs(n);
  while (restantes > 0) {
    d.setDate(d.getDate() + (n >= 0 ? 1 : -1));
    if (esHabil(d)) restantes -= 1;
  }
  return d;
}

/** Días corridos entre dos fechas (b - a). */
export function diasCorridosEntre(a, b) {
  const da = a instanceof Date ? new Date(a) : parseLocal(a);
  const db = b instanceof Date ? new Date(b) : parseLocal(b);
  if (!da || !db) return NaN;
  da.setHours(0, 0, 0, 0); db.setHours(0, 0, 0, 0);
  return Math.round((db - da) / 86400000);
}

/** Días hábiles entre dos fechas (cuenta b, no a). */
export function diasHabilesEntre(a, b) {
  const inicio = a instanceof Date ? new Date(a) : parseLocal(a);
  const fin = b instanceof Date ? new Date(b) : parseLocal(b);
  if (!inicio || !fin) return NaN;
  inicio.setHours(0, 0, 0, 0); fin.setHours(0, 0, 0, 0);
  if (inicio > fin) return -diasHabilesEntre(fin, inicio);
  let d = inicio;
  let n = 0;
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    if (esHabil(d)) n += 1;
  }
  return n;
}

/** Días corridos que faltan para una fecha (negativo si ya pasó). */
export function diasPara(fecha, desde = hoy()) {
  return diasCorridosEntre(desde, fecha);
}

/** Edad exacta {anios, meses, dias} a una fecha de referencia. */
export function edadExacta(fechaNac, ref = hoy()) {
  const nac = fechaNac instanceof Date ? fechaNac : parseLocal(fechaNac);
  if (!nac || Number.isNaN(nac.getTime()) || !(ref instanceof Date) || Number.isNaN(ref.getTime()) || nac > ref) return null;
  let mesesTotales = (ref.getFullYear() - nac.getFullYear()) * 12 + ref.getMonth() - nac.getMonth();
  const aniversario = (meses) => {
    const primero = new Date(nac.getFullYear(), nac.getMonth() + meses, 1);
    const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate();
    primero.setDate(Math.min(nac.getDate(), ultimo));
    return primero;
  };
  if (aniversario(mesesTotales) > ref) mesesTotales--;
  const dias = diasCorridosEntre(aniversario(mesesTotales), ref);
  return { anios: Math.floor(mesesTotales / 12), meses: mesesTotales % 12, dias };
}

/** Fecha en que se cumple una edad (nacimiento + n años). */
export function fechaCumple(fechaNac, anios) {
  const nac = fechaNac instanceof Date ? fechaNac : parseLocal(fechaNac);
  if (!nac || Number.isNaN(nac.getTime()) || !Number.isInteger(anios)) return null;
  return new Date(nac.getFullYear() + anios, nac.getMonth(), nac.getDate());
}
