/* PreviSmart · panel.js — pantalla inicial.
   UF del día · cartera de clientes (CRUD + activo + export/import)
   · estado del proceso del cliente activo · grid de módulos. */

import { modulosPorGrupo } from '../data/modulos.js';
import { NORMATIVA } from '../data/normativa-2026.js';
import { onUF, etiquetaOrigen } from '../core/uf.js';
import { clpDec, fechaCorta, relativo } from '../core/format.js';
import {
  subscribe, listarClientes, getClienteActivo, crearCliente,
  actualizarCliente, eliminarCliente, setClienteActivo,
  guardarSeccion, exportarCliente, exportarCartera, importar
} from '../core/store.js';
import { abrirDialog, cerrarDialog, cablearCierre } from '../ui/dialog.js';
import { edadExacta } from '../core/dates.js';
import { cargarClienteSCOMP } from '../data/semilla.js';
import { toast } from '../ui/toast.js';
import { borrarCredenciales } from '../core/integracion.js';
import { eliminarDocumentosCliente } from '../core/documentos.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const ETAPAS = 7; // ruta del proceso (Fase 8)

export function init(main) {
  const limpiarUF = initTarvetaUF(main);
  const limpiarCartera = initCartera(main);
  initModulos(main);
  return () => { limpiarUF?.(); limpiarCartera?.(); };
}

/* ---------------- UF ---------------- */

function initTarvetaUF(main) {
  const zona = main.querySelector('#panel-uf');
  if (!zona) return;
  return onUF((e) => {
    zona.innerHTML = e.valor != null ? `
      <div class="stat">
        <span class="stat__valor money">${clpDec(e.valor)}</span>
        <span class="stat__label">Valor UF · ${fechaCorta(e.fecha)} (${relativo(e.fecha)})</span>
      </div>
      <span class="badge ${e.origen === 'online' ? 'badge--success' : e.origen === 'manual' ? 'badge--warning' : 'badge--info'}">
        ${icono(e.origen === 'online' ? 'i-wifi' : e.origen === 'guardada' ? 'i-wifi-off' : e.origen === 'consultando' ? 'i-refresh-cw' : 'i-pencil')} ${etiquetaOrigen(e)}
      </span>` : `
      <div class="stat">
        <span class="stat__valor">Sin valor UF</span>
        <span class="stat__label">Ingresa el valor desde la pill del encabezado</span>
      </div>
      <span class="badge badge--warning">${icono('i-wifi-off')} sin valor</span>`;
  });
}

/* ---------------- Cartera ---------------- */

function initCartera(main) {
  const zona = main.querySelector('#cartera');
  const dlgCliente = main.querySelector('#dlg-cliente');
  const dlgConfirmar = main.querySelector('#dlg-confirmar');
  cablearCierre(dlgCliente);
  cablearCierre(dlgConfirmar);
  let confirmarAccion = null;

  const render = () => {
    const clientes = listarClientes();
    const activo = getClienteActivo();

    if (!clientes.length) {
      zona.innerHTML = `
        <div class="empty u-p-6">
          <span class="empty__icono">${icono('i-users')}</span>
          <p class="empty__titulo">Sin clientes aún</p>
          <p>Crea la primera ficha para comenzar un expediente: perfil previsional, beneficiarios, saldos, ofertas SCOMP y checklists quedarán asociados a ella.</p>
          <button class="btn btn--primary" type="button" data-accion="nuevo">${icono('i-plus')} Nuevo cliente</button>
        </div>`;
    } else {
      zona.innerHTML = `<div class="grid-modulos">${clientes.map((c) => `
        <article class="card card--interactive" data-id="${c.id}">
          <div class="cliente-card__header">
            <strong class="cliente-card__nombre">${esc(c.nombre)}</strong>
            <div class="cliente-card__estado">
            ${c.ingesta?.demostracion ? '<span class="badge badge--warning">demostración</span>' : ''}
            ${c.id === activo?.id ? `<span class="badge badge--success">${icono('i-circle-check')} activo</span>` : ''}
            </div>
          </div>
          ${c.notas ? `<p class="small muted u-mb-0">${esc(c.notas)}</p>` : ''}
          <p class="tiny muted u-mt-2 u-mb-0">Actualizado ${relativo(c.actualizadoEn)}</p>
          <div class="u-flex u-gap-2 u-wrap u-mt-4">
            ${c.id !== activo?.id ? `<button class="btn btn--secondary btn--sm" type="button" data-accion="activar">Usar</button>` : ''}
            <button class="btn btn--ghost btn--sm" type="button" data-accion="editar" aria-label="Editar ${esc(c.nombre)}">${icono('i-pencil')} Editar</button>
            <button class="btn btn--ghost btn--sm" type="button" data-accion="exportar" aria-label="Exportar ${esc(c.nombre)}">${icono('i-download')}</button>
            <button class="btn btn--ghost btn--sm" type="button" data-accion="eliminar" aria-label="Eliminar ${esc(c.nombre)}">${icono('i-x')}</button>
          </div>
        </article>`).join('')}</div>`;
    }

    renderProceso(main, activo);
  };

  render();
  const limpiar = subscribe(render);

  /* Acciones de la zona de cartera (delegación) */
  zona.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accion]');
    if (!btn) return;
    const card = e.target.closest('[data-id]');
    const id = card?.dataset.id;
    const accion = btn.dataset.accion;

    if (accion === 'nuevo') abrirCliente(dlgCliente, null);
    if (accion === 'activar' && id) { setClienteActivo(id); toast('Cliente activo cambiado', 'success'); }
    if (accion === 'editar' && id) abrirCliente(dlgCliente, id);
    if (accion === 'exportar' && id) descargarCliente(id);
    if (accion === 'eliminar' && id) {
      const c = listarClientes().find((x) => x.id === id);
      main.querySelector('#confirmar-texto').textContent =
        `Se eliminará la ficha de “${c?.nombre}” y sus documentos del navegador. Los archivos cifrados, descargas y copias guardadas fuera del navegador no se borran: revísalos por separado conforme a sus obligaciones de conservación. Esta acción no se puede deshacer.`;
      confirmarAccion = async () => {
        await eliminarDocumentosCliente(id);
        borrarCredenciales(id);
        eliminarCliente(id);
        toast('Cliente eliminado', 'info');
      };
      abrirDialog(dlgConfirmar);
    }
  });

  main.querySelector('#confirmar-si')?.addEventListener('click', async () => {
    try {
      await confirmarAccion?.();
      confirmarAccion = null;
      cerrarDialog(dlgConfirmar);
    } catch {
      toast('No se pudo eliminar el expediente completo. Intenta de nuevo.', 'danger');
    }
  });

  main.querySelector('#btn-nuevo-cliente')?.addEventListener('click', () => abrirCliente(dlgCliente, null));
  main.querySelector('#btn-scomp')?.addEventListener('click', () => {
    const c = cargarClienteSCOMP();
    toast(c ? 'Demostración sintética cargada: no es un expediente ni una oferta oficial' : 'No se pudo crear el cliente', c ? 'info' : 'danger');
  });

  main.querySelector('#cliente-fnac')?.addEventListener('input', (e) => {
    const ed = e.target.value ? edadExacta(e.target.value) : null;
    main.querySelector('#cliente-edad').textContent = ed
      ? `${ed.anios} años, ${ed.meses} meses y ${ed.dias} días`
      : 'La edad se calcula sola.';
  });

  main.querySelector('#form-cliente')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = main.querySelector('#cliente-id').value || null;
    const $ = (s) => dlgCliente.querySelector(s).value.trim();
    const nombre = [$('#cliente-nombre'), $('#cliente-apaterno'), $('#cliente-amaterno')]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ');
    if (!nombre) return;

    const perfilNuevo = {
      nombre: $('#cliente-nombre') || null,
      apellidoPaterno: $('#cliente-apaterno') || null,
      apellidoMaterno: $('#cliente-amaterno') || null,
      rut: $('#cliente-rut') || null,
      telefono: $('#cliente-telefono') || null,
      email: $('#cliente-email') || null,
      direccion: $('#cliente-direccion') || null,
      fechaNacimiento: $('#cliente-fnac') || null,
      afp: $('#cliente-afp') || null
    };

    if (id) {
      actualizarCliente(id, { nombre });
      const c = listarClientes().find((x) => x.id === id);
      guardarSeccion(id, 'perfil', { ...(c?.perfil || {}), ...perfilNuevo });
      toast('Cliente actualizado', 'success');
    } else {
      const c = crearCliente({ nombre });
      if (c) guardarSeccion(c.id, 'perfil', perfilNuevo);
      toast('Cliente creado y activado', 'success');
    }
    cerrarDialog(dlgCliente);
  });

  /* Import / export */
  const fileInput = main.querySelector('#import-file');
  main.querySelector('#btn-importar')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const res = importar(await f.text());
    toast(res.ok ? `Importados ${res.importados} cliente(s)` : `No se pudo importar: ${res.error}`, res.ok ? 'success' : 'danger');
    fileInput.value = '';
  });
  main.querySelector('#btn-exportar-cartera')?.addEventListener('click', () => {
    descargarJSON(exportarCartera(), 'prevismart-cartera.json');
    toast('Cartera exportada', 'success');
  });
  return limpiar;
}

function abrirCliente(dlg, id) {
  const c = id ? listarClientes().find((x) => x.id === id) : null;
  const p = c?.perfil || {};
  const set = (sel, v) => { dlg.querySelector(sel).value = v ?? ''; };
  set('#cliente-id', c?.id);
  set('#cliente-nombre', p.nombre || c?.nombre || '');
  set('#cliente-apaterno', p.apellidoPaterno);
  set('#cliente-amaterno', p.apellidoMaterno);
  set('#cliente-rut', p.rut);
  set('#cliente-telefono', p.telefono);
  set('#cliente-email', p.email);
  set('#cliente-direccion', p.direccion);
  set('#cliente-fnac', p.fechaNacimiento);
  set('#cliente-afp', p.afp);
  dlg.querySelector('#cliente-edad').textContent = 'La edad se calcula sola.';
  abrirDialog(dlg);
}

function descargarCliente(id) {
  const c = listarClientes().find((x) => x.id === id);
  descargarJSON(exportarCliente(id), `prevismart-${(c?.nombre || 'cliente').toLowerCase().replace(/\s+/g, '-')}.json`);
  toast('Cliente exportado', 'success');
}

function descargarJSON(json, nombre) {
  if (!json) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- Estado del proceso ---------------- */

function renderProceso(main, cliente) {
  const zona = main.querySelector('#proceso');
  if (!zona) return;
  if (!cliente) {
    zona.innerHTML = `
      <p class="muted u-mb-0">${icono('i-info')} Crea o selecciona un cliente para iniciar su proceso de pensión.</p>`;
    return;
  }
  const etapa = Math.min(cliente.ruta?.etapa ?? 0, ETAPAS);
  const pctProceso = Math.round((etapa / ETAPAS) * 100);
  zona.innerHTML = `
    <div class="u-flex u-items-center u-justify-between u-gap-3 u-wrap">
      <strong>${esc(cliente.nombre)}</strong>
      <span class="badge ${etapa > 0 ? 'badge--primary' : 'badge--neutral'}">${etapa > 0 ? `Etapa ${etapa} de ${ETAPAS}` : 'Sin iniciar'}</span>
    </div>
    <div class="progress u-mt-2"><div class="progress__bar" data-progreso></div></div>
    <p class="small muted u-mt-2 u-mb-0">${etapa > 0
      ? 'Proceso en curso. La ruta completa y sus plazos viven en el módulo Ruta del proceso (Fase 8).'
      : `El proceso aún no inicia. Comienza por el Perfil del cliente (Fase 4). Vigencias clave: certificado de saldo ${NORMATIVA.plazos.certSaldoVigenciaDiasCorridos} días corridos · ofertas SCOMP ${NORMATIVA.plazos.ofertasVigenciaDiasHabiles} días hábiles.`}</p>`;
  zona.querySelector('[data-progreso]')?.style.setProperty('width', `${pctProceso}%`);
}

/* ---------------- Grid de módulos ---------------- */

function initModulos(main) {
  const zona = main.querySelector('#panel-modulos');
  if (!zona) return;
  zona.innerHTML = modulosPorGrupo()
    .filter((g) => g.id !== 'referencia')
    .map((g) => `
      <section>
        <h2 class="u-mt-8">${g.nombre}</h2>
        <div class="grid-modulos">
          ${g.modulos.map((m) => m.estado === 'listo' ? `
            <a class="mod-card" href="#/${m.id}">
              <span class="mod-card__icono">${icono(m.icono)}</span>
              <span class="mod-card__nombre">${m.nombre}</span>
              <p class="mod-card__desc">${m.desc}</p>
              <span class="mod-card__pie">
                <span class="badge badge--success">${icono('i-circle-check')} Disponible</span>
                ${icono('i-arrow-right')}
              </span>
            </a>` : `
            <a class="mod-card mod-card--fase" href="#/${m.id}">
              <span class="mod-card__icono">${icono(m.icono)}</span>
              <span class="mod-card__nombre">${m.nombre}</span>
              <p class="mod-card__desc">${m.desc}</p>
              <span class="mod-card__pie">
                <span class="badge badge--neutral">${icono('i-hourglass')} Fase ${m.fase}</span>
                ${icono('i-chevron-right')}
              </span>
            </a>`).join('')}
        </div>
      </section>`).join('');
}

/* ---- util ---- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
