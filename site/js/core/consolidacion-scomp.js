import { parseLocal } from './dates.js';

const rut = (v) => String(v || '').replace(/[^\dkK]/g, '').toUpperCase();
const seleccionar = (value, keys) => Object.fromEntries(keys.filter((key) => value?.[key] != null).map((key) => [key, value[key]]));
const PERFIL = ['rut', 'nombre', 'apellidoPaterno', 'apellidoMaterno', 'afp', 'fechaNacimiento', 'sexo', 'estadoCivil'];
const SALDO = ['obligatorio', 'saldoDestinadoUF', 'ufEmisionCLP', 'certSaldoEmitido', 'certSaldoVence', 'pensionEstimadaUF', 'pensionEstimadaCLP', 'pensionEstimadaFuente'];
const OFERTA = ['aseguradora', 'codigoOferta', 'modalidad', 'pensionUF', 'pensionCLPdocumento', 'diferenciaAnualCLPdocumento', 'primaUF',
  'periodoGarantizadoAnios', 'aumentoTemporalPct', 'aumentoTemporalMeses', 'aumentoDiferidoPct', 'aumentoDiferidoMes',
  'incrementoConyugeUF', 'sobrevConyugePct', 'sobrevHijosPct', 'cuotaMortuoriaUF', 'clasificacion', 'tasaDescuentoPct', 'comisionUF', 'ofertaBruta'];

/** Immutable, whitelisted extraction linked to the archived original, separate from operator edits. */
export function crearFuenteSCOMP(resultado, documento) {
  const saldo = seleccionar(resultado.saldo, SALDO);
  if (Array.isArray(resultado.saldo?.retirosProgramados)) saldo.retirosProgramados = resultado.saldo.retirosProgramados
    .filter((r) => r && typeof r.afp === 'string' && Number.isFinite(r.pensionUF) && r.pensionUF >= 0)
    .map((r) => ({ afp: r.afp, pensionUF: r.pensionUF,
      pensionCLPdocumento: Number.isSafeInteger(r.pensionCLPdocumento) && r.pensionCLPdocumento >= 0 ? r.pensionCLPdocumento : null }));
  return { documentoId: documento?.id || null, clienteId: documento?.clienteId || null, sha256: documento?.sha256 || null, nombreArchivo: documento?.nombreArchivo || null,
    perfil: seleccionar(resultado.perfil, PERFIL), saldo,
    scomp: seleccionar(resultado.scomp, ['codigoConsulta', 'fechaEmision', 'vigenciaDesde', 'vigenciaHasta']),
    beneficiarios: (resultado.beneficiarios || []).map((b) => seleccionar(b, ['rut', 'nombre', 'tipo', 'fechaNacimiento', 'sexo', 'estudiante', 'invalidez'])),
    ofertas: (resultado.ofertas || []).map((o) => ({ ...seleccionar(o, OFERTA), fuente: 'certificado-scomp', documentoId: documento?.id || null })) };
}

export function certificadosSCOMP(cliente) {
  const sources = cliente?.scomp?.certificados;
  return Array.isArray(sources) ? sources.filter((s) => s && typeof s.documentoId === 'string' && s.originalEliminado !== true
    && (!s.clienteId || s.clienteId === cliente.id)
    && s.saldo && typeof s.saldo === 'object' && Array.isArray(s.ofertas) && s.ofertas.every((o) => o && typeof o === 'object')
    && Array.isArray(s.beneficiarios) && s.scomp && typeof s.scomp === 'object'
    && rut(s.perfil?.rut) && rut(s.perfil.rut) === rut(cliente?.perfil?.rut)) : [];
}

export function certificadoSCOMP(cliente) {
  const sc = cliente?.scomp || {};
  const source = certificadosSCOMP(cliente).find((s) => s.documentoId && s.documentoId === sc.documentoActivoId);
  if (!source || !rut(source.perfil?.rut) || rut(source.perfil.rut) !== rut(cliente?.perfil?.rut)) return null;
  return source;
}

/** Build a read-only consolidated view; never replace the AFP portal balance with total pension capital. */
export function clienteParaPropuesta(cliente) {
  const source = certificadoSCOMP(cliente);
  if (cliente?.scomp?.usarParaPropuesta !== true) return cliente?.scomp?.usarParaPropuesta === false
    ? { ...cliente, ofertas: (cliente.ofertas || []).filter((o) => o.fuente !== 'certificado-scomp'),
      scomp: { ...cliente.scomp, fuente: null, codigoConsulta: null, fechaEmision: null, vigenciaDesde: null, vigenciaHasta: null } } : cliente;
  if (!source) return { ...cliente, ofertas: [], scomp: { ...cliente.scomp, fuente: null } };
  return { ...cliente, ofertas: source.ofertas,
    scomp: { ...cliente.scomp, ...source.scomp, fuente: { id: source.documentoId, sha256: source.sha256, nombreArchivo: source.nombreArchivo },
      ufEmisionCLP: source.saldo.ufEmisionCLP, saldoDestinadoUF: source.saldo.saldoDestinadoUF } };
}

export function ofertaBaseSCOMP(cliente) {
  if (cliente?.scomp?.usarParaPropuesta !== true) return null;
  const source = certificadoSCOMP(cliente);
  const idx = cliente.scomp.ofertaBaseIdx;
  return source && Number.isInteger(idx) && idx >= 0 ? source.ofertas[idx] || null : null;
}

/** Compare only explicitly declared like-for-like physical offers, on a common UF reference. */
export function compararOfertaPresencial(cliente, valorUF, fechaCalculo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  const source = certificadoSCOMP(cliente), base = ofertaBaseSCOMP(cliente), real = cliente?.scomp?.comparacionPresencial;
  if (!base || !real || real.documentoId !== source?.documentoId || real.ofertaBaseIdx !== cliente.scomp.ofertaBaseIdx) return { estado: 'pendiente', detalle: 'Seleccionar una oferta base SCOMP y registrar su comparación presencial.' };
  if (real.mismasCondiciones !== true) return { estado: 'no-comparable', detalle: 'No se han confirmado iguales aseguradora, modalidad, prima, beneficiarios y cláusulas; no se calculan diferencias como si fueran equivalentes.' };
  if (String(real.aseguradora || '').trim().toUpperCase() !== String(base.aseguradora || '').trim().toUpperCase()) return { estado: 'no-comparable', detalle: 'Las aseguradoras difieren; revisar la comparación.' };
  if (!Number.isFinite(base.pensionUF) || base.pensionUF <= 0 || !Number.isFinite(real.pensionUF) || real.pensionUF <= 0
      || !parseLocal(real.fecha) || real.fecha > fechaCalculo || !String(real.referencia || '').trim()) return { estado: 'pendiente', detalle: 'Falta monto válido, fecha no futura o referencia de la oferta presencial.' };
  const deltaUF = real.pensionUF - base.pensionUF;
  const validUF = Number.isFinite(valorUF) && valorUF > 0;
  return { estado: 'comparacion-manual', baseUF: base.pensionUF, presencialUF: real.pensionUF, deltaUF,
    baseCLP: validUF ? Math.round(base.pensionUF * valorUF) : null, presencialCLP: validUF ? Math.round(real.pensionUF * valorUF) : null,
    deltaCLP: validUF ? Math.round(real.pensionUF * valorUF) - Math.round(base.pensionUF * valorUF) : null,
    deltaAnualCLP: validUF ? 12 * (Math.round(real.pensionUF * valorUF) - Math.round(base.pensionUF * valorUF)) : null,
    fecha: real.fecha, referencia: real.referencia, detalle: 'Oferta presencial registrada manualmente; no verificada ni aceptada por PreviSmart. La diferencia anual no aplica durante un aumento temporal distinto.' };
}
