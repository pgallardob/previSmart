import { clp, clpDec, uf, fechaCorta } from './format.js';
import { pensionReferencia, garantiaEstatal, diferenciasAnuales, coberturaRegistrada, parametroPGUGarantia } from './calculos.js';
import { escenarioSobrevivencia, pensionLiquida } from './liquida.js';
import { evaluarBeneficios } from './beneficios.js';
import { pctSobrevivencia, NOMBRES_TIPO } from './elegibilidad.js';
import { NORMATIVA } from '../data/normativa-2026.js';
import { parseLocal } from './dates.js';
import { simularRP } from './simulacion-rp.js';
import { simularSobrevivenciaRP } from './simulacion-sobrevivencia-rp.js';
import { proyectarRP } from './proyeccion-rp.js';
import { certificadoSCOMP, clienteParaPropuesta, ofertaBaseSCOMP, compararOfertaPresencial } from './consolidacion-scomp.js';
import { modeloLecturaCliente, renderLecturaCliente } from './informe-cliente.js';
import { prepararAseguradoras } from './preparacion-aseguradoras.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cantidad = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const valor = (v) => v == null || v === '' ? 'No informado' : String(v);

/** Whitelisted real-client data and reproducible arithmetic; no imported template identity/quotes. */
export function modeloInformeCalculos(cliente, ufMeta, generadoEn = new Date().toISOString()) {
  if (!cliente) throw new Error('Selecciona un cliente para generar el informe.');
  const original = cliente;
  const source = cliente.scomp?.usarParaPropuesta === true ? certificadoSCOMP(cliente) : null;
  cliente = clienteParaPropuesta(cliente);
  const p = cliente.perfil || {}, s = cliente.saldo || {};
  const vUF = cantidad(ufMeta?.valor) && ufMeta.valor > 0 ? ufMeta.valor : null;
  const pension = pensionReferencia(cliente, vUF, generadoEn.slice(0, 10));
  const secciones = [];
  const agregar = (titulo, filas) => secciones.push({ titulo, filas });
  if (original.scomp?.usarParaPropuesta === true) {
    const cruzados = source ? Object.entries(source.perfil).filter(([key, value]) => p[key] != null && String(p[key]) !== String(value) && key !== 'rut').map(([key]) => key) : [];
    agregar('0. Consolidación de fuentes AFP + SCOMP', source ? [
      ['SCOMP seleccionado', `${valor(source.nombreArchivo)} · documento ${source.documentoId} · SHA-256 ${valor(source.sha256)}`],
      ['Identidad cruzada', 'RUT del SCOMP coincide con el cliente del expediente. La lectura no verifica una firma ni certifica la autenticidad del emisor'],
      ['Emisión SCOMP / captura AFP', `${valor(source.scomp.fechaEmision)} / ${valor(s.capturadoEn)}`],
      ['Capital destinado según SCOMP', `${cantidad(source.saldo.saldoDestinadoUF) ? uf(source.saldo.saldoDestinadoUF) : 'UF no reconocidas'} · ${cantidad(source.saldo.obligatorio) ? clp(source.saldo.obligatorio) : 'pesos no reconocidos'}; no sustituye el saldo obligatorio AFP`],
      ['UF en el SCOMP original', cantidad(source.saldo.ufEmisionCLP) ? clpDec(source.saldo.ufEmisionCLP) : 'No reconocida'],
      ['Diferencias de perfil para cotejo', cruzados.length ? cruzados.join(', ') + '; se conservan los valores declarados y el original SCOMP, sin resolver diferencias a ciegas' : 'Sin diferencias detectadas en los campos reconocidos'],
      ['Beneficiarios informados por SCOMP', source.beneficiarios.length ? source.beneficiarios.map((b) => `${valor(b.tipo)}: ${valor(b.nombre)} · ${valor(b.rut)} · ${valor(b.fechaNacimiento)}`).join('; ') : 'No reconocidos; revisar el original'],
      ['Ofertas del documento', `${source.ofertas.length} ofertas extraídas; las ofertas manuales y de otros documentos no se mezclan con esta fuente seleccionada`],
      ['Bases y fechas distintas', 'Saldo obligatorio AFP, capital destinado SCOMP y cartola no son automáticamente la misma base ni el mismo corte. No se escalan cotizaciones al cambiar el saldo AFP']
    ] : [['Estado', 'SCOMP seleccionado sin identidad/documento válido para este cliente; revisar su importación. No se utilizaron sus ofertas']]);
  }
  agregar('1. Datos del expediente', [
    ['Cliente', valor(cliente.nombre)], ['RUT', valor(p.rut)], ['AFP', valor(p.afp)],
    ['Fecha de nacimiento', valor(p.fechaNacimiento)], ['Sexo declarado', valor(p.sexo)],
    ['Referencia UF', vUF ? `${clpDec(vUF)} / UF · ${valor(ufMeta.fecha)} · ${valor(ufMeta.origen)}` : 'Sin UF válida'],
    ['Emisión propia de PreviSmart', generadoEn.slice(0, 10)]
  ]);
  const capital = [];
  for (const [key, label] of [['obligatorio', 'Saldo obligatorio'], ['apv', 'APV'], ['depositosConvenidos', 'Depósitos convenidos'], ['cotizacionesVoluntarias', 'Cotizaciones voluntarias'], ['cuenta2', 'Cuenta 2']]) {
    capital.push([label, cantidad(s[key]) ? `${clp(s[key])}${vUF ? ` = ${uf(s[key] / vUF)} (referencia)` : ''}` : 'No informado; no se presume cero']);
  }
  capital.push(['Fecha de captura / fuente', `${valor(s.capturadoEn)} / ${valor(s.capturadoPor)}`]);
  if (s.cartolaReferencia) capital.push(['Cartola, corte separado', `${clp(s.cartolaReferencia.obligatorio)} · ${valor(s.cartolaReferencia.saldoAl)}; no sustituye el saldo del portal`]);
  agregar('2. Saldos y conversiones disponibles', capital);
  const pensiones = [[pension.simulada ? 'Pensión bruta de referencia simulada' : 'Pensión mensual del expediente', pension.uf != null ? `${uf(pension.uf)} = ${clp(pension.clp)}` : pension.clp != null ? clp(pension.clp) : 'No informada en las fuentes descargadas'],
    ['Origen', pension.fuente], ['Cálculo desde capital', 'La simulación CNU se detalla por separado; no se deriva por proporción con SCOMPtipo.PDF ni se presenta como pensión informada por AFP']];
  agregar('3. Pensión: fuente y alcance', pensiones);
  const rp = simularRP(cliente, generadoEn.slice(0, 10));
  const filasRP = [
    ['Fuentes actuariales', 'SP, Nota Técnica 9 (noviembre 2024); Compendio Libro III, Anexo 7 Capitales necesarios y Retiro Programado. Tablas oficiales CMF TM2020, incluidas MI para invalidez'],
    ['Método', 'Supervivencia por cohorte con mejoramiento anual. CNU titular = suma de supervivencias descontadas - 11/24. CNU total = titular + componentes familiares. Pensión mensual = saldo / (12 × CNU + meses devengados)'],
    ['Tasa del escenario', rp.parametroTasa ? `${(rp.tasa * 100).toFixed(2)}% anual · ${rp.parametroTasa.desde} a ${rp.parametroTasa.hasta} · ${rp.parametroTasa.fuente} · ${rp.parametroTasa.url} · ${rp.parametroTasa.origen}${rp.parametroTasa.responsable ? `; revisión ${rp.parametroTasa.revisadoEn} por ${rp.parametroTasa.responsable}` : ''}. No es rentabilidad prometida` : 'Sin tasa revisada para la fecha del cálculo'],
    ['Estado', rp.estado === 'simulacion' ? 'SIMULACIÓN ACTUARIAL - NO ES PENSIÓN AFP' : `Pendiente: ${rp.faltantes.join('; ')}`]
  ];
  if (rp.estado === 'simulacion') {
    filasRP.push(['Tipo de escenario', rp.tipoEscenario], ['Inicio informado, distinto de la fecha del ejercicio', rp.fechaInicioInformada || 'No informado / no requerido en este escenario'],
      ['Capital usado', `${clp(rp.capitalCLP)} · ${rp.capitalFuente}; no reemplaza saldos documentales`],
      ['Fecha y edades', `${rp.fecha}; años cumplidos del titular: ${rp.edad}. No proyecta jubilación futura`]);
    for (const [i, c] of rp.componentes.entries()) filasRP.push([`Componente ${i + 1}: ${c.tipo}`, `${c.edad} años · ${c.tabla} · CNU ${c.cnu.toFixed(6)}`]);
    filasRP.push(['CNU total', rp.total.toFixed(6)], ['Meses devengados declarados', String(rp.mesesDevengados)],
      ['Pensión bruta simulada', `${clp(rp.pensionCLP)} / mes${vUF ? ` = ${uf(rp.pensionCLP / vUF)}` : ''}`],
      ['Comisión AFP declarada', rp.comisionCLP != null ? `${rp.comisionPct}% · ${clp(rp.comisionCLP)} / mes · ${rp.comisionReferencia}; después del cargo ${clp(rp.pensionTrasComisionCLP)}, antes de salud e impuesto` : 'No informada; no se presume costo cero'],
      ['Cotejo de condiciones', rp.revisionCondiciones || 'Grupo del escenario simple confirmado; no es acreditación AFP'], ['Alcance y ajustes no incluidos', rp.advertencia]);
  }
  agregar('3A. Retiro programado: simulación actuarial separada', filasRP);
  if (cliente.sobrevivencia?.srpCapitalCLP != null) {
    const srp = simularSobrevivenciaRP(cliente, generadoEn.slice(0, 10));
    agregar('3B. Sobrevivencia RP: grupo y capital remanente separados', srp.estado === 'simulacion' ? [
      ['Capital y fuente', `${clp(srp.capitalCLP)} · ${srp.capitalFecha} · ${srp.referencia}`],
      ['CNU solo beneficiarios', `${srp.total.toFixed(6)} · tasa ${(srp.tasa * 100).toFixed(2)}% · ${srp.parametroTasa.fuente}`],
      ...srp.pensiones.map((b) => [b.nombre || NOMBRES_TIPO[b.tipo], `${clp(b.pensionCLP)} / mes${b.topeCLP != null ? `; tope orfandad ${clp(b.topeCLP)}` : ''}`]),
      ['Total del grupo, no pensión individual', `${clp(srp.totalMensualCLP)} / mes`],
      ['Hijo único de 23 años', srp.mesesRestantesHijo != null ? `Saldo / ${srp.mesesRestantesHijo} meses reales hasta 24, con tope revisado` : 'Regla especial no utilizada'],
      ['Alcance', srp.advertencia]
    ] : [['Estado', `Pendiente: ${srp.faltantes.join('; ')}`]]);
  }
  const escenarios = cliente.sobrevivencia || {};
  if (escenarios.proyMeses != null) {
    const proy = proyectarRP(cliente, generadoEn.slice(0, 10));
    agregar('3C. Planificación hipotética: no es una pensión futura publicada', proy.estado === 'hipotesis' ? [
      ['Período y edad hipotéticos', `${proy.fechaInicio} a ${proy.fechaFutura} · edad futura ${proy.edadFutura ?? 'no calculable'}`],
      ['Capital inicial / aporte mensual', `${clp(proy.capitalInicialCLP)} / ${clp(proy.aporteMensualCLP)}; solo base obligatoria registrada`],
      ['Retorno real / tasa CNU declarados', `${proy.tasaRealAnualPct}% / ${proy.tasaCNUhipoteticaPct ?? 'no declarada'}%; no son promesas ni tasas futuras publicadas`],
      ['Capital final hipotético', clp(proy.capitalFinalCLP)],
      ['Pensión bruta hipotética', proy.pensionHipoteticaCLP != null ? `${clp(proy.pensionHipoteticaCLP)} / mes · CNU ${proy.cnu.total.toFixed(6)}` : `No calculada: ${proy.faltantesPension.join('; ')}`],
      ['Hijos omitidos por superar 24 sin invalidez declarada', proy.omitidos.join('; ') || 'Ninguno'], ['Hipótesis y límites', proy.advertencia]
    ] : [['Estado', `Pendiente: ${proy.faltantes.join('; ')}`]]);
  }
  const ofertas = Array.isArray(cliente.ofertas) ? cliente.ofertas : [];
  const idx = escenarios.ofertaIdx;
  const elegida = ofertaBaseSCOMP(original) || (source ? null : idx !== '' && idx != null && Number.isInteger(Number(idx)) ? ofertas[Number(idx)] : null);
  const base = elegida || { ...escenarios, pensionUF: escenarios.pensionUF ?? pension.uf };
  const baseUF = cantidad(base.pensionUF) && base.pensionUF > 0 ? base.pensionUF : null;
  const cobertura = coberturaRegistrada(base, vUF);
  const filasSov = [['Base del escenario', baseUF ? `${uf(baseUF)} / mes · ${elegida ? 'oferta seleccionada, cotejar original' : escenarios.pensionUF ? 'escenario manual declarado, no oferta oficial' : pension.fuente}` : 'Falta pensión mensual; no se calcula a partir del saldo'],
    ['Porcentaje por beneficiario', 'Pensión de referencia × porcentaje aplicable; requiere acreditar parentesco y condiciones legales']];
  if (cliente.beneficiarios?.length) {
    const escenario = escenarioSobrevivencia({ ...base, pensionUF: baseUF || 0 }, cliente.beneficiarios, vUF, pctSobrevivencia);
    for (const b of escenario.items) filasSov.push([`${valor(b.nombre)} · ${NOMBRES_TIPO[b.tipo] || valor(b.tipo)}`,
      `${b.pctLegal == null ? 'Porcentaje pendiente: revisar hijos comunes AUC' : `${(b.pctLegal * 100).toFixed(0)}% de referencia`} · ${baseUF && b.pensionUF != null ? `${uf(b.pensionUF)}${vUF ? ` / ${clp(b.pensionCLP)}` : ''}` : 'monto pendiente por falta de base o porcentaje'}; no acredita el derecho`]);
    if (escenario.excede100) filasSov.push(['Distribución', 'La suma de porcentajes supera 100%; requiere distribución y validación conforme al régimen aplicable']);
  } else filasSov.push(['Beneficiarios', 'No declarados; esto no permite concluir que no existan beneficiarios legales']);
  filasSov.push(['Plazo garantizado registrado', cobertura.mesesGarantia != null ? `${cobertura.mesesGarantia} meses; no presume una póliza contratada` : 'No informado'],
    ['Aumento temporal registrado', cobertura.aumento?.uf != null ? `${uf(cobertura.aumento.uf)} durante ${cobertura.aumento.meses} meses; base × (1 + aumento / 100)` : 'No informado; no se utilizan cláusulas del certificado de otra persona'],
    ['Cuota mortuoria: límite de referencia', `Hasta ${NORMATIVA.cuotaMortuoriaMaxUF.valor} UF${vUF ? ` = ${clp(NORMATIVA.cuotaMortuoriaMaxUF.valor * vUF)}` : ''}; no es un pago confirmado`]);
  if (pension.simulada && !elegida && !escenarios.pensionUF) filasSov.push(['Origen de los montos orientativos',
    'Porcentajes aplicados automáticamente a la base RP simulada; no son una cobertura contratada. La AFP recalcula al fallecimiento y verifica los derechos de los beneficiarios']);
  agregar('4. Sobrevivencia y coberturas: escenario no oficial', filasSov);
  const parametroPGU = parametroPGUGarantia(generadoEn.slice(0, 10));
  const baseSimulada = (pension.simulada || pension.retiroProgramado === true) && !elegida && !escenarios.pensionUF;
  const garantia = baseUF && !baseSimulada ? garantiaEstatal(baseUF, vUF, parametroPGU) : null;
  agregar('5. Garantía estatal: ejercicio de renta vitalicia', [
    ['Fórmula del certificado de referencia', 'P si P <= G. Si P > G: mínimo de G + 75% × (P - G) y 45 UF. P: renta vitalicia en pesos; G: parámetro PGU'],
    ['Parámetro PGU de referencia', parametroPGU != null ? `${clp(parametroPGU)}; referencia verificada hasta 31/01/2027. Verificar monto y régimen aplicables; no equivale a PGU concedida al cliente` : 'Sin parámetro PGU verificado para la fecha del informe'],
    ['Tope de referencia', `45 UF${vUF ? ` = ${clp(45 * vUF)}` : ''}; el tope no es el monto automáticamente cubierto`],
    ['Resultado aritmético condicionado', garantia ? `${clp(garantia.garantiaCLP)} = ${uf(garantia.garantiaUF)}; no acredita una renta vitalicia contratada ni un pago del Estado` : baseSimulada ? 'La referencia RP no es una renta vitalicia: no se le aplica una garantía de aseguradora' : 'Falta pensión mensual, UF o parámetro PGU verificado para evaluar el ejercicio'],
    ['Pago único del período garantizado', 'Solo se evalúa esa alternativa si no existen beneficiarios legales. No calculado sin póliza, saldo de meses pendientes y tasa/convención de descuento aplicables; una lista vacía no acredita ausencia de beneficiarios. No se copian tasas del ejemplar SCOMP']
  ]);
  const beneficios = evaluarBeneficios(cliente, vUF);
  const liquida = pension.uf != null && ['fonasa', 'isapre'].includes(p.saludTipo)
    ? pensionLiquida(pension.uf, vUF, { tipo: p.saludTipo, planUF: p.saludPlanUF }, new Date(generadoEn)) : null;
  agregar('6. Beneficios y pensión líquida: referencias condicionadas', [
    ['PGU', beneficios.pgu.estado === 'pendiente' ? 'Faltan antecedentes; no se concede un monto automáticamente'
      : `${clp(beneficios.pgu.beneficio)} estimados bajo requisitos declarados. El IPS determina la pensión base y el derecho`],
    ['BAC', beneficios.bac.clp != null ? `${clp(beneficios.bac.clp)} referenciales, sujeto a validación de pensionado, edad y cotizaciones`
      : 'No calculable con meses observados de un documento como si fueran toda la vida laboral'],
    ['CEV', 'Requiere PAFE y factor oficial de corrección; no se incorpora un importe inventado al total'],
    ['Pensión líquida', liquida ? `${clp(liquida.liquida)} = bruta ${clp(liquida.brutaCLP)} - salud ${clp(liquida.saludCLP)} - impuesto ${clp(liquida.impuesto)}; estimación con salud declarada y tabla SII vigente${pension.simulada ? '; base RP simulada, no pensión AFP' : ''}`
      : 'Falta pensión mensual, salud/plano declarado, UF o tabla tributaria vigente. No se presume un plan de salud'],
    ['Tabla tributaria utilizada', liquida ? `${liquida.tablaTributaria.periodo} · ${liquida.tablaTributaria.fuente} · ${liquida.tablaTributaria.url} · ${liquida.tablaTributaria.origen}${liquida.tablaTributaria.responsable ? `; revisión ${liquida.tablaTributaria.revisadoEn} por ${liquida.tablaTributaria.responsable}` : ''}` : 'No se calculó una pensión líquida']
  ]);
  const comparacion = diferenciasAnuales(ofertas, vUF);
  const sc = cliente.scomp || {};
  const vigencia = parseLocal(sc.vigenciaHasta) ? sc.vigenciaHasta < generadoEn.slice(0, 10)
    ? 'Vencida: los importes documentales no se presentan como cotización vigente'
    : parseLocal(sc.vigenciaDesde) && sc.vigenciaDesde > generadoEn.slice(0, 10) ? 'La vigencia todavía no comienza' : 'Dentro de fechas registradas; confirmar con el partícipe'
    : 'Sin vigencia documental verificada';
  agregar('7. Ofertas propias registradas y diferencias anuales', ofertas.length ? [['Vigencia documental', vigencia], ...ofertas.map((o, i) => [valor(o.aseguradora),
    `${uf(comparacion[i].pensionUF)} / mes · ${clp(comparacion[i].pensionCLP)} · diferencia anual ${clp(comparacion[i].diferenciaAnualCLP)}; origen ${o.fuente === 'certificado-scomp' && o.documentoId ? 'certificado propio archivado' : 'ingreso manual o sin evidencia vinculada'}`])]
    : [['Ofertas', 'Sin ofertas propias documentadas: no se generan precios ni nombres de aseguradoras desde SCOMPtipo.PDF']]);
  agregar('8. Método, comprobaciones y datos no disponibles', [
    ['UF a pesos', 'Importe UF × valor UF de referencia. Pesos a UF: importe CLP / valor UF'],
    ['Diferencia anual', '12 × (pensión mensual CLP redondeada - mayor pensión mensual CLP del mismo documento y grupo de cláusulas)'],
    ['Cotizaciones observadas', p.cotizacionesImportadas ? `${p.cotizacionesImportadas.mesesObservados} meses observados; no prueba vida laboral completa` : 'Sin historial importado'],
    ['Datos requeridos no informados', ['fechaNacimiento', 'sexo', 'estadoCivil'].filter((key) => !p[key]).join(', ') || 'Cotejar datos declarados con originales'],
    ['Referencia metodológica', 'SCOMPtipo.PDF, páginas 6, 9 y 11: estructura y relaciones aritméticas. No se importaron datos personales, códigos de consulta ni cotizaciones del ejemplar'],
    ['Fuentes normativas', 'Superintendencia de Pensiones (porcentajes y requisitos); CMF (cláusulas de rentas vitalicias). Fórmulas no equivalen a otorgamiento de beneficios']
  ]);
  if (source) {
    const baseOferta = ofertaBaseSCOMP(original);
    const filas = [['Tipo de documento', 'Escenario propio basado en una oferta extraída del SCOMP; no emite ni acepta una nueva cotización de aseguradora']];
    if (baseOferta) {
      const neta = ['fonasa', 'isapre'].includes(p.saludTipo) ? pensionLiquida(baseOferta.pensionUF, vUF, { tipo: p.saludTipo, planUF: p.saludPlanUF }, new Date(generadoEn)) : null;
      filas.push(['Oferta base original', `${valor(baseOferta.aseguradora)} · código ${valor(baseOferta.codigoOferta)} · ${uf(baseOferta.pensionUF)} / mes`],
        ['Pesos en el documento original', cantidad(baseOferta.pensionCLPdocumento) ? clp(baseOferta.pensionCLPdocumento) : 'No reconocidos'],
        ['Pensión bruta del escenario', vUF ? `${clp(baseOferta.pensionUF * vUF)} / mes; conversión a la UF referencial indicada, sin cambiar el monto original en UF` : 'Falta UF válida'],
        ['Pensión líquida orientativa', neta ? `${clp(neta.liquida)} = bruta ${clp(neta.brutaCLP)} - salud ${clp(neta.saludCLP)} - impuesto ${clp(neta.impuesto)}; no incluye comisiones ni beneficios concedidos` : 'Falta salud/plan declarado, UF válida o tabla tributaria vigente'],
        ['Vigencia del SCOMP', vigencia]);
    } else filas.push(['Oferta base', 'Seleccionar una oferta del SCOMP en Propuesta y ofertas para calcular el escenario final; la elección no acepta el contrato']);
    const comparada = compararOfertaPresencial(original, vUF, generadoEn.slice(0, 10));
    filas.push(['Comparación presencial', comparada.detalle]);
    if (comparada.estado === 'comparacion-manual') filas.push(['Referencia presencial', `${comparada.fecha} · ${comparada.referencia}`],
      ['Monto presencial registrado', `${uf(comparada.presencialUF)} / mes · ${clp(comparada.presencialCLP)}; ingresado manualmente, no verificado por PreviSmart`],
      ['Diferencia mensual presencial menos base', `${uf(comparada.deltaUF)} · ${clp(comparada.deltaCLP)}; valores en la misma UF referencial`],
      ['Diferencia anual aritmética', `${clp(comparada.deltaAnualCLP)} = 12 × diferencia mensual en pesos; solo bajo las condiciones iguales declaradas`]);
    agregar('9. Escenario final consolidado y comparación presencial', filas);
  }
  for (const a of prepararAseguradoras(original)) agregar(`Ficha pública de preparación: ${a.nombre}`, [
    ['Entidad investigada', `${a.razonSocial} · identificador CMF ${a.rutCMF}`],
    ['Modalidades publicadas', a.modalidades.join('; ')], ['Cláusulas publicadas', a.clausulas.join('; ')],
    ['Detalle para preparar la consulta', `${a.distincion} ${a.documentacion}`],
    ['Clasificación del informe consultado', `${a.riesgo.nota} · ${a.riesgo.agencia} · ${a.riesgo.fecha} · ${a.riesgo.perspectiva}`],
    ['Alcance de la clasificación', a.cautela], ['Precio personalizado', a.estadoPrecio], ['Costos', a.costos],
    ['Comparación a solicitar', a.control], ['Observación verificada', a.observacion],
    ['Producto oficial', a.producto], ['Informe alojado en CMF', a.riesgo.url],
    ['Trazabilidad de la investigación', `Revisión ${a.consultadoEn} · SHA-256 del informe consultado ${a.riesgo.sha256}`]
  ]);
  return { titulo: 'PREVISMART - DOCUMENTO (simulación)', subtitulo: 'SIMULACIÓN PREVISIONAL - NO OFICIAL', generadoEn,
    referencia: `PS-${generadoEn.slice(0, 10)}-${String(cliente.id || '').slice(0, 8)}`, secciones,
    lecturaCliente: modeloLecturaCliente(original, ufMeta, generadoEn),
    aviso: 'Documento propio de PreviSmart. No es certificado SCOMP, oferta de aseguradora, aceptación ni contrato. No garantiza pensión ni beneficios. Revisar datos y fuentes antes de decidir.' };
}

export function renderInformeCalculos(modelo, { incluirRevisionAsesor = false } = {}) {
  return `<article class="reporte propuesta" aria-label="Certificado informativo no oficial"><p class="propuesta__aviso"><strong>${esc(modelo.titulo)}</strong></p>
    <p class="small"><strong>${esc(modelo.subtitulo)}</strong></p><p class="small">${esc(modelo.referencia)} · ${esc(fechaCorta(modelo.generadoEn))}</p><p class="small">${esc(modelo.aviso)}</p>
    ${modelo.lecturaCliente ? renderLecturaCliente(modelo.lecturaCliente) : ''}
    ${incluirRevisionAsesor ? `<details class="cliente-anexo"><summary>Revisión interna del asesor</summary>
    ${modelo.secciones.map((s) => `<section class="rep-sec"><h3>${esc(s.titulo)}</h3><table class="rep-tabla"><tbody>${s.filas.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table></section>`).join('')}</details>` : ''}
    <p class="propuesta__aviso"><strong>NO OFICIAL - SIN VALIDEZ PARA ACEPTAR OFERTAS</strong></p>
    <p class="tiny">© 2026 Todos los derechos reservados · Desarrollado por P. Gallardo</p></article>`;
}
