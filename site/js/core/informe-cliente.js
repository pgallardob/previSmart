import { clp, uf, fechaCorta } from './format.js';
import { pensionReferencia, coberturaRegistrada } from './calculos.js';
import { pensionLiquida, escenarioSobrevivencia } from './liquida.js';
import { pctSobrevivencia, NOMBRES_TIPO } from './elegibilidad.js';
import { simularRP } from './simulacion-rp.js';
import { simularSobrevivenciaRP } from './simulacion-sobrevivencia-rp.js';
import { proyectarRP } from './proyeccion-rp.js';
import { clienteParaPropuesta, certificadoSCOMP, ofertaBaseSCOMP, compararOfertaPresencial } from './consolidacion-scomp.js';
import { edadExacta, parseLocal } from './dates.js';
import { NORMATIVA } from '../data/normativa-2026.js';
import { prepararAseguradoras } from './preparacion-aseguradoras.js';

const valido = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const dinero = (v) => valido(v) ? clp(v) : 'Pendiente';
const diferencia = (v) => typeof v === 'number' && Number.isFinite(v) ? clp(v) : 'Pendiente';
const pendientesPension = (c) => {
  const p = c.perfil || {}, d = c.sobrevivencia || {}, pendientes = [];
  if (!p.fechaNacimiento || !p.sexo) pendientes.push('Completar los datos personales necesarios para estimar su pensión.');
  if (d.rpGrupoConfirmado !== true || (c.beneficiarios || []).some((b) => !b.fechaNacimiento || !b.sexo))
    pendientes.push('Revisar con su asesor los datos de su familia y quiénes podrían recibir una pensión si usted fallece.');
  if (d.rpMesesDevengados == null) pendientes.push('Confirmar si existen mensualidades de pensión pendientes de pago; si no existen, indicarlo.');
  if (!pendientes.length) pendientes.push('Su asesor debe revisar los antecedentes y los valores aplicables a la fecha antes de informar una pensión estimada.');
  return pendientes;
};
const condiciones = (o) => [o.periodoGarantizadoAnios != null ? `Garantía ${o.periodoGarantizadoAnios * 12} meses` : 'Garantía no informada',
  o.aumentoTemporalPct > 0 ? `Aumento ${o.aumentoTemporalPct}% por ${o.aumentoTemporalMeses ?? '?'} meses` : '',
  o.aumentoDiferidoPct > 0 ? 'Aumento diferido: revisar póliza' : ''].filter(Boolean).join(' · ');

/** Client-first numbers from existing evidence. Hypothetical cases are RP sensitivity, not insurer quotes. */
export function modeloLecturaCliente(original, ufMeta, generadoEn = new Date().toISOString()) {
  const c = clienteParaPropuesta(original), p = c.perfil || {}, s = c.saldo || {}, fecha = generadoEn.slice(0, 10);
  const valorUF = valido(ufMeta?.valor) && ufMeta.valor > 0 ? ufMeta.valor : null;
  const ref = pensionReferencia(c, valorUF, fecha), rp = simularRP(c, fecha), base = ofertaBaseSCOMP(original);
  const documento = original.scomp?.usarParaPropuesta === true ? certificadoSCOMP(original) : null;
  const neta = (montoUF) => ['fonasa', 'isapre'].includes(p.saludTipo) && valido(montoUF)
    ? pensionLiquida(montoUF, valorUF, { tipo: p.saludTipo, planUF: p.saludPlanUF }, new Date(generadoEn)) : null;
  const edad = edadExacta(p.fechaNacimiento, parseLocal(fecha))?.anios;
  const legal = ['M', 'F'].includes(p.sexo) ? NORMATIVA.edadLegal[p.sexo === 'F' ? 'mujer' : 'hombre'] : null;
  const advertencias = [];
  if (original.scomp?.usarParaPropuesta === true && !documento) advertencias.push('El SCOMP seleccionado no tiene una fuente válida para este cliente; sus ofertas no se utilizaron.');
  if (documento && valido(s.obligatorio) && valido(documento.saldo.obligatorio) && s.obligatorio !== documento.saldo.obligatorio) advertencias.push('Saldo AFP y capital destinado en SCOMP son distintos: revisar sus fechas y qué cuentas incluyen. Esa diferencia no actualiza los precios de las aseguradoras.');
  if (edad != null && legal != null && edad < legal) advertencias.push(`Edad actual: ${edad} años; edad legal: ${legal}. Este escenario no demuestra que pueda pensionarse hoy ni proyecta la pensión a esa edad futura.`);
  if (!['fonasa', 'isapre'].includes(p.saludTipo) || (p.saludTipo === 'isapre' && !valido(p.saludPlanUF))) advertencias.push('Falta declarar salud/plan: los montos líquidos no están confirmados.');
  if (!valido(ref.clp)) advertencias.push(...pendientesPension(c));
  const todas = (c.ofertas || []).filter((o) => valido(o.pensionUF) && o.pensionUF > 0);
  if (!todas.length) advertencias.push('No hay cotizaciones de renta vitalicia cargadas. Su precio no se deduce de la simulación de retiro programado.');
  if (c.scomp?.vigenciaHasta && c.scomp.vigenciaHasta < fecha) advertencias.push('El SCOMP tiene vigencia registrada vencida: sus importes sirven como referencia histórica, no como cotizaciones vigentes.');
  const elegida = base || todas[0];
  const mostradas = todas.slice(0, 8);
  if (base && !mostradas.includes(base)) mostradas[mostradas.length - 1] = base;
  const registros = [];
  if (valido(ref.clp)) registros.push({ etiqueta: 'Retiro programado', grafico: 'Retiro prog.', monto: ref.clp,
    liquida: neta(ref.uf)?.liquida ?? null, origen: ref.simulada ? `Simulado: ${rp.capitalFuente}` : ref.documentoId ? 'RP informado en el SCOMP seleccionado' : 'Pensión informada; referencia fechada', tipo: 'rp' });
  mostradas.forEach((o, i) => registros.push({ etiqueta: `SCOMP/oferta ${i + 1}: ${o.aseguradora || 'Entidad no informada'}`,
    grafico: `Oferta ${i + 1}`, monto: valorUF ? o.pensionUF * valorUF : null, liquida: neta(o.pensionUF)?.liquida ?? null,
    origen: `${o.fuente === 'certificado-scomp' ? 'Documento SCOMP' : 'Ingreso manual'} · ${condiciones(o)}`, tipo: 'oferta' }));
  const presencial = compararOfertaPresencial(original, valorUF, fecha);
  if (presencial.estado === 'comparacion-manual') registros.push({ etiqueta: 'Oferta presencial registrada', grafico: 'Presencial',
    monto: presencial.presencialCLP, liquida: neta(presencial.presencialUF)?.liquida ?? null, origen: 'Manual; condiciones iguales declaradas', tipo: 'presencial' });
  const secciones = [];
  const tabla = (titulo, columnas, filas, nota) => secciones.push({ tipo: 'tabla', titulo, columnas, filas, nota });
  const grafico = (titulo, barras, nota) => secciones.push({ tipo: 'grafico', titulo, barras: barras.filter((b) => valido(b.valor)), nota });
  const companias = prepararAseguradoras(original);
  tabla('1. Ingresos: alternativas con los datos disponibles', ['Alternativa', 'Bruta base / mes', 'Líquida ref. / mes', '12 pagos base', 'Origen / condiciones'],
    registros.map((r) => [r.etiqueta, dinero(r.monto), dinero(r.liquida), dinero(valido(r.monto) ? Math.round(r.monto) * 12 : null), r.origen])
      .concat(!todas.length ? [['Renta vitalicia', 'Sin cotización', 'Pendiente', 'No calculable', 'Cargar SCOMP para comparar una oferta real']] : []),
    `${valorUF ? 'Montos en pesos a la misma UF de referencia.' : 'Falta una UF válida para convertir cotizaciones en UF a pesos.'} Bruta: antes de descuentos. Líquida referencial: después de salud e impuesto modelados, antes de otros cargos no informados; revisar exenciones. "12 pagos base" no es una promesa anual ni incluye aumentos temporales o beneficios concedidos.${todas.length > mostradas.length ? ` Se muestran ${mostradas.length} de ${todas.length} ofertas; el detalle completo está en el anexo.` : ''}`);
  tabla('Preparación: tres aseguradoras para evaluar, aun sin SCOMP', ['Compañía', 'Modalidades y coberturas publicadas', 'Clasificación: informe consultado', 'Precio y costos para este cliente'],
    companias.map((a) => [a.nombre, `${a.modalidades.join('; ')}. ${a.clausulas.join('; ')}`,
      `${a.riesgo.nota} · ${a.riesgo.agencia} · ${fechaCorta(a.riesgo.fecha)} · ${a.riesgo.perspectiva}`,
      `${a.estadoPrecio}. Arancel individual no publicado en la fuente de producto; no se presume costo cero.`]),
    `Estas tres compañías son opciones para iniciar la consulta, no una recomendación ni todo el mercado. Información revisada al ${fechaCorta(companias[0].consultadoEn)}. La calificación resume una evaluación de la compañía: no garantiza el pago ni informa cuánto le ofrecería a usted. Solicite una oferta personal y confirme sus condiciones.`);
  if (documento?.saldo?.retirosProgramados?.length) tabla('Retiro programado: AFP informadas en el SCOMP seleccionado',
    ['AFP', 'UF / mes, primer año', 'CLP / mes a UF de referencia', 'CLP del documento'],
    documento.saldo.retirosProgramados.map((r) => [r.afp, uf(r.pensionUF), dinero(valorUF ? r.pensionUF * valorUF : null), dinero(r.pensionCLPdocumento)]),
    `Fuente: ${documento.nombreArchivo || documento.documentoId} · ${fechaCorta(documento.scomp.fechaEmision)}. Se conservan las columnas reconocidas, no se recalcula una oferta AFP ni se modifica el saldo del expediente. Los pesos originales y su conversión actual son bases distintas. No es un ranking ni una aceptación; revisar vigencia y condiciones.`);
  if (ref.simulada && rp.comisionCLP != null) tabla('Cargo AFP declarado: efecto en el ingreso RP', ['Concepto', 'CLP / mes'], [
    ['RP bruto del escenario', dinero(rp.pensionCLP)], [`Comisión declarada ${rp.comisionPct}%`, dinero(rp.comisionCLP)],
    ['Después del cargo, antes de salud e impuesto', dinero(rp.pensionTrasComisionCLP)],
    ['Líquida referencial menos cargo declarado', neta(ref.uf) ? dinero(Math.max(0, neta(ref.uf).liquida - rp.comisionCLP)) : 'Pendiente por salud/UF/tabla tributaria']
  ], `Fuente del cargo: ${rp.comisionReferencia}. Comparación de flujo: no se presume que la comisión reduzca la base tributaria ni se modifican las cotizaciones documentadas.`);
  if (registros.filter((r) => valido(r.monto)).length > 1) grafico('Comparación visual: pensión base bruta mensual',
    registros.map((r) => ({ etiqueta: r.grafico, valor: r.monto, tipo: r.tipo })),
    'Barras desde cero. Un monto mayor no implica una mejor alternativa: comparar garantías, modalidad, vigencia y demás condiciones.');
  tabla('2. Qué cambia según la modalidad', ['Aspecto', 'Retiro programado', 'Renta vitalicia'], [
    ['Quién paga', 'AFP, con cargo a la cuenta', 'Aseguradora, según contrato'],
    ['Monto mensual', 'Se recalcula; no es fijo de por vida', 'Pactado en UF; revisar cláusulas'],
    ['Capital y herencia', 'Saldo remanente: depende de beneficiarios y reglas aplicables', 'La prima se transfiere a la aseguradora; no es saldo propio heredable'],
    ['Garantías', 'No son las de una póliza de renta vitalicia', elegida ? condiciones(elegida) : 'No hay condiciones de póliza disponibles'],
    ['Decisión', 'La simulación no acredita elegibilidad', 'La aceptación es irrevocable; cotejar la oferta y la póliza']
  ], 'No se recomienda una modalidad automáticamente ni se presume que exista un contrato firmado.');
  if (rp.estado === 'simulacion') {
    const casos = [{ etiqueta: 'Capital -10%', factor: 0.9 }, { etiqueta: 'Capital actual', factor: 1 }, { etiqueta: 'Capital +10%', factor: 1.1 }];
    tabla('3. Casos: cómo cambia el retiro programado si cambia el capital', ['Caso', 'Capital de cálculo', 'Bruta / mes', 'Cambio mensual'],
      casos.map((caso) => [caso.etiqueta, clp(rp.capitalCLP * caso.factor), clp(rp.pensionCLP * caso.factor), clp(Math.round(rp.pensionCLP * caso.factor) - Math.round(rp.pensionCLP))]),
      `Ejercicios con la misma edad, familia y tasa de la simulación propia. No son pronósticos, ofertas de aseguradoras ni permiso para retirar capital; no proyectan aportes o rentabilidad futura.${!ref.simulada ? ' La base simulada puede diferir de la pensión documentada de otra fecha.' : ''}`);
    grafico('Tres casos de capital: impacto en la pensión mensual', casos.map((caso) => ({ etiqueta: caso.etiqueta, valor: rp.pensionCLP * caso.factor, tipo: 'caso' })),
      `Cada barra muestra pensión bruta mensual en pesos. Base del caso central: ${rp.capitalFuente}.`);
  }
  if (base) {
    const cobertura = coberturaRegistrada(base, valorUF);
    if (cobertura.aumento?.uf != null) tabla('Caso contractual: durante y después del aumento temporal', ['Etapa', 'Duración registrada', 'Bruta / mes', 'Líquida referencial'], [
      ['Durante el aumento', `${cobertura.aumento.meses} meses`, dinero(valorUF ? cobertura.aumento.uf * valorUF : null), dinero(neta(cobertura.aumento.uf)?.liquida)],
      ['Después del aumento', 'Según la póliza', dinero(cobertura.pensionCLP), dinero(neta(base.pensionUF)?.liquida)]
    ], 'Ejercicio con la cláusula registrada; cotejar desde qué pago rige, exclusiones y condiciones de la póliza.');
  }
  if (c.sobrevivencia?.srpCapitalCLP != null) {
    const srp = simularSobrevivenciaRP(c, fecha);
    if (srp.estado === 'simulacion') tabla('Sobrevivencia RP: pagos desde el capital remanente declarado', ['Beneficiario', 'Pago bruto / mes', 'Tope aplicado'],
      srp.pensiones.map((b) => [b.nombre || NOMBRES_TIPO[b.tipo], dinero(b.pensionCLP), b.topeCLP != null ? dinero(b.topeCLP) : 'No aplica en este ejercicio'])
        .concat([['Total del grupo', dinero(srp.totalMensualCLP), 'No es pensión individual']]),
      `Ejercicio con ${clp(srp.capitalCLP)} disponibles para este grupo familiar, informados al ${fechaCorta(srp.capitalFecha)}. Los pagos deben ser confirmados por la AFP. No incluyen salud, impuestos ni otros descuentos. El total del grupo no es la pensión de una sola persona.`);
    else advertencias.push('Aún no podemos informar cuánto recibiría cada familiar. Revise con su asesor el dinero disponible, los datos de los beneficiarios y sus derechos.');
  }
  const contrato = base || { ...c.sobrevivencia, pensionUF: c.sobrevivencia?.pensionUF ?? ref.uf };
  if (c.sobrevivencia?.proyMeses != null) {
    const proy = proyectarRP(c, fecha);
    if (proy.estado === 'hipotesis') {
      tabla('Planificación hipotética: capital en pesos de poder adquisitivo constante', ['Momento del ejercicio', 'Capital hipotético'],
        proy.puntos.map((punto) => [`Mes ${punto.mes}`, dinero(punto.capitalCLP)]),
        `Se supone un aporte mensual de ${clp(proy.aporteMensualCLP)} y un cambio anual del ahorro de ${proy.tasaRealAnualPct}% después de inflación. Los aportes se realizan al final de cada mes. Estos valores son un ejercicio: pueden existir pérdidas y el resultado futuro puede ser distinto. No cambia su saldo actual.`);
      tabla('Pensión estimada para su planificación', ['Fecha / edad', 'Estimación mensual antes de descuentos', 'Qué debe tener en cuenta'], [
        [`${proy.fechaFutura} / ${proy.edadFutura ?? 'edad pendiente'}`, dinero(proy.pensionHipoteticaCLP),
          proy.pensionHipoteticaCLP != null ? 'Se mantuvieron las condiciones de cálculo del ejercicio. Las condiciones reales futuras pueden cambiar.' : 'Faltan datos o supuestos por revisar con su asesor; todavía no se puede estimar esta pensión.']
      ], 'No se usa esta cifra como pensión actual ni como precio de una renta vitalicia. Las condiciones reales futuras pueden ser distintas.');
    } else advertencias.push('Para mostrar una planificación, acuerde con su asesor el plazo, cuánto aportaría cada mes y los supuestos del ejercicio.');
  }
  if (c.beneficiarios?.length && valido(contrato.pensionUF) && contrato.pensionUF > 0) {
    const sov = escenarioSobrevivencia(contrato, c.beneficiarios, valorUF, pctSobrevivencia);
    tabla('4. Caso familiar: si fallece el titular', ['Beneficiario', 'Porcentaje legal de referencia', 'Pensión mensual orientativa', 'Condición'],
      sov.items.map((b) => [b.nombre || NOMBRES_TIPO[b.tipo] || 'Beneficiario', b.pctLegal > 0 ? `${(b.pctLegal * 100).toFixed(0)}%` : 'Revisar derecho',
        b.pctLegal > 0 ? dinero(b.pensionCLP) : 'Pendiente', b.nota || 'Sujeto a acreditar el derecho']),
      `Porcentajes aplicados a ${base ? 'la oferta base seleccionada' : 'la referencia mensual del expediente'}; no acreditan el derecho. En RP, la AFP recalcula al fallecimiento.${sov.excede100 ? ' La suma supera 100%: requiere revisar la distribución legal.' : ''}`);
  }
  if (presencial.estado === 'comparacion-manual') tabla('5. Comparación con la oferta recibida en oficina', ['Concepto', 'Resultado'], [
    ['Base SCOMP', `${uf(presencial.baseUF)} · ${dinero(presencial.baseCLP)} / mes`],
    ['Presencial, ingreso manual', `${uf(presencial.presencialUF)} · ${dinero(presencial.presencialCLP)} / mes`],
    ['Diferencia mensual presencial menos base', `${uf(presencial.deltaUF)} · ${diferencia(presencial.deltaCLP)}`],
    ['Diferencia en 12 pagos', diferencia(presencial.deltaAnualCLP)],
    ['Referencia del papel', `${presencial.fecha} · ${presencial.referencia}`]
  ], 'Solo comparable bajo iguales condiciones declaradas; no equivale a una aceptación ni verifica el documento físico.');
  if (todas.length > mostradas.length) tabla('Todas las ofertas registradas para revisar con su asesor',
    ['Compañía', 'Antes de descuentos / mes', 'Condiciones informadas'],
    todas.map((o) => [o.aseguradora || 'Compañía no informada', dinero(valorUF ? o.pensionUF * valorUF : null), condiciones(o)]),
    'No se elige automáticamente la oferta con el monto más alto. Revise plazo, coberturas y descuentos antes de comparar.');
  tabla('De dónde salen estos montos', ['Información', 'Cómo interpretarla'], [
    ['Ahorro registrado', `Saldo informado en sus antecedentes${s.capturadoEn || s.saldoAl ? ` al ${fechaCorta(s.capturadoEn || s.saldoAl)}` : '; falta confirmar su fecha'}.`],
    ['Pensión de retiro programado', ref.simulada ? 'Estimación con el ahorro, edad y familia revisados. La AFP debe confirmar cuánto pagaría realmente.'
      : valido(ref.clp) ? 'Monto informado en sus antecedentes. Revise la fecha y si corresponde a su situación actual.' : 'Todavía no se informa un monto: faltan antecedentes por revisar.'],
    ['Ofertas de aseguradoras', todas.length ? 'Montos del documento seleccionado o ingresados por su asesor. Confirme origen, vigencia y condiciones con cada compañía.' : 'No hay ofertas personales cargadas; las fichas de compañías no son cotizaciones.'],
    ['Dinero que recibiría', 'Los montos antes de descuentos no son el dinero final a recibir. Para estimarlo necesitamos su previsión de salud, plan y demás cargos aplicables.']
  ], 'Este documento ayuda a preparar una decisión. No reemplaza la confirmación de la AFP ni la oferta o contrato de la aseguradora.');
  return { titulo: 'Su panorama previsional', cliente: c.nombre || 'Cliente', fecha: fechaCorta(fecha),
    indicadores: [{ etiqueta: 'Saldo obligatorio registrado', valor: dinero(s.obligatorio), detalle: s.capturadoEn ? `Captura ${fechaCorta(s.capturadoEn)}` : s.saldoAl ? `Corte ${fechaCorta(s.saldoAl)}` : 'Fecha no informada' },
      { etiqueta: 'Retiro programado antes de descuentos / mes', valor: dinero(ref.clp), detalle: !valido(ref.clp) ? 'Faltan antecedentes por revisar con su asesor' : ref.simulada ? 'Estimación a su edad actual' : 'Monto informado en sus antecedentes' },
      { etiqueta: 'Cotizaciones de renta vitalicia', valor: String(todas.length), detalle: 'Documentadas o registradas; revisar el origen' },
      ...(documento ? [{ etiqueta: 'Capital destinado en SCOMP', valor: dinero(documento.saldo.obligatorio), detalle: `Emisión ${fechaCorta(documento.scomp.fechaEmision)}; base distinta al saldo AFP` }] : [])],
    ufReferencia: `UF utilizada: ${valorUF ? clp(valorUF) : 'Pendiente'} · ${ufMeta?.fecha || 'sin fecha'} · ${ufMeta?.origen || 'origen no informado'}`,
    advertencias, secciones, siguientePaso: todas.length ? 'Cotejar la oferta elegida, coberturas y vigencia con el asesor antes de firmar. Conservar la comparación presencial como registro separado.'
      : 'Incorporar el SCOMP del cliente y elegir una oferta base para completar la comparación con renta vitalicia. Los cálculos actuales permiten revisar el escenario RP, no decidir un traspaso sin cotización.' };
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderLecturaCliente(m) {
  const secciones = m.secciones.map((s) => {
    if (s.tipo === 'grafico') {
      const max = Math.max(1, ...s.barras.map((b) => b.valor));
      return `<section class="cliente-sec"><h3>${esc(s.titulo)}</h3><figure class="cliente-chart">
        <svg viewBox="0 0 480 ${s.barras.length * 36 + 18}" role="img" aria-label="${esc(s.titulo)}">
        ${s.barras.map((b, i) => `<g><text x="0" y="${i * 36 + 22}" class="cliente-chart__label">${esc(b.etiqueta)}</text>
          <rect x="130" y="${i * 36 + 8}" width="240" height="20" class="cliente-chart__track"></rect>
          <rect x="130" y="${i * 36 + 8}" width="${240 * b.valor / max}" height="20" class="cliente-chart__bar cliente-chart__bar--${['rp', 'oferta', 'presencial'].includes(b.tipo) ? b.tipo : 'caso'}"></rect>
          <text x="478" y="${i * 36 + 22}" text-anchor="end" class="cliente-chart__value">${esc(clp(b.valor))}</text></g>`).join('')}
        </svg><figcaption class="small muted">${esc(s.nota)}</figcaption></figure></section>`;
    }
    return `<section class="cliente-sec"><h3>${esc(s.titulo)}</h3><table class="cliente-tabla"><thead><tr>${s.columnas.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>
      ${s.filas.map((fila) => `<tr>${fila.map((v, i) => `<td data-label="${esc(s.columnas[i])}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="small muted">${esc(s.nota)}</p></section>`;
  }).join('');
  return `<div class="lectura-cliente"><header class="cliente-portada"><p class="small">RESUMEN PARA DECIDIR</p><h2>${esc(m.titulo)}</h2><p>${esc(m.cliente)} · ${esc(m.fecha)}</p><p class="small">${esc(m.ufReferencia)}</p></header>
    <div class="cliente-indicadores">${m.indicadores.map((i) => `<section class="cliente-indicador"><h3>${esc(i.etiqueta)}</h3><strong>${esc(i.valor)}</strong><p class="small">${esc(i.detalle)}</p></section>`).join('')}</div>
    ${m.advertencias.length ? `<aside class="cliente-atencion"><h3>Antes de interpretar los números</h3><ul>${m.advertencias.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></aside>` : ''}
    ${secciones}<section class="cliente-siguiente"><h3>Siguiente paso con su asesor</h3><p>${esc(m.siguientePaso)}</p></section></div>`;
}
