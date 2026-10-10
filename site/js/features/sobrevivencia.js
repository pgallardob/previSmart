/* PreviSmart · sobrevivencia.js (feature) — escenarios tras el fallecimiento. */

import { getClienteActivo, guardarSeccion, subscribe } from '../core/store.js';
import { getUF, onUF } from '../core/uf.js';
import { clp, uf } from '../core/format.js';
import { escenarioSobrevivencia } from '../core/liquida.js';
import { pctSobrevivencia } from '../core/elegibilidad.js';
import { NOMBRES_TIPO } from '../core/elegibilidad.js';
import { edadExacta } from '../core/dates.js';
import { NORMATIVA } from '../data/normativa-2026.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;
let unsubUF = null, cableado = null;

export function init(main) {
  if (unsubUF) { unsubUF(); unsubUF = null; }
  cableado = null;
  cablear(main);
  render(main);
  unsubUF = onUF(() => render(main));
  const unsubCliente = subscribe(() => render(main));
  return () => { unsubUF?.(); unsubCliente(); };
}

function leer(main) {
  return {
    ofertaIdx: main.querySelector('#sov-oferta').value,
    pensionUF: num(main.querySelector('#sov-pension').value) || null,
    periodoGarantizadoAnios: Number(main.querySelector('#sov-perg').value) || 0,
    cuotaMortuoriaUF: num(main.querySelector('#sov-mort').value) || null,
    incrementoConyugeUF: num(main.querySelector('#sov-inc').value) || null,
    sobrevConyugePct: Number(main.querySelector('#sov-sobc').value) || null,
    sobrevHijosPct: Number(main.querySelector('#sov-sobh').value) || null
  };
}

function cablear(main) {
  const inputs = ['sov-oferta', 'sov-pension', 'sov-perg', 'sov-mort', 'sov-inc', 'sov-sobc', 'sov-sobh'];
  inputs.forEach((id) => {
    const el = main.querySelector(`#${id}`);
    if (!el || el.dataset.wired) return;
    el.dataset.wired = '1';
    el.addEventListener('input', () => {
      const c = getClienteActivo();
      if (!c) return;
      if (id === 'sov-oferta') {
        const o = el.value === '' ? null : c.ofertas?.[Number(el.value)];
        if (o) {
          main.querySelector('#sov-pension').value = String(o.pensionUF ?? '').replace('.', ',');
          main.querySelector('#sov-perg').value = o.periodoGarantizadoAnios ?? 0;
          main.querySelector('#sov-mort').value = String(o.cuotaMortuoriaUF ?? '').replace('.', ',');
          main.querySelector('#sov-inc').value = String(o.incrementoConyugeUF ?? '').replace('.', ',');
          main.querySelector('#sov-sobc').value = o.sobrevConyugePct ?? '';
          main.querySelector('#sov-sobh').value = o.sobrevHijosPct ?? '';
        }
      }
      guardarSeccion(c.id, 'sobrevivencia', leer(main));
      render(main);
    });
  });
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#sov-vacio');
  const cuerpo = main.querySelector('#sov-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-heart-handshake')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente para simular escenarios de sobrevivencia.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }
  vacio.innerHTML = '';
  cuerpo.hidden = false;

  // poblar selector de ofertas
  const sel = main.querySelector('#sov-oferta');
  const opts = ['<option value="">— manual —</option>']
    .concat((cliente.ofertas || []).map((o, i) => `<option value="${i}">${esc(o.aseguradora)} · ${uf(o.pensionUF)}</option>`));
  const previo = sel.value;
  sel.innerHTML = opts.join('');

  if (cableado !== cliente.id) {
    cableado = cliente.id;
    const d = cliente.sobrevivencia || {};
    sel.value = d.ofertaIdx ?? '';
    if (d.ofertaIdx !== '' && d.ofertaIdx != null) sel.value = d.ofertaIdx;
    main.querySelector('#sov-pension').value = String(d.pensionUF ?? cliente.saldo?.pensionEstimadaUF ?? '').replace('.', ',');
    main.querySelector('#sov-perg').value = d.periodoGarantizadoAnios ?? 0;
    main.querySelector('#sov-mort').value = String(d.cuotaMortuoriaUF ?? NORMATIVA.cuotaMortuoriaMaxUF.valor).replace('.', ',');
    main.querySelector('#sov-inc').value = String(d.incrementoConyugeUF ?? '').replace('.', ',');
    main.querySelector('#sov-sobc').value = d.sobrevConyugePct ?? '';
    main.querySelector('#sov-sobh').value = d.sobrevHijosPct ?? '';
  } else if (previo !== '') sel.value = previo;

  const d = leer(main);
  const ufv = getUF().valor;
  const beneficiarios = cliente.beneficiarios || [];
  const zona = main.querySelector('#sov-resultado');

  if (!d.pensionUF) {
    zona.innerHTML = `<div class="veredicto veredicto--info"><span class="veredicto__icono">${icono('i-info')}</span><div><p class="veredicto__titulo">Ingresa la pensión o elige una oferta</p><p class="veredicto__texto">La simulación usa la pensión del titular y los beneficiarios del perfil.</p></div></div>`;
    return;
  }

  const esc_ = escenarioSobrevivencia(d, beneficiarios, ufv, pctSobrevivencia);

  const filaBenef = (b) => {
    const e = b.fechaNacimiento ? edadExacta(b.fechaNacimiento) : null;
    const dur = duracionTexto(b, e);
    return `<tr>
      <td><strong>${esc(b.nombre || NOMBRES_TIPO[b.tipo] || b.tipo)}</strong><br><span class="tiny muted">${esc(NOMBRES_TIPO[b.tipo] || b.tipo)}${e ? ` · ${e.anios}a` : ''}</span></td>
      <td>${Math.round(b.pctLegal * 100)}%</td>
      <td class="money">${uf(b.pensionUF)}<br><span class="tiny muted">${b.pensionCLP != null ? clp(b.pensionCLP) : ''}</span></td>
      <td class="small muted">${dur}${b.nota ? `<br><span class="tiny">${esc(b.nota)}</span>` : ''}</td>
    </tr>`;
  };

  zona.innerHTML = `
  <article class="card">
    <h3 class="u-mt-0">${icono('i-hourglass')} Si fallece dentro del período garantizado</h3>
      ${esc_.periodoGarantizadoAnios > 0
        ? `<p class="small muted">Los beneficiarios/legítimos herederos reciben <strong>${esc_.mesesGarantia} meses</strong> de pensión (o el resto del período). Luego aplican las pensiones de sobrevivencia de la tabla.</p>`
        : `<p class="small muted"><strong>Sin período garantizado:</strong> el capital no se hereda; quedan solo las pensiones de sobrevivencia legales y la cuota mortuoria.</p>`}
      ${esc_.cuotaMortuoriaUF > 0 ? `<p class="small muted u-mt-2">Cuota mortuoria: <strong>${uf(esc_.cuotaMortuoriaUF)}${ufv ? ` ≈ ${clp(esc_.cuotaMortuoriaUF * ufv)}` : ''}</strong> (tope legal ${NORMATIVA.cuotaMortuoriaMaxUF.valor} UF)</p>` : ''}
      ${esc_.excede100 ? `<div class="veredicto veredicto--warning u-mt-3"><span class="veredicto__icono">${icono('i-triangle-alert')}</span><div><p class="veredicto__titulo">La suma supera el 100%</p><p class="veredicto__texto">Los porcentajes legales se prorratean según el reglamento — verificar distribución con la aseguradora.</p></div></div>` : ''}
    </article>

    <article class="card u-mt-6">
      <h3 class="u-mt-0">${icono('i-heart-handshake')} Si vive muchos años (longevidad)</h3>
      <p class="small muted">La renta vitalicia sigue <strong>fija en UF de por vida</strong> — la aseguradora asume el riesgo de longevidad. Con garantía estatal hasta ${NORMATIVA.garantiaEstatal.topeUFmensual} UF/mes si la aseguradora quiebra.</p>
      <p class="small muted u-mt-2">La pensión del titular: <strong class="money">${uf(d.pensionUF)}${ufv ? ` ≈ ${clp(d.pensionUF * ufv)}` : ''}/mes</strong>, más aumentos diferidos pactados.</p>
    </article>

  <div id="sob-tabla-wrap" class="u-mt-4">
    <table class="tabla">
      <thead><tr><th>Beneficiario</th><th>%</th><th>Pensión sobrev.</th><th>Duración / notas</th></tr></thead>
      <tbody>${esc_.items.length ? esc_.items.map(filaBenef).join('') : `<tr><td colspan="4" class="muted">Sin beneficiarios declarados en el perfil.</td></tr>`}</tbody>
    </table>
  </div>

  <div class="sob-cards u-mt-4">
    ${esc_.items.length ? esc_.items.map((b) => {
      const e = b.fechaNacimiento ? edadExacta(b.fechaNacimiento) : null;
      const dur = duracionTexto(b, e);
      return `
      <article class="card card--flat">
        <div class="u-flex u-items-center u-justify-between u-gap-2 u-wrap">
          <strong>${esc(b.nombre || NOMBRES_TIPO[b.tipo] || b.tipo)}</strong>
          <span class="badge badge--primary">${esc(NOMBRES_TIPO[b.tipo] || b.tipo)} · ${Math.round(b.pctLegal * 100)}%</span>
        </div>
        <p class="money u-mt-2 u-mb-0">${uf(b.pensionUF)}${b.pensionCLP != null ? ` <span class="small muted">≈ ${clp(b.pensionCLP)}</span>` : ''}</p>
        <p class="small muted u-mt-1 u-mb-0">${dur}${b.nota ? ` · ${esc(b.nota)}` : ''}</p>
      </article>`;
    }).join('') : `<p class="muted">Sin beneficiarios declarados en el perfil.</p>`}
  </div>`;
}

function duracionTexto(b, e) {
  switch (b.tipo) {
    case 'conyuge': case 'conviviente': return 'Vitalicia (si cumple plazos de matrimonio)';
    case 'padre_causante': return 'Vitalicia';
    case 'filiacion': return 'Vitalicia';
    case 'hijo': {
      if (b.invalidez === 'total') return 'Vitalicia (invalidez total)';
      if (e && e.anios < 18) return `Hasta los 18 años (${18 - e.anios} a restantes)`;
      if (b.estudiante) return 'Hasta los 24 años si estudia';
      if (b.invalidez === 'parcial') return 'Hasta que cese la invalidez';
      return '—';
    }
    default: return '—';
  }
}
