import { getClienteActivo } from '../core/store.js';
import { aISO, hoy } from '../core/dates.js';
import { prepararAutorizacion, textoAutorizacion, htmlAutorizacion } from '../core/autorizacion.js';
import { vencimientoRetencion } from '../core/retencion.js';
import { toast } from '../ui/toast.js';
import { getAsesor, contactoAsesor } from '../core/asesor.js';

function leer(main) {
  return { fecha: main.querySelector('#cap-aut-fecha').value, responsable: main.querySelector('#cap-aut-responsable').value,
    contacto: main.querySelector('#cap-aut-contacto').value };
}

export function renderAutorizacion(main, cliente) {
  const zona = main.querySelector('#cap-aut-preview');
  const hasta = main.querySelector('#cap-aut-hasta');
  const status = main.querySelector('#cap-aut-calendario');
  try { hasta.value = vencimientoRetencion(main.querySelector('#cap-aut-fecha').value); status.textContent = '30 días hábiles desde la firma: no cuenta el día inicial; excluye fines de semana y feriados nacionales del calendario disponible.'; }
  catch (error) { hasta.value = ''; status.textContent = error.message; zona.textContent = error.message; return; }
  if (!cliente) { zona.innerHTML = ''; return; }
  try { zona.innerHTML = htmlAutorizacion(prepararAutorizacion(cliente, leer(main))); }
  catch (error) { zona.textContent = error.message; }
}

export function cablearAutorizacion(main) {
  const asesor = getAsesor();
  main.querySelector('#cap-aut-responsable').value = asesor.nombre;
  main.querySelector('#cap-aut-contacto').value = contactoAsesor(asesor);
  main.querySelector('#cap-aut-fecha').value = aISO(hoy());
  main.querySelectorAll('#cap-aut-form input').forEach((el) => el.addEventListener('input', () => renderAutorizacion(main, getClienteActivo())));
  main.querySelector('#cap-aut-descargar').addEventListener('click', () => {
    try {
      const modelo = prepararAutorizacion(getClienteActivo(), leer(main));
      const url = URL.createObjectURL(new Blob([textoAutorizacion(modelo)], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `prevismart-autorizacion-${modelo.fecha}.txt`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('Plantilla descargada sin firma ni credenciales. Completa y firma antes de consultar.', 'info');
    } catch (error) { toast(error.message, 'danger'); }
  });
  main.querySelector('#cap-aut-imprimir').addEventListener('click', () => {
    try {
      const modelo = prepararAutorizacion(getClienteActivo(), leer(main));
      main.querySelector('#cap-aut-preview').innerHTML = htmlAutorizacion(modelo);
      document.body.classList.add('impresion-autorizacion');
      window.addEventListener('afterprint', () => document.body.classList.remove('impresion-autorizacion'), { once: true });
      window.print();
    } catch (error) { document.body.classList.remove('impresion-autorizacion'); toast(error.message, 'danger'); }
  });
  return () => { document.body.classList.remove('impresion-autorizacion'); };
}
