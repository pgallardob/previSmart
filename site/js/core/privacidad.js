import { aISO, hoy, parseLocal } from './dates.js';
import { vencimientoRetencion } from './retencion.js';

const texto = (v) => typeof v === 'string' ? v.trim() : '';
const historial = (previous, evento) => [...(Array.isArray(previous?.historial) ? previous.historial.slice(-49) : []), evento];

/** Operator declaration about a checked paper/digital authorization, not a cryptographic signature. */
export function registrarAutorizacion(cliente, { fechaFirma, referencia, firmaCotejada, responsable }, fechaActual = aISO(hoy())) {
  if (!cliente) throw new Error('Selecciona un cliente.');
  const fecha = parseLocal(fechaFirma);
  if (!fecha || fechaFirma !== aISO(fecha) || fechaFirma > fechaActual) throw new Error('Indica la fecha efectiva de firma, válida y no futura.');
  if (firmaCotejada !== true) throw new Error('Debes confirmar el cotejo de la autorización firmada; generar una plantilla no es firmarla.');
  if (!texto(referencia) || texto(referencia).length > 200) throw new Error('Indica una referencia de la autorización firmada, sin claves y hasta 200 caracteres.');
  if (!texto(responsable) || texto(responsable).length > 200) throw new Error('Configura al responsable de esta instalación en Ajustes.');
  const previous = cliente.ruta?.privacidad;
  const evento = { tipo: 'autorizacion-declarada', registradoEn: new Date().toISOString(), fechaFirma, referencia: texto(referencia), responsable: texto(responsable) };
  return { ...(cliente.ruta || {}), privacidad: {
    estado: 'vigente', fechaFirma, conservarHasta: vencimientoRetencion(fechaFirma), referencia: texto(referencia),
    firmaCotejada: true, responsable: texto(responsable), registradoEn: evento.registradoEn, historial: historial(previous, evento)
  } };
}

export function registrarRevocacion(cliente) {
  const previous = cliente?.ruta?.privacidad;
  if (!previous?.firmaCotejada) throw new Error('No existe una autorización registrada para revocar.');
  const evento = { tipo: 'revocacion-declarada', registradoEn: new Date().toISOString() };
  return { ...(cliente.ruta || {}), privacidad: { ...previous, estado: 'revocada', revocadaEn: evento.registradoEn, historial: historial(previous, evento) } };
}

export function evaluarPrivacidad(cliente, responsableActual = '', fechaActual = aISO(hoy())) {
  const p = cliente?.ruta?.privacidad;
  if (!p || p.firmaCotejada !== true) return { permiteConsulta: false, estado: 'sin-registro', mensaje: 'Registrar fecha efectiva y referencia de la autorización previamente firmada.' };
  if (p.estado === 'revocada') return { permiteConsulta: false, estado: 'revocada', mensaje: 'Autorización revocada: no iniciar nuevas consultas AFP. Revisar solicitudes y conservación legal antes de eliminar.' };
  try {
    const fin = vencimientoRetencion(p.fechaFirma);
    if (p.estado !== 'vigente' || fin !== p.conservarHasta || !texto(p.referencia) || !texto(p.responsable) || p.fechaFirma > fechaActual) throw new Error('Invalid declaration');
    if (fin < fechaActual) return { permiteConsulta: false, estado: 'vencida', mensaje: `Plazo registrado vencido el ${fin}. Revisar eliminación, copias existentes y obligaciones legales; no se borran archivos automáticamente.` };
    if (!texto(responsableActual) || texto(responsableActual) !== p.responsable) return { permiteConsulta: false, estado: 'otro-responsable', mensaje: 'La autorización está registrada para otro responsable o falta configurar el actual. Obtener y registrar la autorización correspondiente.' };
    return { permiteConsulta: true, estado: 'vigente', mensaje: `Autorización declarada desde ${p.fechaFirma}; conservación hasta ${fin}. Es un registro del operador, no una firma verificada automáticamente.` };
  } catch { return { permiteConsulta: false, estado: 'invalida', mensaje: 'Registro o calendario inválido: revisar la autorización antes de iniciar consultas.' }; }
}
