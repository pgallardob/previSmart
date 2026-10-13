/* PreviSmart · perfil.js — expediente completo del cliente.
   Autosave en cada cambio (debounce), beneficiarios dinámicos,
   equivalencias UF en vivo y resumen de capital previsional. */

import {
  getClienteActivo, guardarSeccion, actualizarCliente, subscribe, getCliente
} from '../core/store.js';
import { getUF, onUF } from '../core/uf.js';
import { clp, uf, clpAuf } from '../core/format.js';
import { edadExacta } from '../core/dates.js';
import { pctSobrevivencia, NOMBRES_TIPO } from '../core/elegibilidad.js';
import { NORMATIVA } from '../data/normativa-2026.js';
import { abrirDialog, cerrarDialog, cablearCierre } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

const CAMPOS_SALDO_PENSION = ['obligatorio', 'apv', 'depositosConvenidos', 'cotizacionesVoluntarias', 'bonoPorHijo', 'otrosBonos', 'bonoReconocimientoMonto'];
let unsubscribeCliente = null;

export function init(main) {
  if (unsubscribeCliente) { unsubscribeCliente(); unsubscribeCliente = null; }
  cablearCierre(main.querySelector('#dlg-beneficiario'));
  render(main);
  unsubscribeCliente = subscribe(() => render(main));
  const guardarPendiente = () => {
    if (!timerGuardar) return;
    clearTimeout(timerGuardar); timerGuardar = null;
    const cliente = getCliente(main.querySelector('#form-perfil')?.dataset.wired);
    if (cliente) guardarAhora(main, cliente);
  };
  window.addEventListener('prevismart:antes-de-recargar', guardarPendiente);
  const unsubUF = onUF(() => {
    const cliente = getClienteActivo();
    if (cliente) actualizarResumenSaldo(main, cliente);
  });
  return () => {
    unsubscribeCliente?.();
    window.removeEventListener('prevismart:antes-de-recargar', guardarPendiente);
    unsubUF();
    if (timerGuardar) {
      clearTimeout(timerGuardar);
      timerGuardar = null;
      const cliente = getCliente(main.querySelector('#form-perfil')?.dataset.wired);
      if (cliente) guardarAhora(main, cliente);
    }
  };
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#perfil-vacio');
  const cuerpo = main.querySelector('#perfil-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-user-round')}</span>
        <p class="empty__titulo">Selecciona un cliente primero</p>
        <p>El perfil se guarda dentro de la ficha del cliente activo.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }

  vacio.innerHTML = '';
  cuerpo.hidden = false;
  const form = main.querySelector('#form-perfil');
  if (form.dataset.wired !== cliente.id) {
    poblarFormulario(main, cliente); // no repoblar si el formulario ya está en uso
  }
  cablearAutosave(main, cliente);
  renderBeneficiarios(main, cliente);
  cablearBeneficiarios(main, cliente);
  actualizarResumenSaldo(main, cliente);
}

/* ---------------- Poblar y guardar ---------------- */

function poblarFormulario(main, c) {
  const p = c.perfil || {};
  const s = c.saldo || {};

  main.querySelectorAll('[data-grupo]').forEach((el) => {
    const grupo = el.dataset.grupo;
    const nombre = el.name;
    let valor;
    if (grupo === 'cliente') valor = c[nombre];
    else if (grupo === 'saldo' && nombre === 'bonoReconocimientoMonto') valor = s.bonoReconocimiento?.monto;
    else if (grupo === 'saldo' && nombre === 'bonoReconocimientoEstado') valor = s.bonoReconocimiento?.estado;
    else valor = (grupo === 'perfil' ? p : s)[nombre];

    if (el.type === 'checkbox') {
      el.checked = el.name === 'otrasPensiones'
        ? Array.isArray(valor) && valor.includes(el.value)
        : Boolean(valor);
    } else if (el.type === 'radio') {
      el.checked = valor === el.value;
    } else if (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'hidden') {
      const opcion = el.tagName === 'SELECT' ? Array.from(el.options).find((o) => o.value.toLowerCase() === String(valor ?? '').toLowerCase()) : null;
      el.value = opcion?.value ?? valor ?? '';
    } else {
      el.value = valor ?? '';
      if (el.classList.contains('money') && valor) el.value = String(valor).replace('.', ',');
    }
  });

  actualizarCondicionales(main, p);
  actualizarEdad(main, p);
}

function recolectar(main) {
  const p = {};
  const s = {};
  let nombreCliente = null;
  const otrasPensiones = [];

  main.querySelectorAll('[data-grupo]').forEach((el) => {
    const g = el.dataset.grupo;
    const nombre = el.name;
    let valor;
    if (el.type === 'checkbox') {
      if (nombre === 'otrasPensiones') { if (el.checked) otrasPensiones.push(el.value); return; }
      valor = el.checked;
    } else if (el.type === 'radio') {
      if (!el.checked) return;
      valor = el.value;
    } else if (el.classList.contains('money') || el.type === 'number') {
      valor = el.value.trim() === '' ? null : el.type === 'number' ? Number(el.value) || 0 : num(el.value);
    } else {
      valor = el.value || null;
    }
    if (g === 'cliente') { if (nombre === 'nombre') nombreCliente = valor; }
    else if (g === 'perfil' && nombre === 'nombre') p.nombre = valor;
    else if (g === 'saldo' && nombre === 'bonoReconocimientoMonto') s.bonoReconocimiento = { ...(s.bonoReconocimiento || {}), monto: valor };
    else if (g === 'saldo' && nombre === 'bonoReconocimientoEstado') s.bonoReconocimiento = { ...(s.bonoReconocimiento || {}), estado: valor };
    else (g === 'perfil' ? p : s)[nombre] = valor;
  });

  p.otrasPensiones = otrasPensiones;
  // nombre completo del cliente = nombre + apellidos (si hay partes)
  if (!nombreCliente) {
    const comp = [p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    nombreCliente = comp || null;
  }
  return { perfil: p, saldo: s, nombreCliente };
}

let timerGuardar = null;
function guardarAhora(main, cliente) {
  const { perfil, saldo, nombreCliente } = recolectar(main);
  guardarSeccion(cliente.id, 'perfil', { ...(cliente.perfil || {}), ...perfil });
  guardarSeccion(cliente.id, 'saldo', { ...(cliente.saldo || {}), ...saldo });
  if (nombreCliente && nombreCliente !== cliente.nombre) {
    actualizarCliente(cliente.id, { nombre: nombreCliente });
  }
  marcarGuardado(main);
}

function cablearAutosave(main, cliente) {
  const form = main.querySelector('#form-perfil');
  if (form.dataset.wired === cliente.id) return;
  form.dataset.wired = cliente.id;

  form.addEventListener('input', () => {
    actualizarCondicionales(main, recolectar(main).perfil);
    actualizarEdad(main, recolectar(main).perfil);
    actualizarResumenSaldo(main, cliente);
    clearTimeout(timerGuardar);
    timerGuardar = setTimeout(() => { timerGuardar = null; guardarAhora(main, cliente); }, 450);
  });

  main.querySelector('#btn-guardar-perfil')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearTimeout(timerGuardar);
    timerGuardar = null;
    guardarAhora(main, cliente);
    toast('Perfil guardado', 'success');
  });
}

function marcarGuardado(main) {
  const el = main.querySelector('#guardado-estado');
  if (el) el.innerHTML = `${icono('i-circle-check')} Guardado ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ---------------- Condicionales y cálculos visibles ---------------- */

function actualizarCondicionales(main, p) {
  const grupoMat = main.querySelector('#grupo-matrimonio');
  if (grupoMat) grupoMat.hidden = !['casado', 'auc'].includes(p.estadoCivil);
  const plan = main.querySelector('#grupo-planuf');
  if (plan) plan.hidden = p.saludTipo !== 'isapre';
}

function actualizarEdad(main, p) {
  const el = main.querySelector('#edad-actual');
  if (!el) return;
  const e = p.fechaNacimiento ? edadExacta(p.fechaNacimiento) : null;
  const legal = p.sexo ? NORMATIVA.edadLegal[p.sexo === 'F' ? 'mujer' : 'hombre'] : null;
  el.textContent = e
    ? `${e.anios} años, ${e.meses} meses y ${e.dias} días` + (legal ? ` · edad legal ${p.sexo === 'F' ? 'mujer' : 'hombre'}: ${legal} años` : '')
    : '';
}

function actualizarResumenSaldo(main, cliente) {
  const { saldo } = recolectar(main);
  const ufv = getUF().valor;
  const total = CAMPOS_SALDO_PENSION.reduce((acc, k) => acc + (Number(k === 'bonoReconocimientoMonto' ? saldo.bonoReconocimiento?.monto : saldo[k]) || 0), 0);
  const elTotal = main.querySelector('#saldo-total');
  const elUF = main.querySelector('#saldo-total-uf');
  if (elTotal) elTotal.textContent = total > 0 ? clp(total) : '—';
  if (elUF) elUF.textContent = total > 0 && ufv
    ? `≈ ${uf(clpAuf(total, ufv))} · Obligatorio + APV + depósitos convenidos + cotizaciones voluntarias + bonos (Cuenta 2 excluida). El monto oficial lo fija el Certificado de Saldo.`
    : 'Obligatorio + APV + depósitos convenidos + cotizaciones voluntarias + bonos (Cuenta 2 excluida). El monto oficial lo fija el Certificado de Saldo.';

  // equivalencias UF por campo
  main.querySelectorAll('[data-equiv]').forEach((el) => {
    const v = Number(saldo[el.dataset.equiv]) || 0;
    el.textContent = v > 0 && ufv ? `= ${uf(clpAuf(v, ufv))}` : '';
  });
  const pen = main.querySelector('#pension-equiv');
  if (pen) {
    const est = Number(saldo.pensionEstimadaUF) || 0;
    pen.textContent = est > 0 && ufv
      ? `≈ ${clp(est * ufv)}/mes · La estimación de la AFP o la oferta SCOMP más conservadora.`
      : 'La estimación de la AFP o la oferta SCOMP más conservadora.';
  }
}

/* ---------------- Beneficiarios ---------------- */

function renderBeneficiarios(main, cliente) {
  const zona = main.querySelector('#lista-beneficiarios');
  if (!zona) return;
  const lista = cliente.beneficiarios || [];
  const hayHijosConDerecho = lista.some((b) => pctSobrevivencia(b, false) > 0 && b.tipo === 'hijo');

  zona.innerHTML = lista.length ? lista.map((b, i) => {
    const e = b.fechaNacimiento ? edadExacta(b.fechaNacimiento) : null;
    const pct = Math.round(pctSobrevivencia(b, hayHijosConDerecho) * 100);
    return `
    <article class="card card--flat u-flex u-items-center u-justify-between u-gap-3 u-wrap" data-idx="${i}">
      <div>
        <strong>${esc(b.nombre || NOMBRES_TIPO[b.tipo])}</strong>
        <span class="badge badge--primary u-ms-2">${esc(NOMBRES_TIPO[b.tipo] || b.tipo)}</span>
        <p class="small muted u-mt-1 u-mb-0">
          ${e ? `${e.anios} años` : 'sin fecha'}
          ${b.estudiante ? ' · estudiante' : ''}
          ${b.invalidez ? ` · invalidez ${esc(b.invalidez)}` : ''}
          ${pct ? ` · sobrevivencia legal ≈ ${pct}%` : ' · sin derecho evidente a sobrevivencia'}
        </p>
      </div>
      <div class="u-flex u-gap-2">
        <button class="btn btn--ghost btn--sm" type="button" data-benef="editar" aria-label="Editar">${icono('i-pencil')}</button>
        <button class="btn btn--ghost btn--sm" type="button" data-benef="quitar" aria-label="Quitar">${icono('i-x')}</button>
      </div>
    </article>`;
  }).join('') : `
    <p class="muted small">Sin beneficiarios registrados. Si el afiliado tiene cónyuge, hijos con derecho u otros, agrégalos: afectan el cálculo y las ofertas.</p>`;
}

function cablearBeneficiarios(main, cliente) {
  const zona = main.querySelector('#lista-beneficiarios');
  const dlg = main.querySelector('#dlg-beneficiario');
  const form = main.querySelector('#form-beneficiario');
  if (zona.dataset.wired === cliente.id) return;
  zona.dataset.wired = cliente.id;

  const abrirBenef = (idx = null) => {
    const b = idx != null ? cliente.beneficiarios[idx] : null;
    form.querySelector('#benef-idx').value = idx ?? '';
    form.querySelector('#benef-tipo').value = b?.tipo || 'conyuge';
    form.querySelector('#benef-nombre').value = b?.nombre || '';
    form.querySelector('#benef-fnac').value = b?.fechaNacimiento || '';
    form.querySelector('#benef-sexo').value = b?.sexo || '';
    form.querySelector('[name="estudiante"]').checked = Boolean(b?.estudiante);
    form.querySelector('#benef-invalidez').value = b?.invalidez || '';
    form.querySelector('#benef-hijo-comun').value = b?.hijoComun === true ? 'si' : b?.hijoComun === false ? 'no' : '';
    toggleHijoExtra(form);
    actualizarEdadBenef(form);
    abrirDialog(dlg);
  };

  const toggleHijoExtra = (f) => {
    f.querySelector('#benef-hijo-extra').hidden = f.querySelector('#benef-tipo').value !== 'hijo';
  };
  const actualizarEdadBenef = (f) => {
    const fn = f.querySelector('#benef-fnac').value;
    const e = fn ? edadExacta(fn) : null;
    f.querySelector('#benef-edad').textContent = e ? `${e.anios} años` : '';
  };

  form.querySelector('#benef-tipo').addEventListener('change', () => toggleHijoExtra(form));
  form.querySelector('#benef-fnac').addEventListener('input', () => actualizarEdadBenef(form));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const b = {
      tipo: f.get('tipo'),
      nombre: String(f.get('nombre') || '').trim(),
      fechaNacimiento: f.get('fechaNacimiento') || null,
      sexo: f.get('sexo') || null,
      estudiante: f.get('tipo') === 'hijo' ? Boolean(f.get('estudiante')) : false,
      invalidez: f.get('invalidez') || null,
      ...(f.get('tipo') === 'hijo' ? { hijoComun: f.get('hijoComun') === 'si' ? true : f.get('hijoComun') === 'no' ? false : null } : {})
    };
    const lista = [...(getCliente(cliente.id).beneficiarios || [])];
    const idxEd = form.querySelector('#benef-idx').value;
    if (idxEd !== '') lista[Number(idxEd)] = b; else lista.push(b);
    guardarSeccion(cliente.id, 'beneficiarios', lista);
    cerrarDialog(dlg);
    toast('Beneficiario guardado', 'success');
  });

  main.querySelector('#btn-add-benef')?.addEventListener('click', () => abrirBenef(null));

  zona.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-benef]');
    if (!btn) return;
    const idx = Number(e.target.closest('[data-idx]')?.dataset.idx);
    const lista = [...(getCliente(cliente.id).beneficiarios || [])];
    if (btn.dataset.benef === 'editar') abrirBenef(idx);
    if (btn.dataset.benef === 'quitar') {
      lista.splice(idx, 1);
      guardarSeccion(cliente.id, 'beneficiarios', lista);
      toast('Beneficiario eliminado', 'info');
    }
  });
}
