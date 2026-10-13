import { clp, clpDec, uf, fechaCorta } from './format.js';
import { parseLocal } from './dates.js';
import { etiquetaOrigen } from './uf.js';
import { modeloInformeCalculos, renderInformeCalculos } from './informe-calculos.js';
import { clienteParaPropuesta } from './consolidacion-scomp.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const monto = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export function fuenteOferta(oferta) {
  if (oferta.fuente === 'certificado-scomp' && oferta.documentoId) return 'Extraído de un certificado archivado; cotejar con el original';
  if (oferta.fuente === 'edicion-manual') return 'Modificado manualmente; no equivale al dato original del certificado';
  if (oferta.fuente === 'demostracion') return 'Demostración sintética; no usar para una decisión real';
  return 'Ingresado manualmente o sin evidencia documental vinculada';
}

/** Render an independent, non-official proposal, never a fabricated SCOMP certificate. */
export function crearPropuesta(cliente, ufMeta, generadoEn = new Date().toISOString()) {
  if (!cliente) return '';
  cliente = clienteParaPropuesta(cliente);
  const valorUF = monto(ufMeta?.valor) > 0 ? ufMeta.valor : null;
  const fecha = generadoEn.slice(0, 10);
  const ofertas = Array.isArray(cliente.ofertas) ? cliente.ofertas : [];
  const saldo = monto(cliente.saldo?.obligatorio);
  const sc = cliente.scomp || {};
  const vigencia = parseLocal(sc.vigenciaHasta)
    ? sc.vigenciaHasta < fecha ? 'Vencida según la fecha registrada; no presentar como cotización vigente.'
      : parseLocal(sc.vigenciaDesde) && sc.vigenciaDesde > fecha ? 'Todavía no comienza según las fechas registradas.'
        : 'Dentro de las fechas registradas; confirmar vigencia con el partícipe.'
    : 'Sin vigencia documental verificable; confirmar con el partícipe.';
  const detalle = `<article class="reporte propuesta" aria-label="Detalle de ofertas y fuentes para el asesor">
    <p class="propuesta__aviso"><strong>PROPUESTA NO OFICIAL · SIN VALIDEZ PARA ACEPTAR OFERTAS</strong></p>
    <header class="rep-head"><div><h2 class="rep-titulo">Propuesta comparativa previsional</h2>
      <p class="small">PreviSmart · elaboración ${esc(fechaCorta(fecha))}</p></div>
      <div><p class="small">Conversión UF a CLP</p><strong>${valorUF ? clpDec(valorUF) : 'Sin valor UF válido'}</strong>
      <p class="tiny">${esc(fechaCorta(ufMeta?.fecha))} · ${esc(etiquetaOrigen(ufMeta || {}))}</p></div></header>
    <p class="small">Documento informativo propio de PreviSmart. No es un Certificado de Ofertas SCOMP, cotización emitida por una aseguradora, solicitud, aceptación ni contrato. No genera derechos ni garantiza una pensión.</p>
    ${!valorUF || ufMeta?.fecha !== fecha ? '<p class="small"><strong>Conversión UF pendiente de revisión:</strong> falta un valor válido de la fecha de elaboración. Los pesos mostrados, si existen, usan la referencia fechada indicada y no una UF actual verificada.</p>' : ''}
    ${cliente.ingesta?.demostracion ? '<p><strong>DEMOSTRACIÓN: datos sintéticos.</strong></p>' : ''}
    <section class="rep-sec"><h3>Antecedentes disponibles</h3><table class="rep-tabla"><tbody>
      <tr><td>Cliente</td><td>${esc(cliente.perfil?.nombre || cliente.nombre || 'Sin registrar')}</td></tr>
      <tr><td>RUT</td><td>${esc(cliente.perfil?.rut || 'Sin registrar')}</td></tr>
      <tr><td>AFP</td><td>${esc(cliente.perfil?.afp || 'Sin registrar')}</td></tr>
      <tr><td>Saldo obligatorio registrado</td><td>${saldo != null ? clp(saldo) : 'Sin dato de fuente'} · no equivale al capital final certificado para pensionarse</td></tr>
       <tr><td>Origen y fechas del saldo</td><td>${esc(cliente.saldo?.capturadoPor || 'Origen sin confirmar')} · captura ${esc(fechaCorta(cliente.saldo?.capturadoEn))} · corte documental registrado ${esc(fechaCorta(cliente.saldo?.saldoAl))}. La captura no prueba que el monto corresponda al corte de una cartola.</td></tr>
       ${cliente.saldo?.cartolaReferencia ? `<tr><td>Cartola archivada, referencia separada</td><td>${clp(cliente.saldo.cartolaReferencia.obligatorio)} · corte ${esc(fechaCorta(cliente.saldo.cartolaReferencia.saldoAl))}. No reemplaza el saldo capturado en el portal. La diferencia entre cortes no demuestra por sí sola un error ni cotizaciones impagas.</td></tr>` : ''}
      <tr><td>Documento de referencia</td><td>${sc.codigoConsulta ? `Consulta registrada ${esc(sc.codigoConsulta)} · emisión ${esc(fechaCorta(sc.fechaEmision))}` : 'No hay consulta oficial registrada'}</td></tr>
    </tbody></table><p class="small">${esc(vigencia)}</p></section>
    ${Array.isArray(cliente.ingesta?.eventos) && cliente.ingesta.eventos.some((e) => e?.conflictos?.length) ? '<p class="small"><strong>Hay diferencias en el historial de ingesta.</strong> Revisar fuentes, fechas y montos en Captura; no asumir que son datos del mismo corte.</p>' : ''}
    <section class="rep-sec"><h3>Alternativas registradas (${ofertas.length})</h3>
      ${ofertas.length ? ofertas.map((o) => {
        const pension = monto(o.pensionUF), prima = monto(o.primaUF);
        return `<div class="rep-oferta"><h4>${esc(o.aseguradora || 'Entidad sin identificar')}</h4>
          <p class="small"><strong>Origen:</strong> ${esc(fuenteOferta(o))}</p>
          <dl class="rep-oferta__grid">
            <div><dt>Pensión mensual registrada</dt><dd>${pension != null ? `${uf(pension)}${valorUF ? ` · ${clp(pension * valorUF)}` : ''}` : 'Sin dato'}</dd></div>
            <div><dt>Prima registrada</dt><dd>${prima != null ? uf(prima) : 'Sin dato'}</dd></div>
            <div><dt>Período garantizado registrado</dt><dd>${monto(o.periodoGarantizadoAnios) != null ? `${esc(o.periodoGarantizadoAnios)} años` : 'Sin dato'}</dd></div>
            <div><dt>Clasificación declarada</dt><dd>${esc(o.clasificacion || 'Sin dato')} · no certificada por PreviSmart</dd></div>
            <div><dt>Cuota mortuoria registrada</dt><dd>${monto(o.cuotaMortuoriaUF) != null ? uf(o.cuotaMortuoriaUF) : 'Sin dato'}</dd></div>
            <div><dt>Comisión registrada</dt><dd>${monto(o.comisionUF) != null ? uf(o.comisionUF) : 'Sin dato'}</dd></div>
            <div><dt>Sobrevivencia cónyuge / hijos</dt><dd>${monto(o.sobrevConyugePct) != null ? `${esc(o.sobrevConyugePct)}%` : 'Sin dato'} / ${monto(o.sobrevHijosPct) != null ? `${esc(o.sobrevHijosPct)}%` : 'Sin dato'}</dd></div>
            <div><dt>Tasa de descuento registrada</dt><dd>${monto(o.tasaDescuentoPct) != null ? `${esc(o.tasaDescuentoPct)}%` : 'Sin dato'}</dd></div>
            <div><dt>Aumento temporal registrado</dt><dd>${monto(o.aumentoTemporalPct) != null ? `${esc(o.aumentoTemporalPct)}% por ${esc(o.aumentoTemporalMeses ?? 'plazo no registrado')} meses` : 'Sin dato'}</dd></div>
            <div><dt>Aumento diferido registrado</dt><dd>${monto(o.aumentoDiferidoPct) != null ? `${esc(o.aumentoDiferidoPct)}% desde el mes ${esc(o.aumentoDiferidoMes ?? 'no registrado')}` : 'Sin dato'}</dd></div>
          </dl>
          <p class="tiny">${o.codigoOferta ? `Referencia del registro: ${esc(o.codigoOferta)}. ` : ''}${o.documentoId ? `Documento vinculado: ${esc(o.documentoId)}. ` : ''}La conversión a pesos es referencial con la UF indicada; no actualiza ni reemite la oferta.</p>
          <p class="small">${esc(o.notas || 'Revisar coberturas y condiciones completas en el documento original.')}</p></div>`;
      }).join('') : '<p>La propuesta y la simulación RP se elaboran sin SCOMP con los datos disponibles. No hay cotizaciones comerciales de aseguradoras registradas; esa ausencia no bloquea los cálculos propios ni la descarga del documento. El precio de una renta vitalicia y su aceptación corresponden al emisor.</p>'}
    </section>
    <section class="rep-sec"><h3>Condiciones antes de decidir</h3><ul>
      <li>Cotejar identidad, capital destinado a pensión y todos los beneficiarios con los documentos originales.</li>
      <li>Comparar montos, coberturas, garantías, comisiones y solvencia vigente con el partícipe, no solo la pensión mensual.</li>
      <li>No se incorporan beneficios estatales ni pensión líquida como importes garantizados en esta propuesta.</li>
      <li>La aceptación requiere el procedimiento y los documentos oficiales; esta propuesta no sirve para aceptar una oferta.</li>
    </ul></section>
    <p class="propuesta__aviso"><strong>PROPUESTA NO OFICIAL — cotejar con fuentes y partícipe autorizado.</strong></p>
    <p class="tiny">Datos personales: compartir solo con el destinatario autorizado. © 2026 Todos los derechos reservados · Desarrollado por P. Gallardo</p>
  </article>`;
  return `${renderInformeCalculos(modeloInformeCalculos(cliente, ufMeta, generadoEn))}<details class="cliente-anexo"><summary>Detalle complementario de ofertas para el asesor</summary>${detalle}</details>`;
}
