/* PreviSmart · dialog.js — apertura/cierre accesible de <dialog>.
   Usa el elemento nativo: foco atrapado y ESC vienen incluidos. */

export function abrirDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  const primero = dialog.querySelector('input, select, textarea, button:not([data-cerrar])');
  primero?.focus();
}

export function cerrarDialog(dialog) {
  if (dialog?.open) dialog.close();
}

/** Conecta los botones con [data-cerrar] dentro de un dialog. */
export function cablearCierre(dialog) {
  dialog?.querySelectorAll('[data-cerrar]').forEach((b) => {
    b.addEventListener('click', () => dialog.close());
  });
  dialog?.addEventListener('click', (e) => {
    // Click en el backdrop (el propio dialog) cierra.
    if (e.target === dialog) dialog.close();
  });
}
