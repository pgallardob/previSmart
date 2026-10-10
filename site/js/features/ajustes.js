/* PreviSmart · ajustes.js — tema, UF, respaldo y acerca de. */

import { getUF, refrescarUF, setUFManual, onUF, etiquetaOrigen } from '../core/uf.js';
import { clpDec, fechaCorta, relativo } from '../core/format.js';
import { exportarCartera, importar, borrarCartera } from '../core/store.js';
import {
  onRespaldo, elegirCarpetaRespaldo, reconectarCarpeta,
  respaldarAhora, restaurarDesdeCarpeta, ARCHIVO_RESPALDO, estadoRespaldo, permitirSobrescrituraRespaldo
} from '../core/respaldo.js';
import { abrirDialog, cerrarDialog, cablearCierre } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { APP_VERSION } from '../core/version.js';
import { eliminarDocumentosCliente } from '../core/documentos.js';
import { olvidarCarpetaRespaldo } from '../core/respaldo.js';
import { exportarIntegral, restaurarIntegral } from '../core/respaldo-integral.js';
import { iniciarOperacion } from '../core/actividad.js';
import { getAsesor, guardarAsesor } from '../core/asesor.js';
import {
  getConfig, guardarConfig, borrarConfig, estaConfigurada, borrarTodasCredenciales, consultarSaludRPA
} from '../core/integracion.js';

const KEY_TEMA = 'prevismart.tema';
const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
let unsubUF = null;

export function init(main) {
  if (unsubUF) { unsubUF(); unsubUF = null; }
  cablear(main);
  unsubUF = onUF(() => renderUF(main));
  renderTema(main);
  renderUF(main);
  renderIntegracion(main);
  const asesor = getAsesor();
  for (const campo of ['nombre', 'registro', 'email', 'telefono']) main.querySelector(`#aj-asesor-${campo}`).value = asesor[campo];
  const unsubRespaldo = onRespaldo((e) => renderRespaldo(main, e));
  const ver = main.querySelector('#aj-version');
  if (ver) ver.textContent = `${APP_VERSION} · referencias normativas octubre 2026, revisión técnica parcial · RPA Modelo implementado; otras AFP con ruta documental`;
  return () => { unsubUF?.(); unsubRespaldo(); };
}

/* ---- Servicio de descarga AFP (RPA propio · presiso.md vía 2) ---- */
function renderIntegracion(main) {
  const estado = main.querySelector('#aj-int-estado');
  const form = main.querySelector('#aj-int-form');
  if (!estado || !form) return;
  const cfg = getConfig();
  estado.innerHTML = estaConfigurada()
    ? `Servicio configurado: <code>${esc(cfg.endpoint)}</code>${cfg.token ? ' · con token' : ''}. La vista <a href="#/captura">Captura de datos</a> autenticará como el afiliado con las credenciales guardadas.`
    : 'Sin endpoint: la descarga directa queda desactivada (el resto de la app funciona igual). Corre el servicio RPA y registra aquí su dirección (ej: http://localhost:8787).';
  form.querySelector('#aj-int-endpoint').value = cfg.endpoint || '';
  form.querySelector('#aj-int-key').value = '';
  form.querySelector('#aj-int-key').placeholder = cfg.token ? '•••••••• (guardado — escribe para cambiar)' : 'opcional';
}

function renderRespaldo(main, e) {
  const el = main.querySelector('#aj-res-estado');
  if (!el) return;
  const hora = e.ultimoGuardado ? new Date(e.ultimoGuardado).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  if (!e.soportado) {
    el.innerHTML = 'Tu navegador no permite escritura directa a archivo. Usa <strong>Exportar cartera (JSON)</strong> abajo.';
    main.querySelector('#aj-res-elegir').disabled = true;
    main.querySelector('#aj-res-guardar').disabled = true;
    main.querySelector('#aj-res-restaurar').disabled = true;
    return;
  }
  main.querySelector('#aj-res-elegir').innerHTML = `${icono('i-file-text')} ${e.configurado ? 'Cambiar carpeta' : 'Elegir carpeta de respaldo'}`;
  el.innerHTML = e.configurado
    ? `Carpeta: <strong>${esc(e.carpeta)}</strong> · archivo <code>${ARCHIVO_RESPALDO}</code>${hora ? ` · último guardado ${hora}` : ' · pendiente del primer guardado'}${e.ultimoError ? ` · <span class="badge badge--warning">${esc(e.ultimoError)}</span>` : ''}. Cada cambio en un cliente se escribe automáticamente.`
    : `Elige una carpeta una sola vez y la app escribirá <code>${ARCHIVO_RESPALDO}</code> en ella <strong>cada vez que cambie un dato</strong> — incluye toda la cartera de clientes con sus expedientes.`;
}

function renderTema(main) {
  const sel = main.querySelector('#aj-tema-sel');
  if (sel) sel.value = localStorage.getItem(KEY_TEMA) || 'auto';
}

function renderUF(main) {
  const e = getUF();
  const el = main.querySelector('#aj-uf-estado');
  if (!el) return;
  el.innerHTML = e.valor != null
    ? `Valor de referencia: <strong class="money">${clpDec(e.valor)}</strong> · ${fechaCorta(e.fecha)} (${relativo(e.fecha)}) · <span class="badge badge--neutral">${etiquetaOrigen(e)}</span>`
    : (e.origen === 'consultando' ? 'Consultando el valor en línea…' : 'Sin valor UF. Actualiza en línea o ingrésalo manualmente.');
}

function cablear(main) {
  if (main.dataset.wired) return;
  main.dataset.wired = '1';
  main.querySelector('#aj-asesor-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      guardarAsesor(Object.fromEntries(['nombre', 'registro', 'email', 'telefono'].map((campo) => [campo, main.querySelector(`#aj-asesor-${campo}`).value])));
      toast('Responsable guardado solo en esta instalación', 'success');
    } catch (error) { toast(error.message, 'danger'); }
  });
  main.querySelector('#aj-verificar-operacion')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const status = main.querySelector('#aj-operacion-estado');
    button.disabled = true; status.textContent = 'Verificando servicio local…';
    try {
      const data = await consultarSaludRPA();
      if (!main.isConnected) return;
      const available = data.afps.filter((a) => a?.disponible && typeof a.id === 'string').map((a) => a.id).join(', ') || 'ninguna';
      status.textContent = data.version === APP_VERSION && data.modo === 'real' && data.normativa?.tablaImpuestoVigente === true
        ? `App y RPA ${APP_VERSION} coinciden · modo real · automatización habilitada: ${available}${data.ocupado ? ' · operación en curso' : ' · servicio libre'}. No certifica todas las AFP ni emisión oficial.`
        : `Revisar automatización/cálculos: app ${APP_VERSION}, RPA ${data.version}, modo ${data.modo}, tabla tributaria informada por RPA ${data.normativa?.tablaImpuestoVigente === true ? 'confirmada' : 'no confirmada'}. No importes respuestas de prueba. La calculadora valida su propia tabla local; el RPA no bloquea cartera, carga documental ni guardado cifrado.`;
    } catch (error) { if (main.isConnected) status.textContent = `${error.message} El RPA no es necesario para la cartera, carga PDF y guardado cifrado local; esas funciones pueden seguir disponibles.`; }
    finally { button.disabled = false; }
  });
  cablearCierre(main.querySelector('#dlg-borrar'));
  const dlgIntegral = main.querySelector('#dlg-integral');
  cablearCierre(dlgIntegral);
  const integralFile = main.querySelector('#aj-integral-file');
  main.querySelector('#aj-integral-exportar')?.addEventListener('click', () => {
    dlgIntegral.dataset.modo = 'exportar';
    main.querySelector('#integral-password').value = '';
    main.querySelector('#integral-accion').textContent = 'Exportar respaldo cifrado';
    abrirDialog(dlgIntegral);
  });
  main.querySelector('#aj-integral-restaurar')?.addEventListener('click', () => integralFile.click());
  integralFile?.addEventListener('change', () => {
    if (!integralFile.files?.[0]) return;
    dlgIntegral.dataset.modo = 'restaurar';
    main.querySelector('#integral-password').value = '';
    main.querySelector('#integral-accion').textContent = 'Restaurar expedientes';
    abrirDialog(dlgIntegral);
  });
  main.querySelector('#form-integral')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = main.querySelector('#integral-password');
    const password = input.value;
    input.value = '';
    const button = main.querySelector('#integral-accion');
    button.disabled = true;
    const finalizar = iniciarOperacion();
    try {
      if (dlgIntegral.dataset.modo === 'exportar') {
        const json = await exportarIntegral(password);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        link.download = 'prevismart-expedientes-cifrados.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 30000);
        toast('Respaldo completo cifrado exportado: cartera y documentos originales', 'success');
      } else {
        if (!window.confirm('Se reemplazará la cartera actual y se recuperarán los PDF del respaldo. ¿Continuar?')) return;
        const file = integralFile.files[0];
        if (file.size > 100 * 1024 * 1024) throw new Error('El respaldo supera 100 MB.');
        const result = await restaurarIntegral(await file.text(), password);
        toast(`Restaurados ${result.importados} clientes y ${result.documentos} documentos`, 'success');
      }
      cerrarDialog(dlgIntegral);
    } catch (error) { toast(error.message, 'danger'); }
    finally { finalizar(); button.disabled = false; integralFile.value = ''; }
  });

  main.querySelector('#aj-tema-sel')?.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'auto') localStorage.removeItem(KEY_TEMA);
    else localStorage.setItem(KEY_TEMA, v);
    const t = v === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : v;
    document.documentElement.dataset.theme = t;
    toast('Tema aplicado', 'success');
  });

  main.querySelector('#aj-uf-actualizar')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    const ok = await refrescarUF();
    e.target.disabled = false;
    toast(ok ? 'UF actualizada en línea' : 'Sin conexión: se mantiene el último valor', ok ? 'success' : 'warning');
  });

  main.querySelector('#aj-uf-manual')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = main.querySelector('#aj-uf-input');
    const v = Number(String(input.value).replace(/\./g, '').replace(',', '.'));
    if (setUFManual(v)) { input.value = ''; toast('Valor UF guardado manualmente', 'success'); }
    else toast('Ingresa un valor válido, ej: 41081,76', 'danger');
  });

  /* ---- Guardado a archivo (File System Access) ---- */
  main.querySelector('#aj-res-elegir')?.addEventListener('click', async () => {
    const r = await elegirCarpetaRespaldo();
    if (r.ok) toast(`Respaldo activo: ${r.carpeta}`, 'success');
    else if (r.error && r.error !== 'elección cancelada') toast(r.error, 'danger');
  });
  main.querySelector('#aj-res-guardar')?.addEventListener('click', async () => {
    if (estadoRespaldo().requiereConfirmacion) {
      if (!window.confirm('Se sobrescribirá el respaldo existente con la cartera actual. ¿Continuar?')) return;
      await permitirSobrescrituraRespaldo();
    }
    const e = (await respaldarAhora())
      ? (toast(`Escrito en ${ARCHIVO_RESPALDO}`, 'success'), true)
      : (await reconectarCarpeta());
    if (e && e.ok === false) toast(e.error || 'Sin permiso de escritura', 'danger');
  });
  main.querySelector('#aj-res-restaurar')?.addEventListener('click', async () => {
    if (!window.confirm('Se reemplazará la cartera actual por el respaldo. Los documentos conservan su asociación si sus clientes tienen el mismo ID. ¿Continuar?')) return;
    const r = await restaurarDesdeCarpeta();
    toast(r.ok ? `Restaurados ${r.importados} cliente(s) desde archivo` : `No se pudo restaurar: ${r.error}`, r.ok ? 'success' : 'danger');
  });

  main.querySelector('#aj-exportar')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportarCartera()], { type: 'application/json' }));
    a.download = 'prevismart-cartera.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Cartera exportada', 'success');
  });

  const file = main.querySelector('#aj-import-file');
  main.querySelector('#aj-importar')?.addEventListener('click', () => file.click());
  file?.addEventListener('change', async () => {
    const f_ = file.files?.[0];
    if (!f_) return;
    const res = importar(await f_.text());
    toast(res.ok ? `Importados ${res.importados} cliente(s)` : `No se pudo importar: ${res.error}`, res.ok ? 'success' : 'danger');
    file.value = '';
  });

  main.querySelector('#aj-borrar')?.addEventListener('click', () => abrirDialog(main.querySelector('#dlg-borrar')));

  /* ---- Servicio de descarga AFP (RPA) ---- */
  main.querySelector('#aj-int-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const $ = (s) => main.querySelector(s)?.value.trim() || '';
    const endpoint = $('#aj-int-endpoint');
    const token = $('#aj-int-key');
    if (endpoint && !/^https?:\/\//.test(endpoint)) {
      toast('El endpoint debe ser una URL (http://localhost:8787)', 'danger');
      return;
    }
    try {
      guardarConfig({ endpoint: endpoint || 'http://localhost:8787', ...(token ? { token } : {}) });
    } catch (err) {
      toast(err.message, 'danger');
      return;
    }
    renderIntegracion(main);
    toast(estaConfigurada() ? 'Servicio RPA registrado: la descarga directa está activa' : 'Endpoint vacío: la descarga queda desactivada', 'success');
  });
  main.querySelector('#aj-int-borrar')?.addEventListener('click', () => {
    borrarConfig();
    renderIntegracion(main);
    toast('Configuración del servicio eliminada', 'info');
  });
  main.querySelector('#borrar-si')?.addEventListener('click', async () => {
    try {
      await olvidarCarpetaRespaldo();
      await eliminarDocumentosCliente();
      borrarCartera();
      borrarTodasCredenciales();
    } catch {
      toast('No se pudieron eliminar los documentos. Intenta de nuevo.', 'danger');
      return;
    }
    for (const key of ['prevismart.v1', 'prevismart.uf.v1', 'prevismart.cred.afp.v1', 'prevismart.rpa.v1', KEY_TEMA]) {
      localStorage.removeItem(key);
    }
    cerrarDialog(main.querySelector('#dlg-borrar'));
    toast('Datos eliminados. Recargando…', 'info');
    setTimeout(() => location.reload(), 800);
  });
}
