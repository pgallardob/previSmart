import { NORMATIVA } from '../data/normativa-2026.js';
import { parseLocal } from './dates.js';
import { simularRP } from './simulacion-rp.js';
import { certificadoSCOMP } from './consolidacion-scomp.js';

const positivo = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const noNegativo = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const pesos = (pensionUF, valorUF) => positivo(valorUF) && noNegativo(pensionUF) && Number.isFinite(pensionUF * valorUF) ? pensionUF * valorUF : null;

/** Dated PGU parameter checked against the supplied reference and current 2026 data. */
export function parametroPGUGarantia(fecha = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && parseLocal(fecha) && fecha >= NORMATIVA.pgu.vigenteDesde && fecha <= '2027-01-31'
    ? NORMATIVA.pgu.montoMenores82 : null;
}

/** Prefer supplied monthly pensions; otherwise reuse the separately traced RP scenario. */
export function pensionReferencia(cliente, valorUF, fecha = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  if (cliente?.perfil?.rutaTipo === 'sobrevivencia') return { uf: null, clp: null, simulada: false,
    faltantes: ['La pensión del causante y el total de sobrevivencia no son una pensión individual del beneficiario'],
    fuente: 'Ruta de sobrevivencia: revisar pagos por beneficiario en el escenario RP separado; no se usa el causante como titular vivo' };
  const s = cliente?.saldo || {};
  const source = cliente?.scomp?.usarParaPropuesta === true ? certificadoSCOMP(cliente) : null;
  if (source && positivo(source.saldo?.pensionEstimadaUF)) return { uf: source.saldo.pensionEstimadaUF,
    clp: pesos(source.saldo.pensionEstimadaUF, valorUF), simulada: false, retiroProgramado: true, documentoId: source.documentoId,
    fuente: `Retiro programado del SCOMP seleccionado · ${source.scomp.fechaEmision || 'fecha no reconocida'} · conversión referencial con la UF indicada` };
  if (positivo(s.pensionEstimadaUF)) return { uf: s.pensionEstimadaUF,
    clp: pesos(s.pensionEstimadaUF, valorUF), simulada: false, fuente: 'Pensión mensual informada en el expediente (UF)' };
  if (positivo(s.pensionEstimadaCLP)) return { uf: positivo(valorUF) ? s.pensionEstimadaCLP / valorUF : null,
    clp: s.pensionEstimadaCLP, simulada: false, fuente: 'Pensión mensual informada en pesos; conversión referencial a UF' };
  const rp = simularRP(cliente, fecha);
  if (rp.estado === 'simulacion') return { uf: positivo(valorUF) ? rp.pensionCLP / valorUF : null,
    clp: rp.pensionCLP, simulada: true, escenario: rp,
    fuente: 'Simulación automática de retiro programado (CNU/TM2020); no es pensión AFP ni oferta de aseguradora' };
  return { uf: null, clp: null, simulada: false, faltantes: rp.faltantes,
    fuente: 'Faltan antecedentes para la simulación RP; no se requiere un certificado SCOMP' };
}

/** SCOMP reference, page 11: guarantee formula, not a personal IPS decision. */
export function garantiaEstatal(pensionUF, valorUF, pguCLP = parametroPGUGarantia()) {
  if (!noNegativo(pensionUF) || !positivo(valorUF) || !noNegativo(pguCLP)) return null;
  const pensionCLP = pensionUF * valorUF;
  if (!Number.isFinite(pensionCLP)) return null;
  const garantiaCLP = pensionCLP <= pguCLP ? pensionCLP
    : Math.min(pguCLP + 0.75 * (pensionCLP - pguCLP), NORMATIVA.garantiaEstatal.topeUFmensual * valorUF);
  return { pensionCLP, garantiaCLP, garantiaUF: garantiaCLP / valorUF,
    descubiertoCLP: pensionCLP - garantiaCLP, parametroPGU: pguCLP };
}

/** SCOMP tables compare annual differences using their rounded monthly peso amounts. */
export function diferenciasAnuales(ofertas, valorUF) {
  const grupo = (o) => JSON.stringify([o.documentoId || null, o.modalidad || null, o.periodoGarantizadoAnios ?? null,
    o.aumentoTemporalPct ?? null, o.aumentoTemporalMeses ?? null, o.aumentoDiferidoPct ?? null, o.aumentoDiferidoMes ?? null]);
  return ofertas.map((o) => {
    const validas = ofertas.filter((x) => grupo(x) === grupo(o) && positivo(x.pensionUF));
    const mejor = validas.length ? Math.max(...validas.map((x) => x.pensionUF)) : null;
    return { pensionUF: positivo(o.pensionUF) ? o.pensionUF : null,
    pensionCLP: positivo(o.pensionUF) && pesos(o.pensionUF, valorUF) != null ? Math.round(o.pensionUF * valorUF) : null,
    diferenciaAnualCLP: positivo(o.pensionUF) && pesos(o.pensionUF, valorUF) != null && mejor != null && pesos(mejor, valorUF) != null
      ? 12 * (Math.round(o.pensionUF * valorUF) - Math.round(mejor * valorUF)) : null };
  });
}

export function coberturaRegistrada(oferta, valorUF) {
  const p = positivo(oferta?.pensionUF) ? oferta.pensionUF : null;
  const aumento = noNegativo(oferta?.aumentoTemporalPct) && positivo(oferta?.aumentoTemporalMeses)
    ? { uf: p != null ? p * (1 + oferta.aumentoTemporalPct / 100) : null, meses: oferta.aumentoTemporalMeses } : null;
  const meses = noNegativo(oferta?.periodoGarantizadoAnios) ? oferta.periodoGarantizadoAnios * 12 : null;
  return { pensionUF: p, pensionCLP: p != null ? pesos(p, valorUF) : null,
    aumento, mesesGarantia: meses != null && Math.abs(meses - Math.round(meses)) < 1e-7 ? Math.round(meses) : null };
}
