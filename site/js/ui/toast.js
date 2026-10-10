/* PreviSmart · toast.js — notificaciones breves no bloqueantes */

const DURACION = 4000;

/** Muestra un toast. tipo: 'info' | 'success' | 'warning' | 'danger' */
export function toast(mensaje, tipo = 'info', ms = DURACION) {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const iconos = {
    info: 'i-info', success: 'i-circle-check',
    warning: 'i-triangle-alert', danger: 'i-circle-alert'
  };

  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${iconos[tipo] || iconos.info}"></use></svg><span></span>`;
  el.querySelector('span').textContent = mensaje;
  region.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast--out');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 500); // respaldo
  }, ms);
}
