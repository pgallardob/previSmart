import { getClienteActivo, getCliente, subscribe } from '../core/store.js';
import { exportarIntegral, importarClienteCifrado } from '../core/respaldo-integral.js';
import { guardarArchivoCliente, nombreArchivoCliente } from '../core/archivo-cliente.js';
import { iniciarOperacion } from '../core/actividad.js';
import { abrirDialog, cerrarDialog, cablearCierre } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';

export function iniciarArchivoCliente(main) {
  const dialog = main.querySelector('#dlg-archivo-cliente');
  const form = main.querySelector('#form-archivo-cliente');
  const fileInput = main.querySelector('#cap-archivo-importar');
  const estado = main.querySelector('#cap-archivo-estado');
  const descarga = main.querySelector('#cap-archivo-descarga');
  let carpeta = null, clienteId = null, modo = 'guardar', pendiente = null;
  let ocupado = false, solicitud = 0;
  let urlLista = null, activo = getClienteActivo()?.id;
  const limpiarDescarga = () => { if (urlLista) URL.revokeObjectURL(urlLista); urlLista = null; descarga.hidden = true; descarga.removeAttribute('href'); };
  const limpiarCambio = subscribe(() => { const nuevo = getClienteActivo()?.id; if (nuevo !== activo) { activo = nuevo; limpiarDescarga(); estado.textContent = 'Cliente cambiado: no hay un archivo recién guardado para este expediente. La ubicación elegida, si existe, se conserva hasta salir de la vista.'; } });
  cablearCierre(dialog);
  const admiteCarpeta = typeof window.showDirectoryPicker === 'function';
  main.querySelector('#cap-archivo-carpeta').disabled = !admiteCarpeta;
  estado.textContent = admiteCarpeta
    ? 'Elige una ubicación para crear respaldos y una subcarpeta por cliente, o descarga el archivo cifrado.'
    : 'Este navegador no permite elegir una carpeta para escritura directa. Descarga el archivo cifrado y guárdalo en Archivos/Descargas, organizado por cliente. No se promete guardado automático en Android/iPhone.';
  main.querySelector('#cap-archivo-carpeta').addEventListener('click', async () => {
    try { carpeta = await window.showDirectoryPicker({ mode: 'readwrite' }); estado.textContent = 'Ubicación elegida: se guardará en respaldos/<cliente>/expediente.prevismart.json. Cierra la sesión al terminar.'; }
    catch (error) { if (error.name !== 'AbortError') toast('No se pudo autorizar la carpeta. Puedes descargar el archivo cifrado.', 'warning'); }
  });
  const abrir = (accion) => {
    if (ocupado) { toast('Termina o espera la cancelación de la operación actual.', 'warning'); return; }
    modo = accion; clienteId = getClienteActivo()?.id || null;
    if (modo === 'guardar' && !clienteId) { toast('Selecciona un cliente.', 'warning'); return; }
    if (modo === 'guardar') { limpiarDescarga(); estado.textContent = 'Preparando un nuevo archivo cifrado del cliente seleccionado. Todavía no se guardó en el sistema.'; }
    main.querySelector('#archivo-cliente-password').value = '';
    main.querySelector('#archivo-cliente-confirmar').value = '';
    main.querySelector('#archivo-cliente-confirmar-wrap').hidden = modo !== 'guardar';
    main.querySelector('#archivo-cliente-confirmar').required = modo === 'guardar';
    main.querySelector('#archivo-cliente-accion').textContent = modo === 'guardar' ? 'Cifrar y guardar cliente' : 'Abrir cliente cifrado';
    abrirDialog(dialog);
  };
  main.querySelector('#cap-archivo-guardar').addEventListener('click', () => abrir('guardar'));
  main.querySelector('#cap-archivo-abrir').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { pendiente = fileInput.files?.[0] || null; if (pendiente) abrir('abrir'); });
  dialog.addEventListener('close', () => { solicitud++; main.querySelector('#archivo-cliente-password').value = ''; main.querySelector('#archivo-cliente-confirmar').value = ''; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (ocupado) return;
    let password = main.querySelector('#archivo-cliente-password').value;
    const confirmation = main.querySelector('#archivo-cliente-confirmar').value;
    main.querySelector('#archivo-cliente-password').value = ''; main.querySelector('#archivo-cliente-confirmar').value = '';
    if (modo === 'guardar' && password !== confirmation) { toast('Las contraseñas no coinciden.', 'warning'); return; }
    ocupado = true;
    const ticket = ++solicitud;
    const button = main.querySelector('#archivo-cliente-accion'); button.disabled = true;
    const finalizar = iniciarOperacion();
    let completado = false;
    const accion = modo, id = clienteId, fuente = pendiente;
    const vigente = () => ticket === solicitud && dialog.open && main.isConnected && (accion !== 'guardar' || getClienteActivo()?.id === id);
    try {
      if (accion === 'guardar') {
        const cliente = getCliente(id);
        if (!cliente || getClienteActivo()?.id !== id) throw new Error('El cliente cambió; vuelve a iniciar el guardado.');
        const json = await exportarIntegral(password, { clienteId: id });
        if (!vigente()) throw new Error('Operación cancelada, vista o cliente cambiados; no se inició el guardado.');
        if (carpeta) {
          const path = await guardarArchivoCliente(carpeta, cliente, json, async () => window.confirm('Existe un archivo cifrado para este cliente. ¿Reemplazarlo con el expediente actual?'), vigente);
          if (getClienteActivo()?.id === id && main.isConnected) estado.textContent = `Archivo cifrado guardado y verificado: ${path}`;
        } else {
          limpiarDescarga();
          urlLista = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
          descarga.href = urlLista; descarga.download = nombreArchivoCliente(cliente); descarga.hidden = false;
          const creada = urlLista;
          setTimeout(() => { if (urlLista === creada) limpiarDescarga(); }, 10 * 60 * 1000);
          estado.textContent = 'Archivo cifrado listo: pulsa «Descargar archivo cifrado listo». Comprueba su ubicación y organízalo en respaldos/<cliente>. La app no confirma el guardado en Archivos del teléfono.';
        }
      } else {
        if (!fuente || fuente.size > 100 * 1024 * 1024) throw new Error('Archivo ausente o superior a 100 MB.');
        const text = await fuente.text();
        if (!vigente()) throw new Error('Apertura cancelada antes de importar.');
        const result = await importarClienteCifrado(text, password, { vigente });
        estado.textContent = `Cliente abierto con ${result.documentos} documentos; los clientes existentes no se reemplazaron.`;
      }
      completado = true;
      if (main.isConnected) cerrarDialog(dialog);
    } catch (error) {
      if (main.isConnected && (accion !== 'guardar' || getClienteActivo()?.id === id)) estado.textContent = error.message;
      toast(error.message, 'danger');
    }
    finally { password = ''; ocupado = false; finalizar(); button.disabled = false; if (completado) { pendiente = null; fileInput.value = ''; } }
  });
  return () => { solicitud++; limpiarCambio(); limpiarDescarga(); carpeta = null; pendiente = null; form.reset(); };
}
