/* PreviSmart · checklist.js (feature) — carpeta documental, preguntas,
   errores comunes y las 10 comprobaciones finales. Persistido por cliente. */

import { getClienteActivo, guardarSeccion, subscribe } from '../core/store.js';
import { CHECKLIST_GRUPOS, ERRORES_COMUNES } from '../data/checklist.js';
import { COMPROBACIONES_FINALES } from '../data/ruta.js';
import { abrirDialog, cerrarDialog, cablearCierre } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let unsub = null;

export function init(main) {
  if (unsub) { unsub(); unsub = null; }
  cablear(main);
  render(main);
  unsub = subscribe(() => render(main));
  return unsub;
}

function cablear(main) {
  if (main.dataset.wired) return;
  main.dataset.wired = '1';

  main.addEventListener('change', (e) => {
    const chk = e.target.closest('[data-chk]');
    if (!chk) return;
    const c = getClienteActivo();
    if (!c) return;
    const checklist = { ...(c.checklist || {}), [chk.dataset.chk]: chk.checked };
    guardarSeccion(c.id, 'checklist', checklist);
  });

  main.querySelector('#chk-reset')?.addEventListener('click', () => {
    const c = getClienteActivo();
    if (!c) return;
    guardarSeccion(c.id, 'checklist', {});
    toast('Checklist limpiado', 'info');
  });
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#chk-vacio');
  const cuerpo = main.querySelector('#chk-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-clipboard-check')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente para usar su checklist documental.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }
  vacio.innerHTML = '';
  cuerpo.hidden = false;

  const chk = cliente.checklist || {};
  let totalItems = 0, totalOk = 0;

  /* 10 comprobaciones finales */
  const fin = COMPROBACIONES_FINALES.map((t, i) => {
    const key = `final-${i}`;
    const done = Boolean(chk[key]);
    totalItems++; if (done) totalOk++;
    return `<label class="paso"><input type="checkbox" data-chk="${key}" ${done ? 'checked' : ''}><span>${i + 1}. ${esc(t)}</span></label>`;
  }).join('');
  main.querySelector('#chk-finales-lista').innerHTML = fin;
  const finOk = COMPROBACIONES_FINALES.filter((_, i) => chk[`final-${i}`]).length;
  const finBadge = main.querySelector('#chk-finales-count');
  if (finBadge) {
    finBadge.textContent = `${finOk}/${COMPROBACIONES_FINALES.length}`;
    finBadge.className = `badge ${finOk === COMPROBACIONES_FINALES.length ? 'badge--success' : 'badge--neutral'}`;
  }

  /* grupos */
  main.querySelector('#chk-grupos').innerHTML = CHECKLIST_GRUPOS.map((g) => {
    const items = g.items.map((it) => {
      const key = `chk-${g.id}-${it.id}`;
      const done = Boolean(chk[key]);
      totalItems++; if (done) totalOk++;
      return `<label class="paso"><input type="checkbox" data-chk="${key}" ${done ? 'checked' : ''}><span>${esc(it.texto)}${it.cat ? ` <span class="tiny muted">(${esc(it.cat)})</span>` : ''}</span></label>`;
    }).join('');
    const hechos = g.items.filter((it) => chk[`chk-${g.id}-${it.id}`]).length;
    return `
    <details class="card">
      <summary class="u-flex u-items-center u-justify-between u-gap-3">
        <strong>${icono(g.icono)} ${esc(g.titulo)}</strong>
        <span class="badge ${hechos === g.items.length ? 'badge--success' : 'badge--neutral'}">${hechos}/${g.items.length}</span>
      </summary>
      <p class="tiny muted">Fuente: ${esc(g.fuente)}</p>
      <div class="lista">${items}</div>
    </details>`;
  }).join('');

  /* errores comunes */
  main.querySelector('#chk-errores').innerHTML = ERRORES_COMUNES.map((e) => `<li>${icono('i-triangle-alert')} ${esc(e)}</li>`).join('');

  /* resumen */
  const bar = main.querySelector('[data-progreso]');
  const pctTotal = Math.round((totalOk / totalItems) * 100);
  if (bar) bar.style.width = pctTotal + '%';
  const res = main.querySelector('#chk-resumen');
  if (res) res.textContent = `${totalOk} de ${totalItems} ítems (${pctTotal}%)`;
}
