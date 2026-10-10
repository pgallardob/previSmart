/* PreviSmart · ruta.js (feature) — timeline del proceso con plazos reales. */

import { getClienteActivo, guardarSeccion, subscribe } from '../core/store.js';
import { ETAPAS } from '../data/ruta.js';
import { NORMATIVA } from '../data/normativa-2026.js';
import { addDiasHabiles, addDiasCorridos, diasCorridosEntre, diasHabilesEntre, hoy, parseLocal, aISO } from '../core/dates.js';
import { fechaCorta } from '../core/format.js';
import { listarDocumentos } from '../core/documentos.js';
import { evaluarOperacion, resumenGestion } from '../core/operacion.js';
import { toast } from '../ui/toast.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let unsub = null;
let ticketOperacion = 0;

const N = NORMATIVA.plazos;

export function init(main) {
  if (unsub) { unsub(); unsub = null; }
  cablear(main);
  render(main);
  unsub = subscribe(() => render(main));
  return () => { ticketOperacion++; unsub?.(); };
}

function cablear(main) {
  if (main.dataset.wired) return;
  main.dataset.wired = '1';
  main.querySelector('#ruta-gestion-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const c = getClienteActivo();
    if (!c) return;
    try {
      guardarSeccion(c.id, 'ruta', { ...(c.ruta || {}), gestion: {
        participe: main.querySelector('#r-participe').value.trim(), referencia: main.querySelector('#r-referencia').value.trim(),
        fechaEnvio: main.querySelector('#r-envio').value || null, registradoEn: new Date().toISOString()
      } });
      toast('Seguimiento declarado guardado; no constituye envío oficial', 'success');
    } catch (error) { toast(error.message, 'danger'); }
  });
  main.querySelector('#ruta-exportar-gestion')?.addEventListener('click', async () => {
    const c = getClienteActivo();
    if (!c) return;
    try {
      const docs = await listarDocumentos(c.id);
      if (getClienteActivo()?.id !== c.id) throw new Error('El cliente cambió; vuelve a generar el resumen.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([resumenGestion(c, docs)], { type: 'text/plain;charset=utf-8' }));
      link.download = 'prevismart-gestion.txt'; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    } catch (error) { toast(error.message, 'danger'); }
  });

  main.querySelectorAll('[data-fecha]').forEach((el) => {
    el.addEventListener('change', () => {
      const c = getClienteActivo();
      if (!c) return;
      const ruta = { ...(c.ruta || {}), fechas: { ...(c.ruta?.fechas || {}), [el.dataset.fecha]: el.value || null } };
      guardarSeccion(c.id, 'ruta', ruta);
    });
  });

  main.querySelector('#ruta-timeline')?.addEventListener('change', (e) => {
    const chk = e.target.closest('[data-paso]');
    if (!chk) return;
    const c = getClienteActivo();
    if (!c) return;
    const checklist = { ...(c.checklist || {}), [chk.dataset.paso]: chk.checked };
    const etapa = ETAPAS.filter((et) =>
      et.pasos.every((_, i) => checklist[`paso-${et.id}-${i}`]) &&
      (et.acciones || []).every((_, i) => checklist[`acc-${et.id}-${i}`])
    ).length;
    const ruta = { ...(c.ruta || {}), etapa };
    guardarSeccion(c.id, 'checklist', checklist);
    guardarSeccion(c.id, 'ruta', ruta);
  });
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#ruta-vacio');
  const cuerpo = main.querySelector('#ruta-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-route')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente para seguir su proceso de pensión.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }
  vacio.innerHTML = '';
  cuerpo.hidden = false;
  const gestion = cliente.ruta?.gestion || {};
  main.querySelector('#r-participe').value = gestion.participe || '';
  main.querySelector('#r-referencia').value = gestion.referencia || '';
  main.querySelector('#r-envio').value = parseLocal(gestion.fechaEnvio) ? gestion.fechaEnvio : '';
  renderOperacion(main, cliente);

  const fechas = cliente.ruta?.fechas || {};
  const checklist = cliente.checklist || {};

  /* poblar fechas */
  main.querySelectorAll('[data-fecha]').forEach((el) => { el.value = fechas[el.dataset.fecha] || ''; });
  renderPlazos(main, fechas);

  /* timeline */
  const tl = main.querySelector('#ruta-timeline');
  tl.innerHTML = ETAPAS.map((et) => {
    const totalItems = et.pasos.length + (et.acciones || []).length;
    const hechos = et.pasos.filter((_, i) => checklist[`paso-${et.id}-${i}`]).length
      + (et.acciones || []).filter((_, i) => checklist[`acc-${et.id}-${i}`]).length;
    const completa = totalItems > 0 && hechos === totalItems;
    return `
    <article class="timeline__etapa ${completa ? 'timeline__etapa--done' : ''}">
      <span class="timeline__punto">${completa ? icono('i-circle-check') : `<span class="timeline__num">${et.num}</span>`}</span>
      <div class="card timeline__card">
        <div class="u-flex u-items-center u-justify-between u-gap-3 u-wrap">
          <h3 class="u-mt-0 u-mb-0">Etapa ${et.num} — ${esc(et.nombre)}</h3>
          <span class="badge ${completa ? 'badge--success' : 'badge--neutral'}">${hechos}/${totalItems}</span>
        </div>
        <p class="small muted">${esc(et.desc)}</p>
        ${et.plazo ? `<p class="small"><span class="badge badge--info">${icono('i-hourglass')} plazo</span> ${esc(et.plazo.texto)}</p>` : ''}
        <div class="u-mt-2">
          ${et.pasos.map((p, i) => `
          <label class="paso">
            <input type="checkbox" data-paso="paso-${et.id}-${i}" ${checklist[`paso-${et.id}-${i}`] ? 'checked' : ''}>
            <span>${esc(p)}</span>
          </label>`).join('')}
          ${(et.acciones || []).map((a, i) => `
          <label class="paso paso--accion">
            <input type="checkbox" data-paso="acc-${et.id}-${i}" ${checklist[`acc-${et.id}-${i}`] ? 'checked' : ''}>
            <span><span class="tiny muted">[registro]</span> ${esc(a)}</span>
          </label>`).join('')}
        </div>
      </div>
    </article>`;
  }).join('');
}

async function renderOperacion(main, cliente) {
  const ticket = ++ticketOperacion;
  const zona = main.querySelector('#ruta-operacion');
  zona.textContent = 'Revisando documentos archivados…';
  try {
    const documentos = await listarDocumentos(cliente.id);
    if (ticket !== ticketOperacion || !main.isConnected || getClienteActivo()?.id !== cliente.id) return;
    const estado = evaluarOperacion(cliente, documentos);
    zona.innerHTML = `<p class="small"><strong>${estado.completados}/${estado.total} antecedentes registrados</strong> — no equivale a aprobación del trámite.</p>
      <ul>${estado.requisitos.map((r) => `<li><a href="${r.destino}">${esc(r.titulo)}</a> · ${r.hecho ? 'registrado' : 'pendiente'}<p class="tiny muted">${esc(r.detalle)}</p></li>`).join('')}</ul>
      ${estado.portal ? `<a class="btn btn--secondary btn--sm" href="${estado.portal.url}" target="_blank" rel="noopener noreferrer">Abrir sitio oficial de AFP ${esc(estado.portal.nombre)}</a>` : '<p class="small">Selecciona la AFP en Perfil para abrir su sitio oficial.</p>'}
      <a class="btn btn--secondary btn--sm" href="https://www.scomp.cl/participes.html" target="_blank" rel="noopener noreferrer">Consultar partícipes SCOMP</a>
      <a class="btn btn--secondary btn--sm" href="#/captura">Importar documentos recibidos</a>
      ${estado.advertencias.map((a) => `<p class="small muted">${esc(a)}</p>`).join('')}`;
  } catch { if (ticket === ticketOperacion && main.isConnected) zona.textContent = 'No se pudieron revisar los documentos. Reintenta antes de continuar.'; }
}

function renderPlazos(main, fechas) {
  const h = hoy();
  const elCert = main.querySelector('#r-plazo-cert');
  const elVenceCert = main.querySelector('#r-vence-cert');
  const elVenceOfe = main.querySelector('#r-vence-ofe');

  // Solicitud → emisión esperada del certificado (10 días hábiles)
  if (fechas.solicitud && parseLocal(fechas.solicitud)) {
    const limite = addDiasHabiles(fechas.solicitud, N.certSaldoEmisionDiasHabiles);
    const restan = diasHabilesEntre(h, limite);
    elCert.textContent = `Certificado esperado a más tardar ${fechaCorta(aISO(limite))} (${N.certSaldoEmisionDiasHabiles} días hábiles)${restan > 0 ? ` · quedan ${restan} hábiles` : ' · plazo cumplido o vencido'}`;
  } else elCert.textContent = `La AFP emite dentro de ${N.certSaldoEmisionDiasHabiles} días hábiles desde la solicitud.`;

  // Certificado emitido → vencimiento (35 días corridos)
  if (fechas.certEmitido && parseLocal(fechas.certEmitido)) {
    const vence = addDiasCorridos(fechas.certEmitido, N.certSaldoVigenciaDiasCorridos);
    const quedan = diasCorridosEntre(h, vence);
    elVenceCert.innerHTML = `Vence <strong>${fechaCorta(aISO(vence))}</strong> (${N.certSaldoVigenciaDiasCorridos} días corridos)${quedan >= 0 ? ` · quedan <strong>${quedan} días</strong>` : ` · <strong>vencido hace ${-quedan} días</strong>`}`;
  } else elVenceCert.textContent = `El certificado tiene vigencia de ${N.certSaldoVigenciaDiasCorridos} días corridos desde su emisión.`;

  // Ofertas emitidas → vigencia (12 días hábiles)
  if (fechas.ofertasEmitidas && parseLocal(fechas.ofertasEmitidas)) {
    const vence = addDiasHabiles(fechas.ofertasEmitidas, N.ofertasVigenciaDiasHabiles);
    const quedan = diasHabilesEntre(h, vence);
    elVenceOfe.innerHTML = `Ofertas vigentes hasta <strong>${fechaCorta(aISO(vence))}</strong> (${N.ofertasVigenciaDiasHabiles} días hábiles)${vence >= h ? ` · quedan <strong>${quedan} hábiles</strong>` : ` · <strong>vencieron</strong>`}`;
  } else elVenceOfe.textContent = `Las ofertas internas tienen vigencia de ${N.ofertasVigenciaDiasHabiles} días hábiles. Máximo ${N.consultasMaxPorCertificado} consultas por certificado.`;
}
