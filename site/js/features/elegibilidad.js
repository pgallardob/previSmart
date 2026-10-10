/* PreviSmart · elegibilidad.js (feature) — render de veredictos. */

import { getClienteActivo, subscribe } from '../core/store.js';
import { evaluarElegibilidad, datosFaltantes } from '../core/elegibilidad.js';
import { getUF, onUF } from '../core/uf.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONOS = {
  success: 'i-circle-check', warning: 'i-triangle-alert',
  danger: 'i-circle-alert', info: 'i-info', pendiente: 'i-hourglass'
};

let unsub = null;

export function init(main) {
  if (unsub) { unsub(); unsub = null; }
  render(main);
  unsub = subscribe(() => render(main));
  const unsubUF = onUF(() => render(main));
  return () => { unsub?.(); unsubUF(); };
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#eleg-vacio');
  const cuerpo = main.querySelector('#eleg-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-badge-check')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente en el panel para evaluar su elegibilidad.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }

  vacio.innerHTML = '';
  cuerpo.hidden = false;

  const veredictos = evaluarElegibilidad(cliente, getUF().valor);
  const zona = main.querySelector('#eleg-veredictos');
  zona.innerHTML = veredictos.map((v) => `
    <article class="veredicto veredicto--${v.estado === 'pendiente' ? 'info' : v.estado}">
      <span class="veredicto__icono">${icono(ICONOS[v.estado])}</span>
      <div>
        <p class="veredicto__titulo">${esc(v.titulo)}</p>
        <p class="veredicto__texto">${esc(v.texto)} <span class="fuente" title="Fuente normativa">${icono('i-info')} ${esc(v.fuente)}</span></p>
      </div>
    </article>`).join('');
}
