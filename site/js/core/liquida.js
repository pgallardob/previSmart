/* PreviSmart · liquida.js — pensión bruta UF → líquida CLP.
   Descuentos del pensionado (maestro §46-47):
   - Salud: Fonasa 7% sobre la pensión, o plan Isapre pactado en UF.
   - Impuesto único de segunda categoría sobre la renta líquida
     (bruta − cotización de salud), tabla mensual SII. */

import { NORMATIVA, impuestoUnicoMensual } from '../data/normativa-2026.js';
import { ufAclp } from './format.js';

/**
 * @param {number} pensionUF pensión bruta mensual en UF
 * @param {number} valorUF UF vigente en CLP
 * @param {{tipo:'fonasa'|'isapre', planUF?:number}} salud
 */
export function pensionLiquida(pensionUF, valorUF, salud = { tipo: 'fonasa' }, fecha = new Date()) {
  if (!Number.isFinite(pensionUF) || pensionUF < 0 || !Number.isFinite(valorUF) || valorUF <= 0
      || !salud || !['fonasa', 'isapre'].includes(salud.tipo)
      || (salud.tipo === 'isapre' && (!Number.isFinite(Number(salud.planUF)) || Number(salud.planUF) < 0))) return null;
  const brutaCLP = ufAclp(pensionUF, valorUF);

  const saludCLP = salud.tipo === 'isapre'
    ? ufAclp(Number(salud.planUF) || 0, valorUF)
    : brutaCLP * NORMATIVA.salud.fonasaPct;

  const imponible = Math.max(0, brutaCLP - saludCLP);
  const impuesto = impuestoUnicoMensual(imponible, fecha);
  if (impuesto === null) return null;
  const liquida = Math.max(0, brutaCLP - saludCLP - impuesto);

  return {
    brutaUF: pensionUF,
    brutaCLP,
    saludCLP,
    saludPct: salud.tipo === 'isapre' ? null : NORMATIVA.salud.fonasaPct,
    saludUF: clpAuf(saludCLP, valorUF),
    imponible,
    impuesto,
    liquida,
    liquidaUF: liquida / valorUF,
    tasaEfectiva: brutaCLP > 0 ? (brutaCLP - liquida) / brutaCLP : 0
  };
}

function clpAuf(clp_, valorUF) {
  return valorUF > 0 ? clp_ / valorUF : null;
}

/**
 * Sobrevivencia de una oferta: cuánto queda para cada beneficiario.
 * Pensión base = la de la oferta; % legales del maestro §14.
 * @param {object} oferta oferta elegida (o manual)
 * @param {Array} beneficiarios lista del cliente
 * @param {number} valorUF
 * @param {Function} pctFn pctSobrevivencia(beneficiario, hayHijos)
 */
export function escenarioSobrevivencia(oferta, beneficiarios, valorUF, pctFn) {
  const pensionUF = Number(oferta?.pensionUF) || 0;
  const hayHijos = beneficiarios.some((b) => b.tipo === 'hijo' && pctFn(b, false) > 0);

  const items = beneficiarios.map((b) => {
    let pctLegal = pctFn(b, hayHijos);
    let pensionUFB = pensionUF * pctLegal;
    let nota = null;

    if (b.tipo === 'conyuge' || b.tipo === 'conviviente') {
      // Incremento contractual (UF extra sobre la renta del cónyuge)
      const inc = Number(oferta?.incrementoConyugeUF) || 0;
      if (inc > 0) { pensionUFB += inc; nota = `incluye incremento conyugal +${inc} UF`; }
      // % contractual si la oferta lo mejora
      const pctOferta = Number(oferta?.sobrevConyugePct);
      if (pctOferta && pctOferta / 100 > pctLegal) {
        pensionUFB = pensionUF * (pctOferta / 100) + inc;
        nota = `mejorado por oferta al ${pctOferta}%`;
      }
    }
    if (b.tipo === 'hijo') {
      const pctOferta = Number(oferta?.sobrevHijosPct);
      if (pctOferta && pctOferta / 100 > pctLegal) {
        pensionUFB = pensionUF * (pctOferta / 100);
        nota = `mejorado por oferta al ${pctOferta}%`;
      }
    }

    return {
      ...b,
      pctLegal,
      pensionUF: pensionUFB,
      pensionCLP: valorUF ? ufAclp(pensionUFB, valorUF) : null,
      nota
    };
  });

  const totalPct = items.reduce((a, x) => a + x.pctLegal, 0);
  return {
    pensionUF,
    items,
    totalPct,
    excede100: totalPct > 1,
    cuotaMortuoriaUF: Math.min(Number(oferta?.cuotaMortuoriaUF) || 0, NORMATIVA.cuotaMortuoriaMaxUF.valor),
    periodoGarantizadoAnios: Number(oferta?.periodoGarantizadoAnios) || 0,
    mesesGarantia: (Number(oferta?.periodoGarantizadoAnios) || 0) * 12
  };
}
