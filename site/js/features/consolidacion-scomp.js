import { getClienteActivo, guardarSeccion } from '../core/store.js';
import { certificadoSCOMP, certificadosSCOMP, compararOfertaPresencial } from '../core/consolidacion-scomp.js';
import { getUF } from '../core/uf.js';
import { uf, clp } from '../core/format.js';
import { toast } from '../ui/toast.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const parseUF = (v) => /^\d+(?:[,.]\d{1,8})?$/.test(v.trim()) ? Number(v.replace(',', '.')) : null;

export function cablearConsolidacion(main) {
  for (const id of ['ofe-fuente-propuesta', 'ofe-scomp-documento', 'ofe-scomp-base']) main.querySelector(`#${id}`).addEventListener('change', (e) => {
    const c = getClienteActivo(); if (!c) return;
    const sc = { ...c.scomp };
    if (id === 'ofe-fuente-propuesta') sc.usarParaPropuesta = e.target.value === 'scomp';
    if (id === 'ofe-scomp-documento') { sc.documentoActivoId = e.target.value; sc.ofertaBaseIdx = null; }
    if (id === 'ofe-scomp-base') sc.ofertaBaseIdx = e.target.value === '' ? null : Number(e.target.value);
    try { guardarSeccion(c.id, 'scomp', sc); } catch (error) { toast(error.message, 'danger'); }
  });
  main.querySelector('#ofe-presencial-form').addEventListener('submit', (e) => {
    e.preventDefault(); const c = getClienteActivo(); if (!c) return;
    const source = certificadoSCOMP(c), idx = c.scomp?.ofertaBaseIdx, base = source?.ofertas?.[idx];
    if (!base || !Number.isInteger(idx)) { toast('Selecciona una oferta base del SCOMP.', 'warning'); return; }
    const form = new FormData(e.target);
    const real = { documentoId: source.documentoId, ofertaBaseIdx: idx, aseguradora: String(form.get('aseguradora') || '').trim(),
      pensionUF: parseUF(String(form.get('pensionUF') || '')), fecha: String(form.get('fecha') || ''),
      referencia: String(form.get('referencia') || '').trim(), mismasCondiciones: form.get('mismasCondiciones') === 'on' };
    const result = compararOfertaPresencial({ ...c, scomp: { ...c.scomp, comparacionPresencial: real } }, getUF().valor);
    if (result.estado === 'pendiente') { toast(result.detalle, 'warning'); return; }
    try { guardarSeccion(c.id, 'scomp', { ...c.scomp, comparacionPresencial: real }); toast('Comparación presencial guardada por separado del SCOMP original.', 'success'); }
    catch (error) { toast(error.message, 'danger'); }
  });
}

export function renderConsolidacion(main, c) {
  const sc = c.scomp || {}, sources = certificadosSCOMP(c), source = certificadoSCOMP(c);
  main.querySelector('#ofe-fuente-propuesta').value = sc.usarParaPropuesta === true ? 'scomp' : 'afp';
  main.querySelector('#ofe-fuente-propuesta option[value="scomp"]').disabled = !sources.length;
  const docs = main.querySelector('#ofe-scomp-documento');
  docs.innerHTML = '<option value="">Seleccionar documento importado</option>' + sources.map((s) => `<option value="${esc(s.documentoId)}">${esc(s.nombreArchivo || s.scomp?.codigoConsulta || 'SCOMP')} · ${esc(s.scomp?.fechaEmision || 'sin fecha')}</option>`).join('');
  docs.value = sc.documentoActivoId || ''; docs.disabled = sc.usarParaPropuesta !== true;
  const selector = main.querySelector('#ofe-scomp-base');
  selector.innerHTML = '<option value="">Seleccionar oferta base; no implica aceptación</option>' + (source?.ofertas || []).map((o, i) => `<option value="${i}">${esc(o.aseguradora)} · ${esc(o.codigoOferta || '')} · ${uf(o.pensionUF)} · garantía ${o.periodoGarantizadoAnios ?? 0} años</option>`).join('');
  selector.value = sc.ofertaBaseIdx ?? ''; selector.disabled = sc.usarParaPropuesta !== true || !source;
  main.querySelector('#ofe-consolidacion-estado').textContent = sc.usarParaPropuesta === true
    ? source ? 'Documentos consolidados: SCOMP seleccionado + datos AFP. Los originales y las diferencias entre fuentes se conservan.' : 'El SCOMP seleccionado no tiene una identidad/documento válido para este cliente; revisar su importación.'
    : 'Propuesta independiente con datos AFP y simulación RP; el SCOMP es opcional.';
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (sc.usarParaPropuesta === true && source?.scomp?.vigenciaHasta && source.scomp.vigenciaHasta < today) main.querySelector('#ofe-consolidacion-estado').textContent += ' Vigencia registrada vencida: solo comparación histórica, no cotización vigente.';
  const real = sc.comparacionPresencial;
  const match = real && real.documentoId === source?.documentoId && real.ofertaBaseIdx === sc.ofertaBaseIdx;
  const form = main.querySelector('#ofe-presencial-form');
  form.hidden = sc.usarParaPropuesta !== true || !source?.ofertas?.[sc.ofertaBaseIdx] || !Number.isInteger(sc.ofertaBaseIdx);
  const keyDraft = JSON.stringify([c.id, source?.documentoId, sc.ofertaBaseIdx]);
  const saved = match ? JSON.stringify(real) : '';
  if (form.dataset.draftKey !== keyDraft || form.dataset.saved !== saved) {
    for (const key of ['aseguradora', 'pensionUF', 'fecha', 'referencia']) form.elements[key].value = match ? real[key] ?? '' : key === 'aseguradora' ? source?.ofertas?.[sc.ofertaBaseIdx]?.aseguradora || '' : '';
    form.elements.mismasCondiciones.checked = Boolean(match && real.mismasCondiciones === true);
    form.dataset.draftKey = keyDraft; form.dataset.saved = saved;
  }
  const result = compararOfertaPresencial(c, getUF().valor);
  main.querySelector('#ofe-presencial-resultado').textContent = result.estado === 'comparacion-manual'
    ? `Diferencia presencial menos base SCOMP: ${uf(result.deltaUF)} / mes${result.deltaCLP != null ? ` · ${clp(result.deltaCLP)} / mes · ${clp(result.deltaAnualCLP)} al año` : ''}. ${result.detalle}` : result.detalle;
}
