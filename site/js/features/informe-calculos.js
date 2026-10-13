import { getClienteActivo, subscribe } from '../core/store.js';
import { getUF, onUF } from '../core/uf.js';
import { modeloInformeCalculos } from '../core/informe-calculos.js';
import { crearPDFInforme } from '../core/informe-pdf.js';
import { toast } from '../ui/toast.js';
import { onParametros } from '../core/parametros-normativos.js';

/** Explicit ready link works on phones without opening a popup after an asynchronous task. */
export function iniciarDescargaCalculos(main, prefijo) {
  const button = main.querySelector(`#${prefijo}-generar-pdf`);
  const link = main.querySelector(`#${prefijo}-descargar-pdf`);
  const preview = main.querySelector(`#${prefijo}-ver-pdf`);
  const status = main.querySelector(`#${prefijo}-pdf-estado`);
  if (!button || !link || !status) return () => {};
  let ticket = 0, url = null;
  const limpiar = () => {
    ticket++;
    if (url) URL.revokeObjectURL(url);
    url = null; link.hidden = true; link.removeAttribute('href'); status.textContent = ''; button.disabled = false;
    if (preview) { preview.hidden = true; preview.removeAttribute('href'); }
  };
  const unsub = subscribe(limpiar), unsubUF = onUF(limpiar);
  const unsubParametros = onParametros(limpiar);
  const estadosAnexo = new Map();
  const antesImprimir = () => main.querySelectorAll('details.cliente-anexo').forEach((el) => { if (!estadosAnexo.has(el)) estadosAnexo.set(el, el.open); el.open = true; });
  const despuesImprimir = () => { estadosAnexo.forEach((open, el) => { el.open = open; }); estadosAnexo.clear(); };
  window.addEventListener('beforeprint', antesImprimir); window.addEventListener('afterprint', despuesImprimir);
  button.addEventListener('click', async () => {
    const c = getClienteActivo();
    if (!c) { toast('Selecciona un cliente.', 'warning'); return; }
    limpiar(); const actual = ticket; const id = c.id;
    const modelo = modeloInformeCalculos(c, getUF());
    button.disabled = true; status.textContent = 'Generando PDF local, sin enviar datos a un servidor…';
    try {
      const bytes = await crearPDFInforme(modelo);
      if (!main.isConnected || actual !== ticket || getClienteActivo()?.id !== id) return;
      url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      link.href = url; link.download = `PreviSmart-informe-no-oficial-${id}-${modelo.generadoEn.slice(0, 10)}.pdf`; link.hidden = false;
      if (preview) { preview.href = url; preview.hidden = false; }
      status.textContent = 'PDF listo. Descárgalo para guardar o abrir el mismo informe no oficial revisado en pantalla.';
    } catch (error) { if (main.isConnected && actual === ticket) status.textContent = `No se generó el PDF: ${error.message}`; }
    finally { if (actual === ticket) button.disabled = false; }
  });
  return () => { unsub(); unsubUF(); unsubParametros(); limpiar(); window.removeEventListener('beforeprint', antesImprimir); window.removeEventListener('afterprint', despuesImprimir); despuesImprimir(); };
}
