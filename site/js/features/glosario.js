/* PreviSmart · glosario.js — conceptos + fuentes oficiales. */

import { TERMINOS } from '../data/glosario.js';
import { NORMATIVA } from '../data/normativa-2026.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function init(main) {
  render(main, '');
  main.querySelector('#glo-buscar')?.addEventListener('input', (e) => render(main, e.target.value));

  const fuentes = main.querySelector('#glo-fuentes');
  if (fuentes) fuentes.innerHTML = NORMATIVA.fuentes.map((f) => `
    <li class="paso">
      <a href="${esc(f.url)}" target="_blank" rel="noopener" class="u-flex u-items-center u-gap-2">
        ${icono('i-external')} ${esc(f.nombre)}
      </a>
    </li>`).join('');
}

function render(main, q) {
  const term = String(q || '').toLowerCase().trim();
  const lista = TERMINOS.filter((t) =>
    !term || t.t.toLowerCase().includes(term) || t.d.toLowerCase().includes(term)
  );
  main.querySelector('#glo-lista').innerHTML = lista.length ? lista.map((t) => `
    <article class="card card--flat">
      <div class="u-flex u-items-center u-justify-between u-gap-3 u-wrap">
        <strong>${esc(t.t)}</strong>
        <span class="badge badge--neutral">${esc(t.s)}</span>
      </div>
      <p class="small muted u-mt-2 u-mb-0">${esc(t.d)}</p>
    </article>`).join('')
    : `<div class="empty"><p class="empty__titulo">Sin resultados</p><p>Prueba con otro término.</p></div>`;
}
