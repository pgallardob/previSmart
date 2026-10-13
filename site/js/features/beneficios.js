/* PreviSmart · beneficios.js (feature) — tarjetas de beneficios estatales. */

import { getClienteActivo, subscribe } from '../core/store.js';
import { evaluarBeneficios } from '../core/beneficios.js';
import { getUF, onUF } from '../core/uf.js';
import { clp, uf, pct } from '../core/format.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONOS = { success: 'i-circle-check', warning: 'i-triangle-alert', danger: 'i-circle-alert', info: 'i-info', pendiente: 'i-hourglass', na: 'i-info' };

let unsub = null, unsubUF = null;

export function init(main) {
  if (unsub) { unsub(); unsub = null; }
  if (unsubUF) { unsubUF(); unsubUF = null; }
  render(main);
  unsub = subscribe(() => render(main));
  unsubUF = onUF(() => render(main));
  return () => { unsub?.(); unsubUF?.(); };
}

function cardBeneficio({ iconoNombre, titulo, monto, detalle, supuestos, estado }) {
  return `
  <article class="veredicto veredicto--${estado === 'pendiente' || estado === 'na' ? 'info' : estado}">
    <span class="veredicto__icono">${icono(estado === 'pendiente' ? 'i-hourglass' : iconoNombre)}</span>
    <div class="u-flex u-items-center u-justify-between u-gap-3 u-wrap u-w-full">
      <div>
        <p class="veredicto__titulo">${esc(titulo)}</p>
        <p class="veredicto__texto">${esc(detalle)}</p>
        ${supuestos?.length ? `<p class="tiny muted u-mt-2 u-mb-0">${supuestos.map(esc).join('<br>')}</p>` : ''}
      </div>
      ${monto != null ? `<span class="money u-fs-h3">${monto}</span>` : ''}
    </div>
  </article>`;
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#benef-vacio');
  const cuerpo = main.querySelector('#benef-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-landmark')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente en el panel para estimar sus beneficios estatales.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }

  vacio.innerHTML = '';
  cuerpo.hidden = false;

  const r = evaluarBeneficios(cliente, getUF().valor);

  /* ---- total ---- */
  const elTotal = main.querySelector('#benef-total');
  elTotal.innerHTML = r.total.completo ? `
    <div class="stat">
      <span class="stat__label">Pensión total estimada mensual</span>
      <span class="stat__valor money">${clp(r.total.totalCLP)}</span>
      <span class="stat__uf">
        pensión ${clp(r.total.pensionCLP)}
        ${r.total.pguCLP ? ` + PGU ${clp(r.total.pguCLP)}` : ''}
        ${r.total.bacCLP ? ` + BAC ${clp(r.total.bacCLP)}` : ''}
      </span>
      <span class="stat__label">${esc(r.total.fuente)}${r.total.simulada ? ' · Base con saldo obligatorio actual y edades cumplidas; no proyecta la jubilación futura ni concede beneficios.' : ''}</span>
    </div>
    <span class="badge badge--primary">${icono('i-landmark')} ${esc(cliente.nombre)}</span>`
  : `
    <div class="stat">
      <span class="stat__valor u-fs-h3">Falta la pensión estimada</span>
      <span class="stat__label">Se completa automáticamente con una pensión informada o con la simulación CNU cuando sus antecedentes están completos. No requiere un SCOMP.</span>
    </div>
    <a class="btn btn--secondary btn--sm" href="#/sobrevivencia">${icono('i-calculator')} Revisar datos de simulación</a>`;

  /* ---- tarjetas ---- */
  const cards = [];

  cards.push(cardBeneficio({
    iconoNombre: 'i-landmark',
    titulo: 'PGU — Pensión Garantizada Universal',
    monto: r.pgu?.beneficio != null && r.pgu.beneficio > 0 ? clp(r.pgu.beneficio) : null,
    detalle: r.pgu?.detalle || '',
    supuestos: r.pgu?.supuestos,
    estado: r.pgu?.estado || 'pendiente'
  }));

  cards.push(cardBeneficio({
    iconoNombre: 'i-calendar-days',
    titulo: 'BAC — Beneficio por Años Cotizados',
    monto: r.bac?.clp != null ? `${clp(r.bac.clp)} (${r.bac.uf.toFixed(2)} UF)` : null,
    detalle: r.bac?.detalle || '',
    estado: r.bac?.estado || 'pendiente'
  }));

  cards.push(cardBeneficio({
    iconoNombre: 'i-heart-handshake',
    titulo: 'CEV — Compensación por Expectativa de Vida (mujeres)',
    monto: r.cev?.ufMax != null ? `${r.cev.ufMin.toFixed(2)}–${r.cev.ufMax.toFixed(2)} UF (${Math.round(r.cev.pct * 100)}%)` : null,
    detalle: r.cev?.detalle || '',
    supuestos: r.cev?.supuestos,
    estado: r.cev?.estado || 'pendiente'
  }));

  cards.push(cardBeneficio({
    iconoNombre: 'i-shield-check',
    titulo: 'Garantía estatal ante quiebra de la aseguradora',
    monto: `${r.garantia.topeUF} UF/mes tope`,
    detalle: r.garantia.calculo
      ? `Ejercicio referencial de renta vitalicia: ${clp(r.garantia.calculo.garantiaCLP)} de garantía calculada, con parámetro PGU ${clp(r.garantia.calculo.parametroPGU)}. No acredita una renta vitalicia contratada ni un pago del Estado.`
      : r.garantia.baseRP ? 'La base actual corresponde a retiro programado, no a una renta vitalicia contratada. No se le aplica la garantía por quiebra de una aseguradora.'
        : `${r.garantia.detalle} Fórmula: P si P ≤ G; si P > G, mínimo de G + 75% × (P − G) y 45 UF. Requiere pensión mensual, UF y parámetro PGU verificado para evaluar el ejercicio.`,
    estado: 'info'
  }));

  cards.push(cardBeneficio({
    iconoNombre: 'i-banknote',
    titulo: 'Cuota mortuoria',
    monto: `${r.cuotaMortuoria.topeUF} UF tope`,
    detalle: r.cuotaMortuoria.detalle,
    estado: 'info'
  }));

  main.querySelector('#benef-lista').innerHTML = cards.join('');
}
