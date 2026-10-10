/* PreviSmart · router.js — enrutado por hash con vistas externas.
   Carga views/{id}.html en <main>, ejecuta features/{id}.js si el
   módulo está implementado, y pinta la pantalla "pendiente" estándar
   para los módulos de fases futuras. */

import { moduloPorId } from '../data/modulos.js';

const contenedor = () => document.getElementById('contenido');
let oyenteCambio = null;
let cargaActual = 0;
let limpiarVista = null;

function rutaActual() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  return h || 'panel';
}

export function iniciarRouter(onCambio) {
  oyenteCambio = onCambio;
  window.addEventListener('hashchange', navegar);
  navegar();
}

export async function navegar() {
  const id = rutaActual();
  const mod = moduloPorId(id);
  const ticket = ++cargaActual;
  limpiarVista?.();
  limpiarVista = null;
  // Each route owns its DOM listeners and initialization markers.
  const anterior = contenedor();
  const main = anterior.cloneNode(false);
  main.removeAttribute('data-wired');
  anterior.replaceWith(main);

  if (!mod) {
    main.innerHTML = pantallaNoEncontrada(id);
    finalizar(null);
    return;
  }

  if (mod.estado !== 'listo') {
    main.innerHTML = pantallaPendiente(mod);
    finalizar(mod);
    return;
  }

  main.innerHTML = '<div class="skeleton sk-line" aria-hidden="true"></div>';
  try {
    const [html, feat] = await Promise.all([
      fetch(`./views/${mod.id}.html`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      }),
      mod.id === 'guia-estilos' ? null : import(`../features/${mod.id}.js`)
    ]);
    if (ticket !== cargaActual) return; // el usuario ya navegó a otra vista
    main.innerHTML = html;
    if (mod.id !== 'panel') agregarVolver(main);
    limpiarVista = feat?.init?.(main) || null;
    finalizar(mod);
  } catch {
    if (ticket !== cargaActual) return;
    main.innerHTML = pantallaError(mod);
    main.querySelector('a')?.addEventListener('click', (event) => {
      event.preventDefault();
      navegar();
    });
    finalizar(mod);
  }
}

function finalizar(mod) {
  const titulo = mod ? `${mod.nombre} · PreviSmart` : 'No encontrado · PreviSmart';
  document.title = titulo;
  const main = contenedor();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
  oyenteCambio?.(mod);
}

/** Botón "Volver" al inicio de cada vista (excepto el Panel, que es inicio).
    Retrocede en el historial; si no hay (entrada directa), va al Panel. */
function agregarVolver(main) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--secondary btn--sm volver';
  btn.innerHTML = `${icono('i-chevron-left')} Volver`;
  btn.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else location.hash = '#/panel';
  });
  main.prepend(btn);
}

function icono(nombre, clase = '') {
  return `<svg class="icon ${clase}" aria-hidden="true"><use href="./assets/icons/sprite.svg#${nombre}"></use></svg>`;
}

function pantallaPendiente(mod) {
  return `
  <article class="pendiente">
    <div class="empty__icono">${icono(mod.icono)}</div>
    <h1 class="u-fs-h2">${mod.nombre}</h1>
    <p class="muted u-maxw-30 u-mx-auto">${mod.desc}</p>
    <p><span class="badge badge--accent">${icono('i-hourglass')} En desarrollo · Fase ${mod.fase}</span></p>
    <p class="muted small">Este módulo se construye en la Fase ${mod.fase} del plan de trabajo.
    Las fases se completan y verifican en orden.</p>
    <a class="btn btn--primary" href="#/panel">${icono('i-layout-dashboard')} Volver al panel</a>
  </article>`;
}

function pantallaNoEncontrada(id) {
  return `
  <article class="pendiente">
    <div class="empty__icono">${icono('i-circle-alert')}</div>
    <h1 class="u-fs-h2">Pantalla no encontrada</h1>
    <p class="muted">La ruta <code>#/${String(id).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</code> no corresponde a ningún módulo de PreviSmart.</p>
    <a class="btn btn--primary" href="#/panel">${icono('i-layout-dashboard')} Volver al panel</a>
  </article>`;
}

function pantallaError(mod) {
  return `
  <article class="pendiente">
    <div class="empty__icono">${icono('i-wifi-off')}</div>
    <h1 class="u-fs-h2">No se pudo cargar “${mod.nombre}”</h1>
    <p class="muted">Si es tu primera visita, conéctate una vez para que la app guarde sus archivos.
    Después funciona completamente sin conexión.</p>
    <a class="btn btn--secondary" href="#/${mod.id}">${icono('i-arrow-right')} Reintentar</a>
  </article>`;
}
