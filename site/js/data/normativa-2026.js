/* ============================================================
   PreviSmart · normativa-2026.js — referencias normativas parametrizadas.
   Todas las constantes del sistema previsional chileno vigentes a
   octubre de 2026, extraídas de maestro.md con su fuente oficial.
   REGLA: ninguna cifra legal se hardcodea en la lógica — todo sale
   de aquí. Al cambiar la norma se crea normativa-AAAA.js nuevo.
   ============================================================ */

import { seleccionarParametro } from '../core/parametros-normativos.js';

export const NORMATIVA = {

  meta: {
    vigencia: '2026-10',
    referencia: 'maestro.md · DL 3.500 + Ley 21.735 + Ley 21.818',
    revisarEn: '2026-11', // Monthly tax tables require review at the next month.
    verificacionTecnica: 'parcial; no sustituye aprobación profesional'
  },

  /* ---- Edades y acceso a pensión (maestro §2) ---- */
  edadLegal: { mujer: 60, hombre: 65, fuente: 'DL 3.500, art. 3 — Spensiones' },
  vejezAnticipada: {
    pctPromedioMinimo: 0.70,   // pensión ≥70% del promedio de remuneraciones/rentas declaradas
    minUF: 12,                 // y pensión ≥12 UF
    fuente: 'DL 3.500 — Spensiones'
  },

  /* ---- Certificado de Saldo y SCOMP (maestro §3-6) ---- */
  plazos: {
    certSaldoEmisionDiasHabiles: 10,   // AFP debe emitir dentro de 10 días hábiles
    certSaldoVigenciaDiasCorridos: 35, // vigencia del certificado
    ofertasVigenciaDiasHabiles: 12,    // ofertas internas SCOMP
    consultasMaxPorCertificado: 3,
    fuente: 'Spensiones / CMF Chile'
  },

  /* ---- Umbrales de acceso a renta vitalicia (maestro §8) ---- */
  rentaVitaliciaMinUF: {
    valor: 2,                          // desde 01-09-2025 (antes 3 UF)
    vigenteDesde: '2025-09-01',
    fuente: 'Ley 21.735 — Spensiones'
  },

  /* ---- Retiro programado (maestro §9) ---- */
  retiroProgramado: {
    tasaCalculo: 0.0367,
    vigenteDesde: '2026-10-01',
    fuente: 'SP — Circular 2425, 02-10-2026; tasa desde octubre 2026',
    url: 'https://www.spensiones.cl/apps/tasas/tasdescto.php'
  },

  /* ---- Sobrevivencia: porcentajes legales (maestro §14) ---- */
  sobrevivenciaPct: {
    conyuge: 0.60,
    conyugeConHijosConDerecho: 0.50,
    hijoMenor18: 0.15,
    hijoEstudianteMenor24: 0.15,
    hijoInvalidoParcialMayor24: 0.11,
    filiacionNoMatrimonial: 0.36,
    filiacionNoMatrimonialConHijos: 0.30,
    padresCarga: 0.50,
    fuente: 'DL 3.500 — Spensiones'
  },

  /* ---- Plazos de matrimonio del cónyuge (maestro §15) ---- */
  conyugePlazos: {
    causanteNoPensionadoMeses: 6,
    causantePensionadoAnios: 3,
    excepciones: 'hijos comunes o embarazo',
    fuente: 'DL 3.500 — Spensiones'
  },

  /* ---- Ley 21.818 — exclusión por delitos graves (maestro §16) ---- */
  ley21818: {
    vigenteDesde: '2026-09-01',
    descripcion: 'Impide pensión de sobrevivencia a condenados por delitos graves contra el causante / violencia intrafamiliar.',
    fuente: 'Biblioteca del Congreso de Chile / CMF'
  },

  /* ---- Cuota mortuoria (maestro §21) ---- */
  cuotaMortuoriaMaxUF: { valor: 15, fuente: 'DL 3.500 — Spensiones' },

  /* ---- Solvencia y garantía estatal (maestro §22-23) ---- */
  aseguradora: {
    clasificacionMinima: 'BBB',
    fuente: 'Regulación previsional — Spensiones'
  },
  garantiaEstatal: {
    topeUFmensual: 45,                 // por pensionado o beneficiario, componente regulado
    advertencia: 'No es una garantía ilimitada del 100% de la pensión.',
    fuente: 'DL 3.500 / CMF Chile'
  },

  /* ---- PGU — Pensión Garantizada Universal (maestro §25-26) ---- */
  pgu: {
    // montos vigentes desde febrero 2026, en CLP mensual
    montoMenores82: 231732,            // monto base (quienes aún no acceden al máximo)
    montoMaximo: 250275,               // ChileAtiende/IPS, vigente para 75+ desde septiembre 2026
    pensionUmbralMaximo: 789139,       // pensión ≤ este monto → PGU completa
    pensionLimiteParcial: 1252602,     // pensión > este monto → sin PGU
    // Partial estimate uses the published pension thresholds; IPS confirms the pension base.
    vigenteDesde: '2026-02-01',
    calendarioMontoMaximo: [           // monto máximo según edad y fecha (Ley 21.735)
      { desde: '2025-09-01', edadMinima: 82 },
      { desde: '2026-09-01', edadMinima: 75 },
      { desde: '2027-09-01', edadMinima: 65 }
    ],
    requisitoExtra: 'No integrar el 10% de mayores ingresos (se evalúa con Registro Social de Hogares).',
    fuente: 'ChileAtiende / IPS — ficha 102077, consultada 09-10-2026; calendario Ley 21.735'
  },

  /* ---- BAC — Beneficio por Años Cotizados (maestro §27) ---- */
  bac: {
    ufPorAnioCotizado: 0.1,
    maxUFmensual: 2.5,
    edadMinima: 65,
    mesesMujerInicial: 120,            // sube gradualmente hasta 180
    mesesMujerFinal: 180,
    mesesHombre: 240,
    nota: 'Prestación del Seguro Social Previsional; no se suma al saldo AFP.',
    fuente: 'Ley 21.735 — Spensiones'
  },

  /* ---- CEV — Compensación por Expectativa de Vida, mujeres (§28-29) ---- */
  cev: {
    // Fórmula oficial (SP Compendio): CEV = PAFE × factor de corrección × %por edad
    tablaPorEdad: [                    // edad al 01-01-2026 → % de compensación
      { edadMin: 65, pct: 1.00 },
      { edadMin: 64, pct: 0.75 },
      { edadMin: 63, pct: 0.50 },
      { edadMin: 62, pct: 0.25 },
      { edadMin: 61, pct: 0.15 },
      { edadMin: 60, pct: 0.05 },
      { edadMin: 0,  pct: 0 }
    ],
    pensionAutofinanciadaTopeUF: 18,   // PAFE tope para el cálculo
    beneficioMinUF: 0.25,              // monto mínimo del beneficio
    edadPago: 65,                      // se paga solo desde los 65 años
    notaFactor: 'El factor de corrección compara la expectativa de vida hombre/mujer con tablas y tasa vigentes; lo calcula el Seguro Social. Requisito extra: ≥1 cotización FAPP antes de los 50 (afiliadas al DL 3.500 antes de ago-2025 están eximidas).',
    invalidezPuedeAlcanzar: 1.00,
    fuente: 'Ley 21.735 / SP Compendio de Pensiones, Letra C'
  },

  /* ---- Cotización adicional del empleador (maestro §30) ---- */
  cotizacionAdicional: {
    totalRegimenFinal: 0.085,
    capitalizacionIndividual: 0.06,
    rentabilidadProtegida: 0.015,
    seguroSocial: 0.025,               // incluye SIS + CEV
    nota: 'Implementación gradual; octubre 2026 aún no es régimen final.',
    fuente: 'Ley 21.735 — BCN'
  },

  /* ---- SIS (maestro §31) ---- */
  sis: {
    tasa: 0.0162,                      // remuneración/renta imponible, desde abr-2026
    vigenteDesde: '2026-04-01',
    fuente: 'Spensiones'
  },

  /* ---- Excedente de libre disposición (maestro §34-35) ---- */
  excedenteLibreDisposicion: {
    pctPromedioMinimo: 0.70,
    pensionMinUF: 12,
    requisitoExtra: 'antigüedad de afiliación exigida por la normativa',
    fuente: 'DL 3.500 — Spensiones'
  },

  /* ---- Comisiones (maestro §36-37) ---- */
  comisiones: {
    asesorPrimeraTramitacion: { pct: 0.015, maxUF: 60 },
    referenciaScomp: { pct: 0.02, maxUF: 60, nota: 'sobre saldo destinado a pensión, con exclusiones' },
    notaAgente: 'La comisión del agente puede pagarla la aseguradora tras el traspaso; preguntar si la oferta es bruta o neta.',
    fuente: 'CMF Chile'
  },

  /* ---- Impuesto Único de Segunda Categoría, MENSUAL oct-2026 (§46) ---- */
  impuestoUnico: {
    vigencia: '2026-10',
    exentoHasta: 974038.50,
    // renta líquida imponible → impuesto = renta × factor − rebaja
    tramos: [
      { desde: 0,          hasta: 974038.50,   factor: 0,     rebaja: 0 },
      { desde: 974038.51,  hasta: 2164530.00,  factor: 0.04,  rebaja: 38961.54 },
      { desde: 2164530.01, hasta: 3607550.00,  factor: 0.08,  rebaja: 125542.74 },
      { desde: 3607550.01, hasta: 5050570.00,  factor: 0.135, rebaja: 323957.99 },
      { desde: 5050570.01, hasta: 6493590.00,  factor: 0.23,  rebaja: 803762.14 },
      { desde: 6493590.01, hasta: 8658120.00,  factor: 0.304, rebaja: 1284287.80 },
      { desde: 8658120.01, hasta: 22366810.00, factor: 0.35,  rebaja: 1682561.32 },
      { desde: 22366810.01, hasta: Infinity,   factor: 0.40,  rebaja: 2800901.82 }
    ],
    fuente: 'SII — tabla mensual octubre 2026'
  },

  /* ---- Salud (maestro §47) ---- */
  salud: {
    fonasaPct: 0.07,                   // cotización legal 7%
    nota: 'Isapre: plan pactado en UF. Puede variar por edad, exenciones y PGU.',
    fuente: 'Normativa de salud previsional — Spensiones'
  },

  /* ---- Naturalezas de ahorro (maestro §33) ---- */
  naturalezaAhorro: [
    'Capital obligatorio', 'APV', 'Depósitos convenidos',
    'Cotizaciones voluntarias', 'Cuenta 2',
    'Bono de Reconocimiento', 'Bono por Hijo', 'Otros recursos'
  ],

  /* ---- Aumento diferido y vitalicio (maestro §19) ---- */
  aumentoDiferido: {
    vigenteDesde: '2026-09-01',
    descripcion: 'Cláusula: mes y % de aumento definidos en póliza; nuevo monto vitalicio. Adelanto del aumento una sola vez antes del pago aumentado (RVI vejez/invalidez vía SCOMP).',
    fuente: 'CMF Chile'
  },

  /* ---- Ofertas externas eliminadas (maestro §7) ---- */
  ofertasExternas: {
    eliminadasDesde: '2025-09-01',
    nota: 'Solo régimen transitorio para certificados emitidos antes de esa fecha.',
    fuente: 'Ley 21.735 — Spensiones'
  },

  /* ---- Fuentes oficiales de referencia (maestro §59) ---- */
  fuentes: [
    { nombre: 'Decreto Ley N.º 3.500 (texto)', url: 'https://www.bcn.cl/leychile/navegar?idNorma=29896' },
    { nombre: 'Ley N.º 21.735 — Reforma Previsional', url: 'https://www.bcn.cl/leychile/navegar?idNorma=1212060' },
    { nombre: 'Ley N.º 21.818 — sobrevivencia', url: 'https://www.bcn.cl/leychile/navegar?idNorma=1225211' },
    { nombre: 'Superintendencia de Pensiones — legislación AFP', url: 'https://www.spensiones.cl' },
    { nombre: 'CMF — Operación de SCOMP', url: 'https://www.cmfchile.cl' },
    { nombre: 'CMF — Estadísticas de rentas vitalicias', url: 'https://www.cmfchile.cl' },
    { nombre: 'SII — Impuesto Único de Segunda Categoría', url: 'https://www.sii.cl/valores_y_fechas/impuesto_2da_categoria/impuesto2026.htm' },
    { nombre: 'IPS — PGU y beneficios', url: 'https://www.ips.gob.cl' },
    { nombre: 'Indicadores (UF) — mindicador.cl', url: 'https://mindicador.cl' }
  ]
};

/** Calcula el impuesto único mensual para una renta líquida imponible (CLP). */
export function tablaImpuestoVigente(fecha = new Date()) {
  return obtenerTablaImpuesto(fecha) !== null;
}

export function parametrosIncluidos() {
  return [{ tipo: 'impuesto-mensual', periodo: NORMATIVA.impuestoUnico.vigencia,
    fuente: NORMATIVA.impuestoUnico.fuente, url: NORMATIVA.fuentes.find((f) => f.nombre.startsWith('SII')).url,
    publicadoEn: '2026-10-01', tramos: NORMATIVA.impuestoUnico.tramos.map((t) => ({ ...t, hasta: Number.isFinite(t.hasta) ? t.hasta : null })) },
  { tipo: 'tasa-rp', desde: '2026-10-01', hasta: '2026-12-31', tasa: NORMATIVA.retiroProgramado.tasaCalculo,
    fuente: NORMATIVA.retiroProgramado.fuente, url: NORMATIVA.retiroProgramado.url, publicadoEn: '2026-10-02' }];
}

export function obtenerTablaImpuesto(fecha = new Date()) {
  return seleccionarParametro('impuesto-mensual', fecha, parametrosIncluidos()[0]);
}

export function obtenerTasaRP(fecha = new Date()) {
  return seleccionarParametro('tasa-rp', fecha, parametrosIncluidos()[1]);
}

export function impuestoUnicoMensual(rentaLiquidaImponible, fecha = new Date()) {
  const tabla = obtenerTablaImpuesto(fecha);
  if (!tabla) return null;
  if (!Number.isFinite(rentaLiquidaImponible) || rentaLiquidaImponible <= 0) return 0;
  const tramo = tabla.tramos.find(
    (t, i) => (i === 0 || rentaLiquidaImponible > tabla.tramos[i - 1].hasta) && (t.hasta === null || rentaLiquidaImponible <= t.hasta)
  );
  if (!tramo || tramo.factor === 0) return 0;
  return Math.max(0, rentaLiquidaImponible * tramo.factor - tramo.rebaja);
}

/** % de CEV según edad cumplida. */
export function cevPctPorEdad(edadAnios) {
  const fila = NORMATIVA.cev.tablaPorEdad.find((t) => edadAnios >= t.edadMin);
  return fila ? fila.pct : 0;
}

/** Edad mínima vigente para el monto máximo de PGU a una fecha dada. */
export function pguEdadMinimaMontoMaximo(fecha = new Date()) {
  const f = fecha instanceof Date ? fecha : new Date(fecha);
  const vigente = NORMATIVA.pgu.calendarioMontoMaximo
    .filter((c) => new Date(c.desde) <= f)
    .sort((a, b) => a.edadMinima - b.edadMinima)[0];
  return vigente?.edadMinima ?? 82;
}
