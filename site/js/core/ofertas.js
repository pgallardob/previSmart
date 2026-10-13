/* PreviSmart · ofertas.js — motor puro de evaluación de ofertas SCOMP.
   Compara contratos completos (no solo UF/mes): solvencia, período
   garantizado, incrementos, cuota mortuoria, aumento diferido, comisión. */

import { NORMATIVA } from '../data/normativa-2026.js';
import { ufAclp } from './format.js';

const ORDEN_CLASIFICACION = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB', 'B'];
const INDICE_BBB = ORDEN_CLASIFICACION.indexOf('BBB');

/** Orden de una clasificación de riesgo (menor = mejor). */
export function indiceClasificacion(c) {
  const i = ORDEN_CLASIFICACION.indexOf(String(c || '').toUpperCase());
  return i === -1 ? 99 : i;
}

/**
 * Evalúa una oferta de renta vitalicia.
 * @param {object} o oferta guardada (campos en UF salvo indicación)
 * @param {number} valorUF UF vigente en CLP
 */
export function evaluarOferta(o, valorUF) {
  const alertas = [];
  const pensionUF = Number(o.pensionUF) || 0;
  const primaUF = Number(o.primaUF) || 0;
  const pensionCLP = valorUF ? ufAclp(pensionUF, valorUF) : null;
  const primaCLP = valorUF ? ufAclp(primaUF, valorUF) : null;

  // Tasa implícita anual: pensión anual / prima (rendimiento del capital)
  const tasaImplicita = primaUF > 0 ? (pensionUF * 12) / primaUF : null;

  // ---- Alertas normativas ----
  if (pensionUF > 0 && pensionUF < NORMATIVA.rentaVitaliciaMinUF.valor) {
    alertas.push({ tipo: 'danger', texto: `Pensión ${pensionUF.toFixed(2)} UF < mínimo legal 2 UF: la oferta no debería existir.` });
  }
  if (!o.clasificacion) {
    alertas.push({ tipo: 'info', texto: 'Clasificación no reconocida: cotejar el certificado y la fuente vigente. No se presume una clasificación inferior a BBB.' });
  } else if (indiceClasificacion(o.clasificacion) > INDICE_BBB) {
    alertas.push({ tipo: 'danger', texto: `Clasificación ${o.clasificacion || 'desconocida'} bajo el mínimo BBB: la aseguradora no podría participar en SCOMP.` });
  }
  if (pensionUF > NORMATIVA.garantiaEstatal.topeUFmensual) {
    alertas.push({ tipo: 'warning', texto: `Pensión sobre ${NORMATIVA.garantiaEstatal.topeUFmensual} UF: el excedente queda fuera de la garantía estatal.` });
  }
  if (Number(o.cuotaMortuoriaUF) > NORMATIVA.cuotaMortuoriaMaxUF.valor) {
    alertas.push({ tipo: 'warning', texto: `Cuota mortuoria sobre el tope de ${NORMATIVA.cuotaMortuoriaMaxUF.valor} UF.` });
  }
  if (o.ofertaBruta) {
    alertas.push({ tipo: 'warning', texto: 'Oferta bruta: la comisión del agente saldrá de esta prima. Preguntar el neto real.' });
  }
  if (o.aumentoDiferidoPct > 0 && !o.aumentoDiferidoMes) {
    alertas.push({ tipo: 'info', texto: 'Aumento diferido sin mes pactado.' });
  }

  return {
    pensionUF, pensionCLP, primaUF, primaCLP,
    tasaImplicita,
    tasaImplicitaPct: tasaImplicita != null ? tasaImplicita * 100 : null,
    alertas
  };
}

/** Ordena la lista de {oferta, _ev}. criterio: 'pension' | 'tasa' | 'periodo' | 'clasificacion' */
export function ordenarOfertas(lista, criterio = 'pension') {
  const arr = [...lista];
  const cmp = {
    pension: (a, b) => (b._ev.pensionUF || 0) - (a._ev.pensionUF || 0),
    tasa: (a, b) => (b._ev.tasaImplicita || 0) - (a._ev.tasaImplicita || 0),
    periodo: (a, b) => (Number(b.oferta.periodoGarantizadoAnios) || 0) - (Number(a.oferta.periodoGarantizadoAnios) || 0),
    clasificacion: (a, b) => indiceClasificacion(a.oferta.clasificacion) - indiceClasificacion(b.oferta.clasificacion)
  }[criterio];
  return cmp ? arr.sort(cmp) : arr;
}

/** Índices de la mejor oferta por criterio (para destacar en la matriz). */
export function mejores(listaEvaluadas) {
  const best = { pension: -1, tasa: -1, periodo: -1 };
  listaEvaluadas.forEach((e, i) => {
    if (best.pension === -1 || e._ev.pensionUF > listaEvaluadas[best.pension]._ev.pensionUF) best.pension = i;
    if (best.tasa === -1 || (e._ev.tasaImplicita ?? -1) > (listaEvaluadas[best.tasa]._ev.tasaImplicita ?? -1)) best.tasa = i;
    if (best.periodo === -1 || (Number(e.oferta.periodoGarantizadoAnios) || 0) > (Number(listaEvaluadas[best.periodo].oferta.periodoGarantizadoAnios) || 0)) best.periodo = i;
  });
  return best;
}
