/* PreviSmart · beneficios.js — motor puro de beneficios estatales.
   PGU · BAC · CEV · garantía estatal · cuota mortuoria.
   Sin DOM: entra cliente + UF vigente, devuelve resultado estructurado. */

import { NORMATIVA, cevPctPorEdad, pguEdadMinimaMontoMaximo } from '../data/normativa-2026.js';
import { edadExacta, hoy } from './dates.js';
import { ufAclp } from './format.js';

const N = NORMATIVA;

/** Monto base PGU aplicable según edad a la fecha actual. */
function pguMontoAplicable(edadAnios, fecha = hoy()) {
  const edadMin = pguEdadMinimaMontoMaximo(fecha);
  return {
    monto: edadAnios >= edadMin ? N.pgu.montoMaximo : N.pgu.montoMenores82,
    esMaximo: edadAnios >= edadMin,
    edadMinimaVigente: edadMin
  };
}

/** Estimate the partial benefit using the published lower and upper pension thresholds. */
function pguBeneficio(pensionCLP, monto) {
  const u = N.pgu.pensionUmbralMaximo;
  const limite = N.pgu.pensionLimiteParcial;
  if (pensionCLP <= u) return { beneficio: monto, tipo: 'completa', limite };
  if (pensionCLP >= limite) return { beneficio: 0, tipo: 'sin-beneficio', limite };
  return { beneficio: monto * (limite - pensionCLP) / (limite - u), tipo: 'parcial', limite };
}

/** Meses de cotización exigidos para BAC según sexo. */
function mesesBACRequeridos(sexo) {
  return sexo === 'F' ? N.bac.mesesMujerInicial : N.bac.mesesHombre;
}

/**
 * Evalúa los beneficios estatales del cliente.
 * @returns {{
 *   edad: number|null,
 *   pgu:   {estado, monto?, beneficio?, tipo?, detalle, supuestos:[]},
 *   bac:   {estado, uf?, clp?, detalle},
 *   cev:   {estado, pct?, ufMin?, ufMax?, detalle},
 *   garantia: {...}, cuotaMortuoria: {...},
 *   total: {pensionCLP?, pguCLP?, bacCLP?, totalCLP?, completo:boolean}
 * }}
 */
export function evaluarBeneficios(cliente, valorUF) {
  const p = cliente?.perfil || {};
  const s = cliente?.saldo || {};
  const N_ = NORMATIVA;

  const edad = p.fechaNacimiento ? edadExacta(p.fechaNacimiento, hoy())?.anios ?? null : null;
  const pensionUF = Number(s.pensionEstimadaUF) || null;
  const pensionCLP = pensionUF != null && valorUF ? ufAclp(pensionUF, valorUF) : null;
  const pensionada = Boolean(p.yaPensionado) && ['vejez', 'invalidez'].includes(p.rutaTipo || 'vejez');

  /* ============ PGU ============ */
  let pgu;
  if (edad == null || pensionCLP == null) {
    pgu = { estado: 'pendiente', detalle: 'Falta fecha de nacimiento y/o pensión estimada.', supuestos: [] };
  } else if (edad < 65) {
    pgu = { estado: 'warning', beneficio: 0, detalle: 'La PGU requiere 65 años cumplidos.', supuestos: [] };
  } else {
    const { monto, esMaximo, edadMinimaVigente } = pguMontoAplicable(edad);
    const r = pguBeneficio(pensionCLP, monto);
    pgu = {
      estado: r.beneficio > 0 ? 'success' : 'info',
      monto, esMaximo, edadMinimaVigente,
      beneficio: r.beneficio, tipo: r.tipo, limite: r.limite,
      detalle: r.tipo === 'completa'
        ? `Pensión ≤ $${N.pgu.pensionUmbralMaximo.toLocaleString('es-CL')}: accede a la PGU completa.`
        : r.tipo === 'parcial'
          ? 'Pensión base entre los umbrales oficiales: PGU parcial estimada proporcionalmente. El IPS determina el monto oficial.'
          : 'Pensión sobre el límite: no accede a PGU.',
      supuestos: [
        `Monto aplicable: $${monto.toLocaleString('es-CL')}${esMaximo ? ` (máximo por ${edadMinimaVigente}+ años)` : ' (base <82; sube por edad y calendario)'}`,
        N.pgu.requisitoExtra,
        'Residencia: al menos 20 años desde los 20 años de edad y 4 de los últimos 5 años.',
        'Se usa la pensión estimada como referencia; la pensión base oficial incluye PAFE y otras pensiones.',
        'Estimación: el monto oficial lo determina el IPS.'
      ]
    };
  }

  /* ============ BAC ============ */
  let bac;
  const mesesCot = Number(p.mesesCotizados) || 0;
  const mesesReq = p.sexo ? mesesBACRequeridos(p.sexo) : null;
  const excluyeCapDip = (p.otrasPensiones || []).some((x) => x === 'capredena' || x === 'dipreca');
  if (edad == null || !p.sexo || mesesCot <= 0) {
    bac = { estado: 'pendiente', detalle: 'Falta fecha de nacimiento, sexo y/o meses cotizados.' };
  } else {
    const cumpleEdad = edad >= N.bac.edadMinima;
    const cumpleMeses = mesesCot >= mesesReq;
    const cumplePensionada = pensionada;
    const uf = Math.min(N.bac.maxUFmensual, N.bac.ufPorAnioCotizado * (mesesCot / 12));
    if (cumpleEdad && cumpleMeses && cumplePensionada && !excluyeCapDip) {
      bac = {
        estado: 'success', uf, clp: valorUF ? ufAclp(uf, valorUF) : null,
        detalle: `${(mesesCot / 12).toFixed(1)} años cotizados → ${uf.toFixed(2)} UF/mes (tope 2,5 UF). Requisitos cumplidos: 65+, pensionada(o), ${mesesReq} meses ${p.sexo === 'F' ? '(mujer)' : '(hombre)'}.`
      };
    } else {
      const falta = [
        !cumpleEdad ? `requiere ${N.bac.edadMinima}+ años (tiene ${edad})` : null,
        !cumpleMeses ? `requiere ${mesesReq} meses cotizados (tiene ${mesesCot})` : null,
        !cumplePensionada ? 'requiere estar pensionado por vejez o invalidez' : null,
        excluyeCapDip ? 'pensionado de Capredena/Dipreca (salvo excepciones legales)' : null
      ].filter(Boolean).join('; ');
      bac = { estado: 'warning', detalle: `No cumple BAC: ${falta}.` };
    }
  }

  /* ============ CEV (solo mujeres 60+) ============ */
  let cev;
  if (p.sexo !== 'F') {
    cev = { estado: 'na', detalle: 'Aplica solo a mujeres pensionadas.' };
  } else if (edad == null || pensionUF == null) {
    cev = { estado: 'pendiente', detalle: 'Falta fecha de nacimiento y/o pensión estimada.' };
  } else {
    const pct = cevPctPorEdad(edad);
    const pafe = Math.min(pensionUF, N.cev.pensionAutofinanciadaTopeUF);
    if (pct > 0) {
      const ufMax = pafe * pct; // cota superior sin el factor de corrección
      cev = {
        estado: 'success', pct, pafe,
        ufMin: N.cev.beneficioMinUF,
        ufMax,
        detalle: `Mujer de ${edad} años → ${Math.round(pct * 100)}% de compensación. CEV = PAFE (≤18 UF) × factor de corrección oficial × ${Math.round(pct * 100)}%.`,
        supuestos: ['Se paga solo desde los 65 años.', N.cev.notaFactor]
      };
    } else {
      cev = { estado: 'info', detalle: `A los ${edad} años la tabla da 0% (la tabla parte en 5% a los 60).` };
    }
  }

  /* ============ Informativos (§21, §23) ============ */
  const garantia = {
    estado: 'info',
    topeUF: N.garantiaEstatal.topeUFmensual,
    detalle: `Si la aseguradora quiebra, la garantía estatal cubre la pensión hasta ${N.garantiaEstatal.topeUFmensual} UF/mes por pensionado o beneficiario. ${N.garantiaEstatal.advertencia}`
  };
  const cuotaMortuoria = {
    estado: 'info',
    topeUF: N.cuotaMortuoriaMaxUF.valor,
    detalle: `Cuota mortuoria con tope de ${N.cuotaMortuoriaMaxUF.valor} UF (${valorUF ? '$' + Math.round(ufAclp(N.cuotaMortuoriaMaxUF.valor, valorUF)).toLocaleString('es-CL') : 'en UF'}), en la renta vitalicia la aseguradora participa según el régimen.`
  };

  /* ============ Pensión total estimada ============ */
  const pguCLP = pgu?.beneficio || 0;
  const bacCLP = bac?.clp || 0;
  const total = {
    pensionCLP, pguCLP, bacCLP,
    totalCLP: pensionCLP != null ? pensionCLP + pguCLP + bacCLP : null,
    completo: pensionCLP != null
  };

  return { edad, pgu, bac, cev, garantia, cuotaMortuoria, total };
}
