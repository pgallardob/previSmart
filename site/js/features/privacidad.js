import { getClienteActivo, guardarSeccion } from '../core/store.js';
import { getAsesor } from '../core/asesor.js';
import { registrarAutorizacion, registrarRevocacion, evaluarPrivacidad } from '../core/privacidad.js';
import { toast } from '../ui/toast.js';

function ayudarReferencia(main) {
  const ejemplos = {
    'archivo-local': 'Ejemplo: carpeta del cliente / Autorizacion-firmada.pdf',
    papel: 'Ejemplo: carpeta física del cliente, sección Autorizaciones',
    correo: 'Ejemplo: asunto y fecha del correo que contiene la autorización',
    otra: 'Describe dónde está y cómo identificar el documento firmado'
  };
  main.querySelector('#cap-priv-referencia').placeholder = ejemplos[main.querySelector('#cap-priv-soporte').value]
    || 'Nombre del archivo, carpeta o identificación del documento';
  main.querySelector('#cap-priv-ejemplo').textContent = ejemplos[main.querySelector('#cap-priv-soporte').value]
    || 'Selecciona dónde lo guardaste para ver un ejemplo de qué escribir.';
}

export function renderPrivacidad(main, cliente) {
  const status = main.querySelector('#cap-priv-estado');
  const form = main.querySelector('#cap-priv-form');
  if (!cliente) { status.textContent = ''; return; }
  const resultado = evaluarPrivacidad(cliente, getAsesor().nombre);
  status.textContent = resultado.mensaje;
  if (form.dataset.cliente !== cliente.id) {
    form.dataset.cliente = cliente.id;
    form.reset();
    main.querySelector('#cap-priv-fecha').value = cliente.ruta?.privacidad?.fechaFirma || '';
    main.querySelector('#cap-priv-referencia').value = cliente.ruta?.privacidad?.referencia || '';
    main.querySelector('#cap-priv-soporte').value = cliente.ruta?.privacidad?.soporte || '';
    ayudarReferencia(main);
  }
  main.querySelector('#cap-priv-revocar').disabled = !cliente.ruta?.privacidad?.firmaCotejada || resultado.estado === 'revocada';
}

export function iniciarPrivacidad(main) {
  main.querySelector('#cap-priv-soporte').addEventListener('change', () => ayudarReferencia(main));
  main.querySelector('#cap-priv-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const c = getClienteActivo();
    try {
      if (!main.querySelector('#cap-priv-soporte').value) throw new Error('Selecciona dónde conservas la autorización firmada.');
      const ruta = registrarAutorizacion(c, { fechaFirma: main.querySelector('#cap-priv-fecha').value,
        referencia: main.querySelector('#cap-priv-referencia').value, soporte: main.querySelector('#cap-priv-soporte').value,
        firmaCotejada: main.querySelector('#cap-priv-cotejo').checked, responsable: getAsesor().nombre });
      guardarSeccion(c.id, 'ruta', ruta);
      main.querySelector('#cap-priv-cotejo').checked = false;
      const ubicacion = main.querySelector('#cap-priv-soporte').selectedOptions[0].textContent;
      toast(`Autorización registrada. Ubicación declarada: ${ubicacion}.`, 'success');
    } catch (error) { toast(error.message, 'danger'); }
  });
  main.querySelector('#cap-priv-revocar').addEventListener('click', () => {
    const c = getClienteActivo();
    if (!c || !window.confirm('¿Registrar la revocación declarada por el afiliado? Se bloquearán nuevas consultas AFP, sin borrar documentos ni copias automáticamente.')) return;
    try { guardarSeccion(c.id, 'ruta', registrarRevocacion(c)); toast('Revocación registrada; revisa conservación y solicitudes del afiliado', 'info'); }
    catch (error) { toast(error.message, 'danger'); }
  });
}
