/* PreviSmart · modalidades.js (feature) — 3 escenarios lado a lado. */

import { getClienteActivo, guardarSeccion, subscribe } from '../core/store.js';
import { getUF, onUF } from '../core/uf.js';
import { clp, uf, pct } from '../core/format.js';
import { NORMATIVA } from '../data/normativa-2026.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

const CAMPOS_SALDO = ['obligatorio', 'apv', 'depositosConvenidos', 'cotizacionesVoluntarias', 'bonoPorHijo', 'otrosBonos', 'bonoReconocimientoMonto'];
let unsubUF = null, clienteCableado = null;

function capitalCliente(c) {
  const s = c?.saldo || {};
  return CAMPOS_SALDO.reduce((acc, k) => {
    if (k === 'bonoReconocimientoMonto') return acc + (Number(s.bonoReconocimiento?.monto) || 0);
    return acc + (Number(s[k]) || 0);
  }, 0);
}

export function init(main) {
  if (unsubUF) { unsubUF(); unsubUF = null; }
  clienteCableado = null;
  render(main);
  unsubUF = onUF(() => render(main));
  const unsubCliente = subscribe(() => render(main));
  return () => { unsubUF?.(); unsubCliente(); };
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#mod-vacio');
  const cuerpo = main.querySelector('#mod-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-scale')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente para simular sus modalidades de pensión.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }

  vacio.innerHTML = '';
  cuerpo.hidden = false;

  const ufv = getUF().valor;
  const capital = capitalCliente(cliente);
  const s = cliente.saldo || {};
  const m = cliente.modalidades || {};

  /* poblar inputs solo la primera vez por cliente (no robar foco al tipear) */
  if (clienteCableado !== cliente.id) {
    clienteCableado = cliente.id;
    const set = (name, val) => { const el = main.querySelector(`[name="${name}"]`); if (el) el.value = el.classList.contains('money') ? String(val ?? '').replace('.', ',') : val ?? ''; };
    set('pensionRVIuf', m.pensionRVIuf ?? '');
    set('pctTemporal', m.pctTemporal ?? 30);
    set('pctRVI', m.pctRVI ?? 50);
    set('aniosDiferimiento', m.aniosDiferimiento ?? 5);
    set('pensionDiferidaUF', m.pensionDiferidaUF ?? '');
  }

  const rviUf = num(main.querySelector('[name="pensionRVIuf"]').value);
  const pctTemporal = Number(main.querySelector('[name="pctTemporal"]').value) || 30;
  const pctRVI = Number(main.querySelector('[name="pctRVI"]').value) || 50;
  const aniosDif = Number(main.querySelector('[name="aniosDiferimiento"]').value) || 5;
  const difUf = num(main.querySelector('[name="pensionDiferidaUF"]').value);

  /* ELD: mostrar si probable */
  const promedio = Number(cliente.perfil?.promedioRemuneraciones) || 0;
  const estUF = Number(s.pensionEstimadaUF) || 0;
  const eldProbable = ufv && promedio > 0 && estUF * ufv >= NORMATIVA.excedenteLibreDisposicion.pctPromedioMinimo * promedio
    && estUF >= NORMATIVA.excedenteLibreDisposicion.pensionMinUF;
  const eldWrap = main.querySelector('#m-eld-wrap');
  eldWrap.hidden = !eldProbable;
  if (eldProbable) main.querySelector('#m-eld').checked = Boolean(m.eld);

  /* equivalencia RVI */
  const rviEquiv = main.querySelector('#m-rvi-equiv');
  if (rviEquiv) rviEquiv.textContent = rviUf > 0 && ufv
    ? `≈ ${clp(rviUf * ufv)}/mes · Valor ingresado por el operador: cotejar con la oferta correspondiente.`
    : 'Ingresa una pensión de renta vitalicia documentada; una estimación AFP no se convierte automáticamente en renta vitalicia.';

  /* ---- escenarios ---- */
  const zona = main.querySelector('#mod-escenarios');
  if (!capital && !rviUf) {
    zona.innerHTML = `<div class="empty u-p-6"><span class="empty__icono">${icono('i-banknote')}</span><p class="empty__titulo">Sin capital ni pensión estimada</p><p>Completa el saldo en el perfil del cliente.</p><a class="btn btn--secondary" href="#/perfil">${icono('i-user-round')} Ir al perfil</a></div>`;
    return;
  }

  const tasaRP = NORMATIVA.retiroProgramado.tasaCalculo;

  const capTemporal = capital * (pctTemporal / 100);
  const capDiferida = capital - capTemporal;
  const difOk = difUf >= NORMATIVA.rentaVitaliciaMinUF.valor;

  /* Capital allocations are proposals, not linear transformations of insurer quotes. */
  const pctR = Math.min(90, Math.max(10, pctRVI)) / 100;
  const capRVI = capital * pctR;
  const capRPresto = capital - capRVI;

  zona.innerHTML = `
  <article class="card">
    <div class="u-flex u-items-center u-justify-between u-gap-2 u-wrap">
      <h3 class="u-mt-0 u-mb-0">${icono('i-refresh-cw')} Retiro programado</h3>
      <span class="badge badge--info">AFP</span>
    </div>
    <p class="stat__valor u-fs-h3">Pendiente de cálculo AFP</p>
    <p class="small muted">Tasa técnica SP: ${pct(tasaRP)} desde octubre 2026. No es rentabilidad del saldo ni permite obtener la pensión dividiendo intereses por 12. Requiere tablas y capital necesario unitario.</p>
    <ul class="small muted u-mt-4 u-mb-0">
      <li>Pensión variable: se recalcula anualmente</li>
      <li>El saldo <strong>es heredable</strong></li>
      <li>Puedes migrar a renta vitalicia después</li>
      <li>Sin mínimo de UF</li>
    </ul>
  </article>

  <article class="card">
    <div class="u-flex u-items-center u-justify-between u-gap-2 u-wrap">
      <h3 class="u-mt-0 u-mb-0">${icono('i-shield-check')} Renta vitalicia inmediata</h3>
      <span class="badge badge--primary">Aseguradora</span>
    </div>
    <p class="stat__valor money u-fs-h3">${rviUf && ufv ? clp(rviUf * ufv) : '—'}</p>
    <p class="small muted">${rviUf ? `≈ ${uf(rviUf)}/mes fija en UF de por vida` : 'ingresa la pensión ofrecida'}</p>
    <ul class="small muted u-mt-4 u-mb-0">
      <li>Pensión <strong>fija en UF</strong> hasta el fallecimiento</li>
      <li>Sin herencia del capital (salvo período garantizado)</li>
      <li>Exige mínimo ${NORMATIVA.rentaVitaliciaMinUF.valor} UF</li>
      <li>Se contrata vía SCOMP con ofertas de aseguradoras</li>
    </ul>
  </article>

  <article class="card">
    <div class="u-flex u-items-center u-justify-between u-gap-2 u-wrap">
      <h3 class="u-mt-0 u-mb-0">${icono('i-git-merge')} Temporal + diferida</h3>
      <span class="badge ${difOk ? 'badge--success' : 'badge--warning'}">${difOk ? 'cumple mínimo' : 'dif < 2 UF'}</span>
    </div>
    <p class="stat__valor u-fs-h3">Cotización temporal pendiente</p>
    <p class="small muted">Diferimiento propuesto: ${aniosDif} años; el importe temporal requiere cálculo AFP.</p>
    <p class="small muted">luego ${difUf ? `${uf(difUf)}${ufv ? ` ≈ ${clp(difUf * ufv)}` : ''}/mes vitalicia` : 'ingresa la pensión diferida'}</p>
    <ul class="small muted u-mt-4 u-mb-0">
      <li>Asignación propuesta al tramo temporal: ${pctTemporal}% del capital (≈${ufv ? clp(capTemporal) : '—'}); no es una pensión ni una distribución aprobada</li>
      <li>Capital propuesto para diferida: ${100 - pctTemporal}% restante (≈${clp(capDiferida)})</li>
      <li>Protege contra la caída futura de tasas</li>
      <li>La diferida exige ≥ ${NORMATIVA.rentaVitaliciaMinUF.valor} UF</li>
    </ul>
  </article>

  <article class="card">
    <div class="u-flex u-items-center u-justify-between u-gap-2 u-wrap">
      <h3 class="u-mt-0 u-mb-0">${icono('i-scale')} RVI + RP combinada</h3>
      <span class="badge badge--accent">Mixta</span>
    </div>
    <p class="stat__valor u-fs-h3">Cotización combinada pendiente</p>
    <p class="small muted">${Math.round(pctR * 100)}% propuesto del capital a aseguradora. Una oferta por todo el capital no se escala linealmente para obtener otra cotización.</p>
    <ul class="small muted u-mt-4 u-mb-0">
      <li>Prima vitalicia: ${pctR * 100}% del capital ≈ ${ufv ? clp(capRVI) : '—'}</li>
      <li>Parte RP heredable ≈ ${ufv ? clp(capRPresto) : '—'}</li>
      <li>Suma herencia parcial + longevidad asegurada</li>
      <li>Solicitar oferta específica para la distribución propuesta</li>
    </ul>
  </article>`;

  /* guardar inputs al cambiar */
  main.querySelectorAll('#form-modalidades input, [name="pensionRVIuf"], [name="pctTemporal"], [name="pctRVI"], [name="aniosDiferimiento"], [name="pensionDiferidaUF"], #m-eld').forEach((el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = '1';
    el.addEventListener('input', () => {
      const m2 = {
        pensionRVIuf: num(main.querySelector('[name="pensionRVIuf"]').value) || null,
        pctTemporal: Number(main.querySelector('[name="pctTemporal"]').value) || null,
        pctRVI: Number(main.querySelector('[name="pctRVI"]').value) || null,
        aniosDiferimiento: Number(main.querySelector('[name="aniosDiferimiento"]').value) || null,
        pensionDiferidaUF: num(main.querySelector('[name="pensionDiferidaUF"]').value) || null,
        eld: main.querySelector('#m-eld')?.checked || false
      };
      guardarSeccion(cliente.id, 'modalidades', m2);
    });
  });
}
