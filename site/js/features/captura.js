/* PreviSmart · captura.js (feature) — captura de datos del cliente:
   (1) credenciales de la sucursal virtual AFP que el afiliado entrega
   en la reunión + descarga de saldos vía servicio RPA (integracion.js),
   escritos directo en el expediente (fuente única de verdad) y
   (2) custodia de documentos oficiales (documentos.js, IndexedDB). */

import { getClienteActivo, getCliente, subscribe, actualizarExpediente } from '../core/store.js';
import {
  AFPS, getConfig, estaConfigurada,
  guardarCredenciales, getCredenciales, borrarCredenciales, tieneCredenciales,
  descargarSaldosAFP
} from '../core/integracion.js';
import { guardarDocumento, guardarDocumentos, listarDocumentos, obtenerDocumento, eliminarDocumento, etiquetaTipo } from '../core/documentos.js';
import { planearDescarga, planearDocumento, planearLote, prepararDocumentosRPA, comprobarIdentidad } from '../core/ingesta.js';
import { leerDocumento } from '../core/lectura-documentos.js';
import { iniciarOperacion } from '../core/actividad.js';
import { clp, clpDec, uf } from '../core/format.js';
import { toast } from '../ui/toast.js';
import { cablearAutorizacion, renderAutorizacion } from './autorizacion.js';
import { iniciarArchivoCliente } from './archivo-cliente.js';
import { iniciarPrivacidad, renderPrivacidad } from './privacidad.js';
import { evaluarPrivacidad } from '../core/privacidad.js';
import { getAsesor } from '../core/asesor.js';
import { PORTALES_AFP, portalAFP } from '../data/portales-afp.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const nombreAFP = (id) => AFPS.find((a) => a.id === id)?.nombre || id;
const descargasActivas = new Set();
let ticketExtraccion = 0;

export function init(main) {
  extraccionPendiente = null;
  ticketExtraccion++;
  const limpiarAutorizacion = cablearAutorizacion(main);
  const limpiarArchivo = iniciarArchivoCliente(main);
  iniciarPrivacidad(main);
  render(main);
  cablear(main);
  const limpiar = subscribe(() => render(main));
  return () => { limpiar(); limpiarAutorizacion(); limpiarArchivo(); ticketExtraccion++; extraccionPendiente = null; };
}

function cablear(main) {
  main.querySelector('#cap-subir-scomp')?.addEventListener('click', () => {
    main.querySelector('#cap-doc-tipo').value = 'certificado-ofertas';
    main.querySelector('#cap-doc-archivo').click();
  });
  main.querySelector('#cap-movil-afp')?.addEventListener('change', () => renderPortalMovil(main));
  main.querySelector('#cap-movil-cargar')?.addEventListener('click', () => {
    main.querySelector('#cap-form-doc')?.scrollIntoView({ block: 'center' });
    main.querySelector('#cap-doc-archivo')?.click();
  });
  /* ---- Credenciales del afiliado ---- */
  main.querySelector('#cap-form-cred')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const cliente = getClienteActivo();
    if (!cliente) { toast('Selecciona un cliente primero', 'warning'); return; }
    if (cliente.ingesta?.demostracion) { toast('No uses credenciales reales en el cliente de demostración. Crea otro expediente.', 'warning'); return; }
    try {
      guardarCredenciales(cliente.id, {
        afp: main.querySelector('#cap-cred-afp').value,
        rut: main.querySelector('#cap-cred-rut').value.trim(),
        usuario: main.querySelector('#cap-cred-usuario').value.trim(),
        clave: main.querySelector('#cap-cred-clave').value,
        consentimiento: main.querySelector('#cap-cred-consentimiento').checked
      });
      toast('Credenciales disponibles solo durante esta sesión de pestaña', 'success');
      main.querySelector('#cap-cred-clave').value = '';
      renderCred(main, cliente);
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  main.querySelector('#cap-cred-olvidar')?.addEventListener('click', () => {
    const cliente = getClienteActivo();
    if (!cliente) return;
    borrarCredenciales(cliente.id);
    toast('Credenciales eliminadas de la sesión', 'info');
    main.querySelector('#cap-form-cred')?.reset();
    renderCred(main, cliente);
  });

  /* ---- Descarga de saldos (autenticación como el afiliado) ---- */
  main.querySelector('#cap-descargar')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const cliente = getClienteActivo();
    if (!cliente) { toast('Selecciona un cliente primero', 'warning'); return; }
    if (!estaConfigurada()) { toast('Servicio RPA sin configurar: define el endpoint en Ajustes', 'warning'); return; }
    if (cliente.ingesta?.demostracion) { toast('La demostración no realiza conexiones AFP reales.', 'warning'); return; }
    const permiso = evaluarPrivacidad(cliente, getAsesor().nombre);
    if (!permiso.permiteConsulta) { toast(permiso.mensaje, 'warning'); return; }
    if (!tieneCredenciales(cliente.id)) { toast('El afiliado aún no ha entregado sus credenciales', 'warning'); return; }
    if (descargasActivas.has(cliente.id)) return;

    descargasActivas.add(cliente.id);
    const finalizarOperacion = iniciarOperacion();
    btn.disabled = true;
    const zona = main.querySelector('#cap-desc-resultado');
    const cred = getCredenciales(cliente.id);
    zona.innerHTML = `
      <p class="small muted u-mb-0">${icono('i-hourglass')} Autenticando como el afiliado en ${esc(nombreAFP(cred.afp))}…</p>
      <p class="tiny muted u-mt-1 u-mb-0">Microsoft Edge quedó abierto con la sesión del afiliado: login → saldos → certificados (afiliación, cotizaciones, cartola). Si la AFP pide verificación o código, resuélvelo en esa ventana. Tarda ~2–5 min.</p>`;
    try {
      const json = await descargarSaldosAFP(cliente.id);
      const vigente = getCliente(cliente.id);
      if (!evaluarPrivacidad(vigente, getAsesor().nombre).permiteConsulta) throw new Error('La autorización dejó de estar vigente durante la descarga. No se importaron datos al expediente; revisa los archivos generados por el portal.');
      planearDescarga(vigente, json, cred); // Identity and data validation precede any writes.
      const archivos = await prepararDocumentosRPA(vigente, json);
      const leidos = [];
      for (const entrada of archivos) {
        const resultado = await leerDocumento(entrada.archivo, entrada.tipo);
        if (resultado) comprobarIdentidad(vigente, resultado.perfil || {}, cred);
        leidos.push(resultado);
      }
      const idsPrevios = new Set((await listarDocumentos(cliente.id)).map((d) => d.id));
      if (!evaluarPrivacidad(getCliente(cliente.id), getAsesor().nombre).permiteConsulta) throw new Error('La autorización cambió durante la lectura. No se archivaron datos nuevos en el expediente.');
      const documentos = await guardarDocumentos(archivos);
      if (!evaluarPrivacidad(getCliente(cliente.id), getAsesor().nombre).permiteConsulta) {
        for (const doc of documentos) if (!idsPrevios.has(doc.id)) await eliminarDocumento(doc.id);
        throw new Error('La autorización cambió al archivar. Se retiraron los documentos nuevos de esta operación; los anteriores se conservaron.');
      }
      const plan = planearDescarga(getCliente(cliente.id), json, cred, documentos);
      actualizarExpediente(cliente.id, plan.patch);
      const saldos = plan.patch.saldo;
      const docsGuardados = documentos.map((d) => etiquetaTipo(d.tipo));
      if (main.isConnected && getClienteActivo()?.id === cliente.id) zona.innerHTML = `
        <div class="veredicto veredicto--success u-mt-0">
          <span class="veredicto__icono">${icono('i-circle-check')}</span>
          <div><p class="veredicto__titulo">Saldos descargados de ${esc(nombreAFP(cred.afp))}</p>
          <p class="veredicto__texto">Obligatorio <strong class="money">${clp(saldos.obligatorio)}</strong>${saldos.apv ? ` · APV ${clp(saldos.apv)}` : ''}${saldos.cuenta2 ? ` · Cuenta 2 ${clp(saldos.cuenta2)}` : ''}${docsGuardados.length ? `<br>Documentos custodiados abajo: ${esc(docsGuardados.join(', '))}.` : ''} Escritos en el expediente — revísalos en el Perfil del cliente.</p></div>
        </div>`;
      toast(plan.sinDesglose ? 'Documentos descargados. Revisa su extracción para completar el saldo sin asumir el total del portal.' : plan.conflictos.length ? `Descarga aplicada; ${plan.conflictos.length} datos distintos conservan el valor declarado.` : 'Saldos descargados y escritos en el expediente', plan.sinDesglose || plan.conflictos.length ? 'warning' : 'success');
      renderDocs(main, cliente.id);
      /* Extracción automática: la cartola recién bajada pasa directo
         por el parser — el usuario solo revisa y confirma "Importar". */
      if (main.isConnected && getClienteActivo()?.id === cliente.id) {
        const resultados = leidos.map((r, i) => r ? { ...r, documento: documentos.find((d) => d.nombreArchivo === archivos[i].archivo.name) } : null).filter(Boolean);
        if (resultados.length) mostrarLote(main, cliente.id, resultados);
      }
    } catch (err) {
      if (main.isConnected && getClienteActivo()?.id === cliente.id) zona.innerHTML = `
        <div class="veredicto veredicto--danger u-mt-0">
          <span class="veredicto__icono">${icono('i-triangle-alert')}</span>
          <div><p class="veredicto__titulo">No se pudo descargar</p>
          <p class="veredicto__texto">${esc(err.message)} — mientras tanto puedes ingresar los saldos a mano en el Perfil del cliente o subir el Certificado de Saldo en PDF.</p></div>
        </div>`;
      toast('Falló la descarga desde la AFP', 'danger');
    } finally {
      finalizarOperacion();
      descargasActivas.delete(cliente.id);
      btn.disabled = false;
      renderCred(main, getClienteActivo());
    }
  });

  /* ---- Carga de documentos ---- */
  main.querySelector('#cap-form-doc')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cliente = getClienteActivo();
    const archivo = main.querySelector('#cap-doc-archivo')?.files?.[0];
    const tipo = main.querySelector('#cap-doc-tipo')?.value || 'otro';
    if (!cliente) { toast('Selecciona un cliente primero', 'warning'); return; }
    if (!archivo) { toast('Elige un archivo PDF', 'warning'); return; }
    try {
      const resultado = await leerDocumento(archivo, tipo);
      if (tipo === 'certificado-ofertas' && resultado?.tipo !== 'scomp') throw new Error('No se reconoció un Certificado de Ofertas SCOMP en este archivo. No se incorporó como fuente SCOMP.');
      if (resultado) comprobarIdentidad(cliente, resultado.perfil || {});
      if (resultado?.tipo === 'scomp') planearDocumento(cliente, resultado, null);
      const documento = await guardarDocumento({ clienteId: cliente.id, clienteNombre: cliente.nombre, tipo: resultado?.tipoDoc || tipo, archivo });
      toast(`${etiquetaTipo(tipo)} guardado en el expediente`, 'success');
      e.target.reset();
      renderDocs(main, cliente.id);
      if (resultado) mostrarLote(main, cliente.id, [{ ...resultado, documento }]);
    } catch (err) {
      toast(`No se pudo guardar: ${err.message}`, 'danger');
    }
  });

  main.querySelector('#cap-doc-lista')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-doc]');
    if (!btn) return;
    const id = btn.dataset.doc;
    if (btn.dataset.acciondoc === 'ver') {
      const doc = await obtenerDocumento(id);
      if (!doc?.blob) return;
      const url = URL.createObjectURL(doc.blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    if (btn.dataset.acciondoc === 'guardar') {
      const doc = await obtenerDocumento(id);
      if (!doc?.blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(doc.blob);
      a.download = doc.nombreArchivo || 'documento.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }
    if (btn.dataset.acciondoc === 'extraer') {
      const doc = await obtenerDocumento(id);
      if (!doc?.blob) return;
      flujoExtraccion(main, doc.blob, doc.nombreArchivo, doc.tipo, doc);
    }
    if (btn.dataset.acciondoc === 'eliminar') {
      const doc = await obtenerDocumento(id);
      await eliminarDocumento(id);
      const cliente = getCliente(doc?.clienteId);
      if (cliente?.scomp?.certificados?.some((s) => s.documentoId === id)) {
        actualizarExpediente(cliente.id, { scomp: { ...cliente.scomp,
          certificados: cliente.scomp.certificados.map((s) => s.documentoId === id ? { ...s, originalEliminado: true } : s) } });
      }
      toast('Documento eliminado', 'info');
      renderDocs(main, getClienteActivo()?.id);
    }
  });
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#cap-vacio');
  const cuerpo = main.querySelector('#cap-cuerpo');

  if (!cliente) {
    renderAutorizacion(main, null);
    renderPrivacidad(main, null);
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-download')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente para capturar sus credenciales AFP o subir sus documentos oficiales.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }

  vacio.innerHTML = '';
  cuerpo.hidden = false;
  renderPrivacidad(main, cliente);
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  main.querySelector('#cap-rpa-contenedor').hidden = !local;
  main.querySelector('#cap-rpa-info').hidden = local;
  const seleccion = main.querySelector('#cap-movil-afp');
  seleccion.innerHTML = '<option value="">Selecciona la AFP</option>' + PORTALES_AFP.map((p) => `<option value="${p.id}">AFP ${esc(p.nombre)}</option>`).join('');
  seleccion.value = portalAFP(cliente.perfil?.afp)?.id || '';
  renderPortalMovil(main);
  renderAutorizacion(main, cliente);
  renderCred(main, cliente);
  renderDocs(main, cliente.id);
  renderAuditoria(main, cliente);
}

function renderPortalMovil(main) {
  const portal = portalAFP(main.querySelector('#cap-movil-afp')?.value);
  const enlace = main.querySelector('#cap-movil-portal');
  enlace.hidden = !portal;
  if (portal) {
    enlace.href = portal.url;
    enlace.textContent = `Abrir sitio oficial de AFP ${portal.nombre}`;
  } else enlace.removeAttribute('href');
  main.querySelector('#cap-movil-estado').textContent = portal
    ? `Se abrirá ${new URL(portal.url).hostname}. El inicio de sesión y la descarga se realizan allí; PreviSmart no lee esa sesión ni importa documentos automáticamente.`
    : 'Selecciona la AFP para abrir su sitio oficial.';
}

function renderAuditoria(main, cliente) {
  const zona = main.querySelector('#cap-auditoria');
  if (!zona) return;
  const ultimo = cliente.ingesta?.eventos?.at(-1);
  const campos = ['nombre', 'apellidoPaterno', 'apellidoMaterno', 'rut', 'fechaNacimiento', 'sexo', 'estadoCivil', 'afp', 'direccion', 'telefono', 'email', 'mesesCotizados', 'promedioRemuneraciones'];
  const faltantes = campos.filter((key) => cliente.perfil?.[key] == null || cliente.perfil[key] === '');
  zona.innerHTML = `${ultimo ? `<p class="small">Última fuente: <strong>${esc(ultimo.fuente)}</strong> · ${esc(ultimo.fecha)} · ${ultimo.campos.length} campos/secciones aplicados.</p>
    ${ultimo.conflictos.length ? `<p class="small">Se conservaron los valores declarados en: ${ultimo.conflictos.map(esc).join(', ')}.</p>` : ''}` : '<p class="small muted">Todavía no hay una importación trazada para este cliente.</p>'}
    <p class="small muted">${faltantes.length ? `Campos sin datos de fuente: ${faltantes.map(esc).join(', ')}. No se completan con valores supuestos.` : 'Los campos básicos tienen datos; verifica las declaraciones y las fuentes antes de solicitar ofertas.'}</p>`;
}

function renderCred(main, cliente) {
  const estado = main.querySelector('#cap-cred-estado');
  const form = main.querySelector('#cap-form-cred');
  if (!estado || !form || !cliente) return;
  if (form.dataset.clienteConsentimiento !== cliente.id) {
    form.dataset.clienteConsentimiento = cliente.id;
    form.querySelector('#cap-cred-consentimiento').checked = false;
    main.querySelector('#cap-desc-resultado').innerHTML = '';
  }

  const cfg = getConfig();
  const cred = getCredenciales(cliente.id);
  const perfilAFP = String(cliente.perfil?.afp || '').toLowerCase();
  const afpAuto = AFPS.find((a) => perfilAFP.includes(a.id))?.id;

  estado.textContent = cred
    ? `${nombreAFP(cred.afp)} · usuario listo`
    : 'sin credenciales';
  estado.className = `badge ${cred ? 'badge--success' : 'badge--neutral'}`;

  /* preselección: la AFP del perfil, o la guardada */
  form.querySelector('#cap-cred-afp').value = cred?.afp || afpAuto || 'provida';
  form.querySelector('#cap-cred-rut').value = cred?.rut || cliente.perfil?.rut || '';
  form.querySelector('#cap-cred-usuario').value = cred?.usuario || '';
  form.querySelector('#cap-cred-clave').value = '';
  form.querySelector('#cap-cred-clave').placeholder = cred ? '•••••••• (guardada — escribe para cambiar)' : 'La que usa en su AFP';

  /* estado del servicio RPA: el botón se habilita cuando hay endpoint
     configurado Y credenciales — y se explica qué falta si no. */
  const btn = main.querySelector('#cap-descargar');
  const falta = [];
  if (!estaConfigurada()) falta.push('configurar el endpoint en <a href="#/ajustes">Ajustes → Servicio RPA</a>');
  if (!cred) falta.push('guardar las credenciales del afiliado');
  const permiso = evaluarPrivacidad(cliente, getAsesor().nombre);
  if (!permiso.permiteConsulta) falta.push(esc(permiso.mensaje));
  if (cliente.ingesta?.demostracion) falta.push('crear un expediente real separado de la demostración');
  if (btn) btn.disabled = falta.length > 0 || descargasActivas.has(cliente.id);
  const aviso = main.querySelector('#cap-desc-resultado');
  if (aviso && !aviso.querySelector('.veredicto')) {
    aviso.innerHTML = falta.length
      ? `<p class="small muted u-mb-0">${icono('i-info')} Para descargar falta ${falta.join(' y ')}.</p>`
      : '';
  }
}

async function renderDocs(main, clienteId) {
  const zona = main.querySelector('#cap-doc-lista');
  if (!zona || !clienteId) return;
  try {
    const docs = await listarDocumentos(clienteId);
    if (!main.isConnected || getClienteActivo()?.id !== clienteId) return;
    zona.innerHTML = docs.length ? `
      <table class="tabla tabla--desglose">
        <colgroup><col class="c-label"><col class="c-monto"><col class="c-uf"></colgroup>
        <thead><tr><th>Documento</th><th>Archivo · tamaño</th><th>Acciones</th></tr></thead>
        <tbody>
          ${docs.map((d) => `
            <tr>
              <td><strong>${esc(etiquetaTipo(d.tipo))}</strong><br><span class="tiny muted">${esc(d.fecha.slice(0, 10))}</span></td>
              <td>${esc(d.nombreArchivo)}<br><span class="tiny muted">${kb(d.tamano)}</span></td>
              <td class="u-flex u-col u-gap-1">
                <button class="btn btn--ghost btn--sm" type="button" data-doc="${esc(d.id)}" data-acciondoc="ver">${icono('i-external-link')} Ver</button>
                <button class="btn btn--ghost btn--sm" type="button" data-doc="${esc(d.id)}" data-acciondoc="extraer">${icono('i-search')} Extraer</button>
                <button class="btn btn--ghost btn--sm" type="button" data-doc="${esc(d.id)}" data-acciondoc="guardar">${icono('i-download')} Guardar</button>
                <button class="btn btn--ghost btn--sm" type="button" data-doc="${esc(d.id)}" data-acciondoc="eliminar">${icono('i-x')} Eliminar</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>` : `
      <p class="small muted u-mb-0">Sin documentos cargados para este cliente. El Certificado de Saldo y el Certificado de Ofertas son el respaldo legal de los datos del expediente (presiso.md).</p>`;
  } catch {
    zona.innerHTML = `<p class="small muted u-mb-0">No se pudo leer el almacén de documentos.</p>`;
  }
}

/* ================= Extracción de datos desde PDFs oficiales =================
   Los documentos que emiten AFP/SCOMP son PDF digitales: se les extrae
   el texto (pdf.js vendored, en el dispositivo) y se parsean los campos.
   El resultado se muestra para REVISIÓN y solo se escribe en el
   expediente si el asesor confirma — nada se aplica a ciegas. */

let extraccionPendiente = null;

async function flujoExtraccion(main, archivo, nombreArchivo = 'documento.pdf', tipoDoc = null, documento = null) {
  const clienteId = getClienteActivo()?.id;
  const ticket = ++ticketExtraccion;
  extraccionPendiente = null;
  const zona = main.querySelector('#cap-extraccion');
  if (!zona) return;
  if (!/pdf/i.test(archivo.type || '') && !/\.pdf$/i.test(archivo.name || nombreArchivo)) return;
  zona.innerHTML = `<article class="card"><p class="small muted u-mb-0">${icono('i-hourglass')} Leyendo el documento…</p></article>`;
  try {
    /* una sola pasada: estructura posicional + texto reconstruido */
    const resultado = await leerDocumento(archivo, tipoDoc);
    if (ticket !== ticketExtraccion || !main.isConnected || getClienteActivo()?.id !== clienteId) return;
    if (!resultado) {
      zona.innerHTML = '';
      toast('Documento guardado. No se reconoció su tipo para extraer datos', 'info');
      return;
    }
    const tipoReconocido = resultado.tipoDoc || tipoDoc;
    planearDocumento(getClienteActivo(), { ...resultado, tipoDoc: tipoReconocido }, documento); // Reject mismatched identity before confirmation.
    extraccionPendiente = { ...resultado, tipoDoc: tipoReconocido, clienteId, documento: documento ? { id: documento.id, sha256: documento.sha256, tipo: documento.tipo } : null };
    renderExtraccion(main, resultado, nombreArchivo);
  } catch (error) {
    if (ticket !== ticketExtraccion || !main.isConnected) return;
    zona.innerHTML = '';
    toast(error.message || 'No se pudo leer el documento.', 'warning');
  }
}

function mostrarLote(main, clienteId, resultados) {
  if (!main.isConnected || getClienteActivo()?.id !== clienteId) return;
  if (resultados.length === 1) {
    extraccionPendiente = { ...resultados[0], clienteId };
    renderExtraccion(main, resultados[0], resultados[0].documento?.nombreArchivo || 'Documento descargado');
    return;
  }
  const plan = planearLote(getClienteActivo(), resultados);
  extraccionPendiente = { tipo: 'lote', clienteId, resultados };
  renderExtraccion(main, { tipo: 'lote', perfil: plan.patch.perfil, saldo: plan.patch.saldo, conflictos: plan.conflictos,
    detectado: resultados.map((r) => `${etiquetaTipo(r.tipoDoc)}: ${Object.keys(r.perfil || {}).join(', ') || 'sin datos personales'}${r.cotizaciones ? `; ${r.cotizaciones.mesesObservados} meses observados (no vida laboral completa)` : ''}`) }, `${resultados.length} documentos descargados`);
}

function renderExtraccion(main, r, nombreArchivo) {
  const zona = main.querySelector('#cap-extraccion');
  const cliente = getClienteActivo();
  const actuales = cliente?.ofertas?.length || 0;
  const lineas = [];

  if (r.tipo === 'scomp') {
    const s = r.scomp || {}, p = r.perfil || {}, sa = r.saldo || {}, me = r.meta || {};
    const sexoTxt = p.sexo === 'F' ? 'mujer' : p.sexo === 'M' ? 'hombre' : '';
    if (s.codigoConsulta) lineas.push(`<strong>Consulta SCOMP</strong> ${esc(s.codigoConsulta)} · emitido ${esc(s.fechaEmision || '—')} · vigente ${esc(s.vigenciaDesde || '?')} → ${esc(s.vigenciaHasta || '?')} · máx. ${s.maxConsultas ?? '—'} solicitudes`);
    if (p.rut || p.nombre) lineas.push(`<strong>Afiliado</strong> ${esc([p.nombre, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(' '))} · RUT ${esc(p.rut || '—')} · ${esc(p.afp || '')} · nac. ${esc(p.fechaNacimiento || '—')} · ${esc([sexoTxt, p.estadoCivil].filter(Boolean).join(' · '))}`);
    if (sa.obligatorio) lineas.push(`<strong>Saldo destinado a pensión</strong> ${uf(sa.saldoDestinadoUF)} UF · <span class="money">${clp(sa.obligatorio)}</span> (UF emisión ${clpDec(sa.ufEmisionCLP)})`);
    if (sa.pensionEstimadaUF) lineas.push(`<strong>Pensión retiro programado (1er año)</strong> ${uf(sa.pensionEstimadaUF)} UF${sa.pensionEstimadaCLP ? ` · ${clp(sa.pensionEstimadaCLP)}` : ''}`);
    if (r.beneficiarios?.length) lineas.push(`<strong>Beneficiarios</strong> ${r.beneficiarios.map((b) => esc(b.nombre || b.rut)).join(', ')}`);
    if (r.ofertas?.length) {
      const mejor = Math.max(...r.ofertas.map((o) => o.pensionUF || 0));
      const conClausula = r.ofertas.filter((o) => o.periodoGarantizadoAnios).length;
      lineas.push(`<strong>Ofertas detectadas</strong> ${r.ofertas.length} (${conClausula} con cláusula garantizada/aumento) · mejor: ${uf(mejor)} UF/mes`);
    }
    if (me.pguMontoCLP) lineas.push(`<strong>PGU referencia</strong> ${clp(me.pguMontoCLP)} hasta ${esc(me.pguVigenciaHasta || '—')}`);
  } else {
    const p = r.perfil || {};
    if (p.rut) lineas.push(`<strong>RUT</strong> ${esc(p.rut)}${p.afp ? ` · ${esc(p.afp)}` : ''}`);
    for (const d of r.detectado || []) lineas.push(`<strong>Detectado</strong> ${esc(d)}`);
    if (!lineas.length) lineas.push('<strong>Sin campos reconocibles</strong> — certificado con formato aún no mapeado');
  }

  if (r.saldo?.cartolaReferencia) {
    const cartola = r.saldo.cartolaReferencia;
    lineas.push(`<strong>Saldo del portal conservado</strong> ${clp(r.saldo.obligatorio)} · captura ${esc(r.saldo.capturadoEn?.slice(0, 10) || 'sin fecha')}`);
    lineas.push(`<strong>Cartola como referencia separada</strong> ${clp(cartola.obligatorio)} · corte ${esc(cartola.saldoAl || 'sin fecha')}. No reemplaza el saldo capturado en el portal. Distintos cortes no prueban un error ni cotizaciones impagas.`);
  }
  if (r.conflictos?.length) lineas.push(`<strong>Diferencias conservadas para revisión</strong> ${esc(r.conflictos.join(', '))}`);

  const hayAlgo = r.tipo === 'scomp'
    ? (r.ofertas?.length || r.saldo?.obligatorio || Object.keys(r.perfil || {}).length)
    : Object.keys(r.saldo || {}).length || Object.keys(r.perfil || {}).length;

  zona.innerHTML = `
    <article class="card">
      <div class="u-flex u-items-center u-justify-between u-gap-2 u-wrap">
        <h3 class="u-mt-0 u-mb-0">Datos detectados en el documento</h3>
        <span class="badge badge--info">${r.tipo === 'lote' ? 'Extracción conjunta' : r.tipo === 'scomp' ? 'Certificado de Ofertas SCOMP' : r.tipo === 'antecedentes' ? esc(etiquetaTipo(r.tipoDoc)) : r.esCartola ? 'Cartola AFP' : 'Certificado de Saldo'}</span>
      </div>
      <p class="tiny muted u-mt-2 u-mb-0">${esc(nombreArchivo)}</p>
      <div class="small u-mt-3 u-flex u-col u-gap-2">${lineas.map((l) => `<p class="u-mb-0">${l}</p>`).join('')}</div>
      ${r.tipo === 'scomp' ? `<p class="small u-mt-3 u-mb-0">La importación conserva el saldo AFP y las ${actuales} ofertas registradas. Archivará los datos de este SCOMP por separado y activará su uso en los documentos consolidados; no acepta una oferta.</p>` : ''}
      <div class="dlg-actions">
        <button class="btn btn--ghost btn--sm" type="button" id="cap-ext-descartar">Descartar</button>
        <button class="btn btn--primary btn--sm" type="button" id="cap-ext-aplicar" ${hayAlgo ? '' : 'disabled'}>
          ${icono('i-circle-check')} Importar al expediente
        </button>
      </div>
    </article>`;

  zona.querySelector('#cap-ext-descartar')?.addEventListener('click', () => {
    extraccionPendiente = null;
    zona.innerHTML = '';
  });
  zona.querySelector('#cap-ext-aplicar')?.addEventListener('click', () => {
    if (extraccionPendiente && !aplicarExtraccion(main, extraccionPendiente)) return;
    extraccionPendiente = null;
    zona.innerHTML = '';
  });
}

/** Escribe lo extraído en el expediente del cliente activo (confirmado). */
function aplicarExtraccion(main, r) {
  const cliente = getClienteActivo();
  if (!cliente || cliente.id !== r.clienteId) {
    toast('El documento pertenece a otro cliente. Vuelve a extraerlo en su expediente.', 'warning');
    return;
  }
  try {
    const plan = r.tipo === 'lote' ? planearLote(cliente, r.resultados) : planearDocumento(cliente, r, r.documento);
    actualizarExpediente(cliente.id, plan.patch);
    toast(plan.conflictos.length ? `Documento aplicado; ${plan.conflictos.length} campos declarados se conservaron por diferencias.` : 'Expediente actualizado desde el documento', plan.conflictos.length ? 'warning' : 'success');
    return true;
  } catch (error) {
    toast(error.message, 'danger');
    return false;
  }
}
