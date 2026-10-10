import { edadExacta, parseLocal, aISO, hoy } from './dates.js';
import { fechaCorta } from './format.js';
import { DIAS_RETENCION, vencimientoRetencion } from './retencion.js';

export const VERSION_AUTORIZACION = '1.2';
const texto = (v) => typeof v === 'string' ? v.trim().replace(/[\r\n\t]+/g, ' ') : '';
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pendiente = (v) => v || '________________ (completar antes de firmar)';

/** Explicit field allowlist. Credentials and arbitrary portfolio sections never enter this document. */
export function prepararAutorizacion(cliente, opciones = {}) {
  if (!cliente) throw new Error('Selecciona un cliente.');
  const perfil = cliente.perfil || {};
  const fecha = opciones.fecha || aISO(hoy());
  const ref = parseLocal(fecha);
  if (!ref || fecha !== aISO(ref)) throw new Error('Fecha de autorización inválida.');
  const nacimiento = parseLocal(perfil.fechaNacimiento);
  const edad = nacimiento ? edadExacta(nacimiento, ref) : null;
  const base = texto(perfil.nombre);
  const apellidos = [texto(perfil.apellidoPaterno), texto(perfil.apellidoMaterno)].filter(Boolean).join(' ');
  const nombre = base ? apellidos && !base.toLocaleLowerCase('es').endsWith(apellidos.toLocaleLowerCase('es')) ? `${base} ${apellidos}` : base : texto(cliente.nombre);
  const sexo = { M: 'Masculino', F: 'Femenino' }[perfil.sexo] || texto(perfil.sexo);
  const responsable = texto(opciones.responsable);
  const contacto = texto(opciones.contacto);
  const conservarHasta = vencimientoRetencion(fecha);
  const fin = parseLocal(conservarHasta);
  if (opciones.conservarHasta && opciones.conservarHasta !== conservarHasta) throw new Error('La fecha límite debe coincidir con 30 días hábiles desde la firma.');
  const faltantes = [
    !nombre && 'nombre del afiliado', !texto(perfil.rut) && 'RUT del afiliado', !edad && 'fecha de nacimiento válida',
    !sexo && 'sexo registrado', !texto(perfil.afp) && 'AFP', !responsable && 'responsable de la custodia',
    !contacto && 'contacto para solicitudes', !fin && 'fecha límite de conservación'
  ].filter(Boolean);
  const datos = [
    ['Nombre', pendiente(nombre)], ['RUT', pendiente(texto(perfil.rut))],
    ['Edad a la fecha de autorización', edad ? `${edad.anios} años` : pendiente('')],
    ['Sexo registrado', pendiente(sexo)], ['AFP', pendiente(texto(perfil.afp))],
    ['Fecha de autorización propuesta', fechaCorta(fecha)],
    ['Email', texto(perfil.email) || 'No registrado; completar si corresponde'],
    ['Teléfono', texto(perfil.telefono) || 'No registrado; completar si corresponde'],
    ['Responsable de tratamiento y custodia', pendiente(responsable)],
    ['Contacto del responsable para solicitudes', pendiente(contacto)],
    ['Plazo de conservación elegido', `${DIAS_RETENCION} días hábiles desde la firma de esta autorización`],
    ['Fecha límite de conservación calculada', fechaCorta(conservarHasta)]
  ];
  const secciones = [
    ['1. Consulta y descarga autorizadas', 'Autorizo expresamente al responsable identificado en este documento a consultar, en mi presencia, mi información previsional en la AFP indicada y a descargar los documentos que yo solicite para esta atención: saldos por cuenta, certificado de afiliación, certificado de cotizaciones y cartolas disponibles. La consulta se realiza en modo lectura. Los certificados de saldo u ofertas que aporte por otro canal también podrán incorporarse para la misma finalidad.'],
    ['2. Uso y conservación de datos y documentos', 'Autorizo expresamente a recopilar, registrar, consultar y conservar mis datos personales y previsionales y los archivos PDF originales en mi expediente local PreviSmart, con el único propósito de analizar mis antecedentes, comparar alternativas documentadas y preparar propuestas previsionales no oficiales. Esta autorización incluye los datos de identificación y contacto indicados arriba y los saldos y cotizaciones necesarios para esa finalidad. No autoriza recopilar información ajena a ella ni publicidad o uso comercial distinto.'],
    ['3. Credenciales y verificación presencial', 'Ingreso personalmente mi usuario y clave en la app local. Se usan para esta consulta y permanecen temporalmente en la sesión de pestaña; deben eliminarse al terminar la atención mediante «Olvidar credenciales» y cerrar la sesión. No se incorporan al documento, a los PDF, a las impresiones ni a los respaldos de cartera. Los códigos y CAPTCHA los resuelvo personalmente; esta autorización no permite eludir verificaciones del portal.'],
    ['4. Custodia, plazo y destinatarios', 'El responsable custodiará los documentos localmente en su propia instalación, con acceso restringido y almacenamiento cifrado para los archivos guardados. No se comparte automáticamente mi expediente con otros asesores ni se promete una copia en otro equipo: el almacenamiento único puede perderse si falla el dispositivo o se pierde su clave. El plazo elegido es de 30 días hábiles desde la firma de esta autorización. El día de firma no se cuenta; se excluyen sábados, domingos y los feriados nacionales incluidos en el calendario de la app. El responsable verificará feriados adicionales o regionales aplicables y que la fecha elegida coincida con la firma efectiva. Si se firma en otra fecha, debe regenerarse el documento antes de firmar. Este plazo es una política acordada, no un plazo legal certificado. Al vencer se revisará la eliminación del expediente y cualquier copia existente, salvo obligación legal aplicable que el responsable deberá explicar y documentar. No se autoriza compartir datos con terceros para otros fines. La entrega a una AFP, aseguradora, asesor u otro destinatario requiere mi autorización específica, salvo obligación legal aplicable. La app no ejecuta automáticamente la eliminación al vencer esa fecha: el responsable debe controlar y documentar el cumplimiento.'],
    ['5. Solicitudes y revocación', 'Puedo solicitar acceso, rectificación y eliminación de mis datos, o revocar esta autorización para futuras consultas y usos, mediante el contacto indicado arriba. El responsable me informará de las obligaciones legales de conservación que puedan impedir una eliminación inmediata. Revocar no deshace consultas realizadas antes de recibir la solicitud. Negarme a autorizar la consulta automática no me obliga a aceptar ninguna oferta y puedo entregar documentos por otro canal.'],
    ['6. Límites expresos', 'Esta autorización no permite modificar mis datos en la AFP, cambiar fondos, retirar o transferir dinero, solicitar una pensión en mi nombre, ingresar una solicitud SCOMP, elegir una modalidad ni aceptar o firmar ofertas o contratos. Ninguna propuesta generada por PreviSmart es un certificado oficial o garantiza una pensión. Todo trámite o aceptación exige una autorización distinta y el procedimiento del canal habilitado.'],
    ['7. Firma previa e informada', 'Declaro haber leído este texto, revisado los datos, acordado el alcance y plazo de conservación y recibido respuesta a mis dudas. Firmo voluntariamente antes de la consulta o descarga y recibo una copia. El responsable verificará identidad y firma antes de comenzar. Generar, descargar o imprimir esta plantilla no acredita que exista autorización firmada.']
  ];
  return { version: VERSION_AUTORIZACION, fecha, conservarHasta, datos, secciones, faltantes, demostracion: Boolean(cliente.ingesta?.demostracion) };
}

export function textoAutorizacion(modelo) {
  return ['AUTORIZACIÓN PREVIA PARA CONSULTA AFP Y CONSERVACIÓN DE DATOS Y DOCUMENTOS',
    `Plantilla PreviSmart ${modelo.version} — SIN FIRMAR; revisar y completar antes de usar`,
    ...(modelo.demostracion ? ['DEMOSTRACIÓN: datos sintéticos, no usar para una atención real.'] : []),
    ...(modelo.faltantes.length ? [`Pendientes: ${modelo.faltantes.join(', ')}.`] : []), '',
    ...modelo.datos.map(([label, value]) => `${label}: ${value}`), '',
    ...modelo.secciones.flatMap(([titulo, cuerpo]) => [titulo, cuerpo, '']),
    'Firma del afiliado: __________________________   Fecha/hora efectiva: __________________',
    'Firma del responsable: _______________________   Lugar: _______________________________',
    'Identidad cotejada por el responsable: _______   Copia entregada al afiliado: ___________',
    '', 'Plantilla para revisión del responsable; no certifica validez legal ni reemplaza los avisos y obligaciones aplicables.',
    '© 2026 Todos los derechos reservados · Desarrollado por P. Gallardo'].join('\n');
}

export function htmlAutorizacion(modelo) {
  return `<article class="reporte autorizacion"><h2>Autorización previa para consulta AFP y conservación de datos y documentos</h2>
    <p><strong>Plantilla PreviSmart ${esc(modelo.version)} — SIN FIRMAR</strong>. Revisar y completar antes de usar.</p>
    ${modelo.demostracion ? '<p><strong>DEMOSTRACIÓN: no usar para una atención real.</strong></p>' : ''}
    ${modelo.faltantes.length ? `<p class="small"><strong>Pendientes:</strong> ${esc(modelo.faltantes.join(', '))}.</p>` : ''}
    <table class="rep-tabla"><tbody>${modelo.datos.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join('')}</tbody></table>
    ${modelo.secciones.map(([titulo, cuerpo]) => `<section class="rep-sec"><h3>${esc(titulo)}</h3><p>${esc(cuerpo)}</p></section>`).join('')}
    <section class="rep-sec"><h3>Firmas previas a la consulta</h3><p>Firma del afiliado: __________________________</p><p>Firma del responsable: _______________________</p><p>Fecha/hora efectiva: ________________________ · Lugar: ________________________</p><p>Identidad cotejada: _________________________ · Copia entregada: _______________</p></section>
    <p class="small">Plantilla para revisión del responsable; no certifica validez legal ni reemplaza los avisos y obligaciones aplicables. Descargar o imprimir no acredita una firma.</p>
    <p class="tiny">© 2026 Todos los derechos reservados · Desarrollado por P. Gallardo</p></article>`;
}
