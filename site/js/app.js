/* PreviSmart · app.js — arranque de la aplicación.
   Orquesta: tema, navegación (sidenav + tabbar + sheet "Más"),
   pill UF con diálogo manual, install prompt, service worker y
   avisos de conexión. */

import { iniciarRouter } from './core/router.js';
import { initRespaldo } from './core/respaldo.js';
import { MODULOS, modulosPorGrupo, TABBAR_MAX } from './data/modulos.js';
import { initUF, refrescarUF, setUFManual, onUF, etiquetaOrigen } from './core/uf.js';
import { clpDec, fechaCorta, relativo } from './core/format.js';
import { APP_VERSION } from './core/version.js';
import { estadoPersistencia, iniciarEdicionExclusiva } from './core/store.js';
import { operacionesActivas } from './core/actividad.js';
import { abrirDialog, cerrarDialog, cablearCierre } from './ui/dialog.js';
import { toast } from './ui/toast.js';
window.addEventListener('beforeunload', (event) => {
  if (operacionesActivas() > 0) { event.preventDefault(); event.returnValue = ''; }
});

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const icono = (nombre) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${nombre}"></use></svg>`;

/* ---------------- Tema ---------------- */
const KEY_TEMA = 'prevismart.tema';
function temaPreferido() {
  return localStorage.getItem(KEY_TEMA)
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  $('#icono-tema use')?.setAttribute('href', `./assets/icons/sprite.svg#${t === 'dark' ? 'i-sun' : 'i-moon'}`);
  $('#btn-tema')?.setAttribute('aria-label', t === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
}
function initTema() {
  aplicarTema(temaPreferido());
  $('#btn-tema')?.addEventListener('click', () => {
    const nuevo = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY_TEMA, nuevo);
    aplicarTema(nuevo);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(KEY_TEMA)) aplicarTema(e.matches ? 'dark' : 'light');
  });
}

/* ---------------- Navegación ---------------- */
function initNav() {
  // Sidenav escritorio: todos los módulos agrupados.
  const side = $('#nav-desktop');
  if (side) {
    side.innerHTML = modulosPorGrupo().map((g) => `
      <p class="sidenav__grupo">${g.nombre}</p>
      ${g.modulos.map((m) => `
        <a class="sidenav__item" href="#/${m.id}" data-ruta="${m.id}">
          ${icono(m.icono)}<span>${m.nombre}</span>
          ${m.estado === 'fase' ? `<span class="badge badge--outline">F${m.fase}</span>` : ''}
        </a>`).join('')}
    `).join('');
  }

  // Tabbar móvil: primeros TABBAR_MAX + "Más".
  const tab = $('#nav-mobile');
  if (tab) {
    const principales = MODULOS.filter((m) => m.tabbar).slice(0, TABBAR_MAX);
    tab.innerHTML = principales.map((m) => `
      <a class="tabbar__item" href="#/${m.id}" data-ruta="${m.id}">
        ${icono(m.icono)}<span>${m.nombreCorto || m.nombre}</span>
      </a>`).join('') + `
      <button class="tabbar__item" id="btn-mas" type="button">
        ${icono('i-menu')}<span>Más</span>
      </button>`;

    $('#btn-mas')?.addEventListener('click', () => {
      const dlg = $('#dlg-mas');
      if (dlg && !dlg.open) abrirDialog(dlg);
    });
  }

  // Sheet "Más": módulos restantes agrupados.
  const dlgMas = $('#dlg-mas');
  if (dlgMas) {
    dlgMas.innerHTML = `
      <article>
      <h3>Todos los módulos</h3>
      ${modulosPorGrupo().map((g) => `
        <p class="sidenav__grupo">${g.nombre}</p>
        <div class="lista">
        ${g.modulos.map((m) => `
          <a class="sidenav__item" href="#/${m.id}" data-ruta="${m.id}">
            ${icono(m.icono)}<span>${m.nombre}</span>
            ${m.estado === 'fase' ? `<span class="badge badge--outline">F${m.fase}</span>` : ''}
          </a>`).join('')}
        </div>`).join('')}
      </article>`;
    cablearCierre(dlgMas);
    dlgMas.addEventListener('click', (e) => {
      if (e.target.closest('a[data-ruta]')) cerrarDialog(dlgMas);
    });
  }
}

function marcarNav(mod) {
  document.querySelectorAll('[data-ruta]').forEach((a) => {
    if (mod && a.dataset.ruta === mod.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------------- Errores visibles (diagnóstico) ----------------
   Cualquier error de módulo o runtime queda como toast para que el
   usuario vea qué falló en vez de secciones en blanco. */
window.addEventListener('error', (e) => {
  toast(`Error: ${e.message?.slice(0, 120) || 'desconocido'}`, 'danger');
});
window.addEventListener('unhandledrejection', (e) => {
  toast(`Error async: ${String(e.reason?.message || e.reason).slice(0, 120)}`, 'danger');
});

/* ---------------- Pill UF + diálogo ---------------- */
const ORIGEN_BADGE = {
  'online': 'badge--success', 'guardada': 'badge--info',
  'manual': 'badge--warning', 'consultando': 'badge--neutral',
  'sin-valor': 'badge--neutral'
};

function renderUFPill(e) {
  const pill = $('#uf-pill');
  if (!pill) return;
  const valor = e.valor != null ? clpDec(e.valor) : '—';
  const fecha = e.fecha ? ` · ${fechaCorta(e.fecha)}` : '';
  pill.innerHTML = `
    <span class="uf-pill__label">UF</span>
    <span class="uf-pill__valor">${valor}</span>
    <span class="badge ${ORIGEN_BADGE[e.origen]}">${etiquetaOrigen(e)}${fecha}</span>
    <span class="visually-hidden">, valor de la UF. Activar para opciones.</span>`;
}

function initUFPill() {
  const pill = $('#uf-pill');
  const dlg = $('#dlg-uf');
  if (!pill || !dlg) return;
  cablearCierre(dlg);
  pill.addEventListener('click', () => {
    const e = $('#dlg-uf-estado');
    const { valor, fecha, origen } = (window.__ufEstado || {});
    e.innerHTML = valor != null
      ? `<strong class="money">${clpDec(valor)}</strong> · ${fechaCorta(fecha)} · ${etiquetaOrigen({ origen })}
          <p class="muted small u-mt-2 u-mb-0">${origen === 'online' ? 'Valor oficial de la UF del SII, consultado en línea (vía mindicador.cl).' : origen === 'guardada' ? 'La consulta en línea no está disponible: se muestra una referencia guardada del SII vía mindicador.cl (' + relativo(fecha) + '). Revisa la fecha antes de calcular.' : origen === 'consultando' ? 'Verificando el valor oficial en línea (mindicador.cl)…' : 'Valor ingresado manualmente.'}</p>`
      : `<strong>Sin valor UF</strong><p class="muted small">${origen === 'consultando' ? 'Consultando el valor en línea…' : 'No hay conexión ni valor guardado. Ingresa el valor de hoy manualmente.'}</p>`;
    abrirDialog(dlg);
  });

  $('#uf-refrescar')?.addEventListener('click', async (ev) => {
    ev.target.disabled = true;
    const ok = await refrescarUF();
    ev.target.disabled = false;
    toast(ok ? 'UF actualizada en línea' : 'Consulta no disponible: revisa el valor guardado y su fecha', ok ? 'success' : 'warning');
    if (ok) cerrarDialog(dlg);
  });

  $('#uf-manual-form')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = $('#uf-manual-input');
    const v = Number(String(input.value).replace(/\./g, '').replace(',', '.'));
    if (setUFManual(v)) {
      toast('Valor UF guardado manualmente', 'success');
      input.value = '';
      cerrarDialog(dlg);
    } else {
      input.setAttribute('aria-invalid', 'true');
      toast('Ingresa un valor válido, ej: 41081,76', 'danger');
      setTimeout(() => input.removeAttribute('aria-invalid'), 2500);
    }
  });
}

/* ---------------- Install prompt ---------------- */
function initInstall() {
  let evento = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e;
    const b = $('#btn-instalar');
    if (b) b.hidden = false;
  });
  $('#btn-instalar')?.addEventListener('click', async () => {
    if (!evento) return;
    evento.prompt();
    await evento.userChoice;
    evento = null;
    $('#btn-instalar').hidden = true;
  });
  window.addEventListener('appinstalled', () => toast('PreviSmart instalada', 'success'));
}

/* ---------------- Service worker + conexión ---------------- */
/* Check for updates on navigation, but apply only on explicit confirmation.
   In-flight downloads/backups must not be interrupted by a new service worker. */
let recargaPorSW = false;
let actualizacionSolicitada = false;
function initSW() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;

  const teniaControlador = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!teniaControlador && !actualizacionSolicitada) return;
    if (recargaPorSW) return;
    recargaPorSW = true;
    toast('PreviSmart actualizado', 'success', 4000);
    setTimeout(() => location.reload(), 600);
  });

  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    const mostrarActualizacion = () => {
      const button = $('#btn-actualizar-app');
      if (!button) return;
      button.hidden = false;
      button.textContent = reg.waiting ? 'Actualizar app' : 'Buscar actualización';
    };
    mostrarActualizacion();
    $('#btn-actualizar-app')?.addEventListener('click', async () => {
      if (operacionesActivas() > 0) { toast('Termina las descargas o respaldos antes de actualizar la app.', 'warning'); return; }
      if (!reg.waiting) {
        const button = $('#btn-actualizar-app');
        button.disabled = true;
        button.textContent = 'Buscando…';
        try {
          await reg.update();
          const worker = reg.installing;
          if (worker && !['installed', 'redundant'].includes(worker.state)) {
            await new Promise((resolve) => {
              const timer = setTimeout(resolve, 30000);
              worker.addEventListener('statechange', () => {
                if (['installed', 'redundant'].includes(worker.state)) { clearTimeout(timer); resolve(); }
              });
            });
          }
          if (reg.waiting) toast('Nueva versión lista. Pulsa “Actualizar app” para aplicarla.', 'info');
          else if (worker?.state === 'redundant') toast('No se pudo preparar la actualización. Revisa la conexión y vuelve a intentarlo.', 'warning');
          else if (reg.installing) toast('La nueva versión sigue descargándose. Mantén la conexión y vuelve a comprobar.', 'info');
          else toast(`Versión ${APP_VERSION}: no se detectó una actualización nueva.`, 'info');
        } catch { toast('No se pudo buscar una actualización. Revisa la conexión y vuelve a intentarlo.', 'warning'); }
        finally { button.disabled = false; mostrarActualizacion(); }
        return;
      }
      if (!window.confirm('Guarda los formularios abiertos. La app se recargará para aplicar la nueva versión. ¿Continuar?')) return;
      actualizacionSolicitada = true;
      window.dispatchEvent(new Event('prevismart:antes-de-recargar'));
      reg.waiting.postMessage({ tipo: 'APLICAR_ACTUALIZACION' });
    });
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          setTimeout(mostrarActualizacion, 100);
          toast('Nueva versión disponible. Usa “Actualizar app” cuando termines tus operaciones.', 'info', 8000);
        }
      });
    });
    window.__swReg = reg;
  }).catch(() => { /* SW no disponible: la app sigue funcionando en línea */ });
}

/* Se llama desde el router en cada cambio de vista. */
function verificarSW() {
  window.__swReg?.update?.().catch(() => {});
}

window.addEventListener('pageshow', verificarSW);
document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarSW(); });

function initConexion() {
  window.addEventListener('offline', () => {
    toast('Sin conexión: trabajas con datos guardados', 'warning', 5000);
  });
  window.addEventListener('online', () => {
    toast('Conexión recuperada', 'success');
    refrescarUF();
  });
}

/* ---------------- Arranque ----------------
   La UF es el dato más sensible de la app: la consulta en línea sale
   PRIMERO, mientras el resto de la interfaz termina de inicializarse. */
const arranqueUF = initUF();
const edicionDisponible = await iniciarEdicionExclusiva();
initTema();
if (!edicionDisponible) toast('Esta pestaña está en modo lectura: otra pestaña tiene la edición, o el navegador no admite el bloqueo necesario.', 'warning', 12000);
const persistencia = estadoPersistencia();
if (!persistencia.ok) toast(persistencia.error, 'danger', 12000);
document.querySelector('#brand-version')?.append(`v${APP_VERSION}`);
console.info(`PreviSmart v${APP_VERSION}`);
initNav();
initUFPill();
initInstall();
initSW();
initConexion();
onUF((e) => { window.__ufEstado = e; renderUFPill(e); });
initRespaldo();
iniciarRouter((mod) => { marcarNav(mod); verificarSW(); });
/* El aviso de offline solo se emite cuando la consulta real ya falló:
   navigator.onLine da falsos positivos en Windows con VPN/antivirus. */
arranqueUF.then(() => {
  if (!navigator.onLine) toast('Sin conexión: trabajas con datos guardados', 'warning', 5000);
});
