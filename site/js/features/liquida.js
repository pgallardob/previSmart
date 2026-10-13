/* PreviSmart · liquida.js (feature) — pensión bruta → líquida. */

import { getClienteActivo, guardarSeccion, subscribe } from '../core/store.js';
import { getUF, onUF } from '../core/uf.js';
import { clp, uf, pct } from '../core/format.js';
import { pensionLiquida } from '../core/liquida.js';
import { pensionReferencia } from '../core/calculos.js';
import { NORMATIVA, tablaImpuestoVigente } from '../data/normativa-2026.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
let unsubUF = null, cableado = null;
let ultimaFuenteUF = null;

export function init(main) {
  if (unsubUF) { unsubUF(); unsubUF = null; }
  cableado = null;
  cablear(main);
  render(main);
  unsubUF = onUF(() => render(main));
  const unsubCliente = subscribe(() => render(main));
  return () => { unsubUF?.(); unsubCliente(); };
}

function cablear(main) {
  const ids = ['liq-pension', 'liq-salud', 'liq-plan'];
  ids.forEach((id) => {
    const el = main.querySelector(`#${id}`);
    if (!el || el.dataset.wired) return;
    el.dataset.wired = '1';
    el.addEventListener('input', () => {
      const c = getClienteActivo();
      if (!c) return;
      const d = leer(main);
      if (id !== 'liq-pension' && !c.liquida?.pensionUF) d.pensionUF = null;
      guardarSeccion(c.id, 'liquida', d);
      render(main);
    });
  });
}

function leer(main) {
  const planRaw = main.querySelector('#liq-plan').value.trim();
  const plan = planRaw ? Number(planRaw.replace(/\./g, '').replace(',', '.')) : null;
  return {
    pensionUF: num(main.querySelector('#liq-pension').value) || null,
    saludTipo: main.querySelector('#liq-salud').value,
    planUF: Number.isFinite(plan) ? plan : null
  };
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#liq-vacio');
  const cuerpo = main.querySelector('#liq-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-calculator')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente para calcular su pensión líquida.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }
  vacio.innerHTML = '';
  cuerpo.hidden = false;

  const referencia = pensionReferencia(cliente, getUF().valor);
  const fuenteUF = referencia.uf;
  if (cableado !== cliente.id) {
    cableado = cliente.id;
    const d = cliente.liquida || {};
    const p = cliente.perfil || {};
    main.querySelector('#liq-pension').value = String(d.pensionUF ?? fuenteUF ?? '').replace('.', ',');
     main.querySelector('#liq-salud').value = d.saludTipo ?? p.saludTipo ?? '';
    main.querySelector('#liq-plan').value = String(d.planUF ?? p.saludPlanUF ?? '').replace('.', ',');
  } else if (!cliente.liquida?.pensionUF) {
    const input = main.querySelector('#liq-pension');
    if (!input.value.trim() || num(input.value) === ultimaFuenteUF) input.value = String(fuenteUF ?? '').replace('.', ',');
  }
  ultimaFuenteUF = fuenteUF;

  const d = leer(main);
  main.querySelector('#liq-plan-wrap').hidden = d.saludTipo !== 'isapre';

  const zona = main.querySelector('#liq-resultado');
  if (!['fonasa', 'isapre'].includes(d.saludTipo) || (d.saludTipo === 'isapre' && d.planUF == null)) {
    zona.innerHTML = '<div class="veredicto veredicto--info"><div><p class="veredicto__titulo">Declarar previsión de salud y plan</p><p>No se supone Fonasa ni un plan Isapre de costo cero. Completa los datos para calcular la líquida referencial.</p></div></div>';
    return;
  }
  if (!tablaImpuestoVigente()) {
    zona.innerHTML = `<div class="veredicto veredicto--warning"><div><p class="veredicto__titulo">Actualizar tabla tributaria antes de calcular</p><p>No hay una tabla revisada válida para el mes actual en Chile. En <a href="#/ajustes">Ajustes → Parámetros de cálculo</a> puedes cargar la tabla SII del período sin reinstalar la aplicación. No se reutiliza una tabla vencida.</p></div></div>`;
    return;
  }
  const r = pensionLiquida(d.pensionUF, getUF().valor, { tipo: d.saludTipo, planUF: d.planUF });

  if (!r) {
    zona.innerHTML = `<div class="veredicto veredicto--info"><span class="veredicto__icono">${icono('i-info')}</span><div><p class="veredicto__titulo">Ingresa la pensión bruta</p><p class="veredicto__texto">Se calcula con la UF vigente.</p></div></div>`;
    return;
  }
  const cargoAFP = referencia.simulada && !cliente.liquida?.pensionUF ? referencia.escenario?.comisionCLP : null;

  zona.innerHTML = `
  <p class="small muted">${esc(cliente.liquida?.pensionUF ? 'Escenario manual del operador' : referencia.fuente)}${referencia.simulada && !cliente.liquida?.pensionUF ? ' · Simulación bruta RP reutilizada automáticamente; no es una pensión AFP.' : ''}</p>
  <section class="card card--accent">
    <div class="u-flex u-items-center u-justify-between u-gap-4 u-wrap">
      <div class="stat">
        <span class="stat__label">Pensión líquida estimada${cargoAFP != null ? ' antes del cargo AFP declarado' : ''}</span>
        <span class="stat__valor money">${clp(r.liquida)}</span>
        <span class="stat__uf">≈ ${uf(r.liquidaUF)}/mes · tasa de descuento ${pct(r.tasaEfectiva)}</span>
      </div>
    </div>
  </section>
  ${cargoAFP != null ? `<section class="card card--flat u-mt-3"><h3 class="u-mt-0">Cargo AFP declarado en el escenario RP</h3><p class="small">${clp(cargoAFP)} / mes · ${esc(referencia.escenario.comisionReferencia)}.</p><p class="small">Después de salud, impuesto y este cargo: <strong>${clp(Math.max(0, r.liquida - cargoAFP))} / mes</strong>. No se presume que la comisión reduzca la base tributaria.</p></section>` : ''}

  <article class="card card--flat u-mt-4">
    <h3 class="u-mt-0">Desglose</h3>
    <table class="tabla tabla--desglose">
      <colgroup><col class="c-label"><col class="c-monto"><col class="c-uf"></colgroup>
      <tbody>
        <tr><td>Pensión bruta</td><td class="money">${clp(r.brutaCLP)}</td><td class="tiny muted">${uf(r.brutaUF)}</td></tr>
        <tr><td>− Salud (${d.saludTipo === 'isapre' ? `plan ${uf(d.planUF)}` : '7% Fonasa'})</td><td class="money">${clp(r.saludCLP)}</td><td class="tiny muted">${uf(r.saludUF)}</td></tr>
        <tr><td>− Impuesto único</td><td class="money">${clp(r.impuesto)}</td><td class="tiny muted">${r.impuesto > 0 ? pct(r.impuesto / r.brutaCLP) + ' ef.' : 'exento'}</td></tr>
        <tr><td><strong>= Líquida</strong></td><td class="money"><strong>${clp(r.liquida)}</strong></td><td class="tiny muted">${uf(r.liquidaUF)}</td></tr>
      </tbody>
    </table>
    <p class="tiny muted u-mt-2 u-mb-0">Imponible ${clp(r.imponible)} · exento hasta ${clp(r.tablaTributaria.tramos[0].hasta)} · ${esc(r.tablaTributaria.fuente)} · ${esc(r.tablaTributaria.periodo)} (${esc(r.tablaTributaria.origen)})</p>
  </article>

  <article class="card card--flat u-mt-6">
    <h3 class="u-mt-0">Con beneficios del Seguro Social</h3>
    <p class="small muted" id="liq-con-beneficios">—</p>
  </article>`;

  // Líquida + beneficios estimados
  const elB = main.querySelector('#liq-con-beneficios');
  import('../core/beneficios.js').then(({ evaluarBeneficios }) => {
    const b = evaluarBeneficios(cliente, getUF().valor);
    const extra = (b.total.pguCLP || 0) + (b.total.bacCLP || 0);
    elB.innerHTML = extra > 0
      ? `La líquida anterior no incluye PGU ni BAC. Con ellos: <strong class="money">${clp(r.liquida + extra)}</strong>/mes (PGU ${clp(b.total.pguCLP)} + BAC ${clp(b.total.bacCLP)}).`
      : 'Sin beneficios estatales estimados. Ver detalle en el módulo Beneficios.';
  });
}
