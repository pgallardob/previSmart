import { portalAFP } from '../data/portales-afp.js';
import { parseLocal } from './dates.js';

/** Local workflow evidence is not pension eligibility, authenticity or authorization. */
export function evaluarOperacion(cliente, documentos = [], fecha = new Date().toISOString().slice(0, 10)) {
  if (!cliente) throw new Error('Selecciona un cliente.');
  const perfil = cliente.perfil || {};
  const text = (v) => typeof v === 'string' && v.trim();
  const has = (tipo) => documentos.some((d) => d.clienteId === cliente.id && d.tipo === tipo);
  const requisitos = [
    { id: 'identidad', titulo: 'Completar identidad para cotejo', hecho: Boolean(text(perfil.rut) && text(perfil.nombre) && parseLocal(perfil.fechaNacimiento)), destino: '#/perfil', detalle: 'RUT, nombre y nacimiento registrados: cotejar con la cédula y los documentos originales; no están autenticados por este indicador.' },
    { id: 'afp', titulo: 'Identificar AFP de origen', hecho: Boolean(portalAFP(perfil.afp)), destino: '#/perfil', detalle: 'Las siete AFP disponen de ruta documental; solo Modelo tiene automatización habilitada.' },
    { id: 'saldo', titulo: 'Archivar Certificado de Saldo', hecho: has('certificado-saldo'), destino: '#/captura', detalle: 'Una cartola o certificado de cotizaciones no sustituye al Certificado de Saldo para SCOMP.' },
    { id: 'participe', titulo: 'Registrar gestión con un partícipe', hecho: Boolean(text(cliente.ruta?.gestion?.participe)), destino: '#/ruta', detalle: 'AFP, compañía o asesor autorizado ingresa la solicitud; el nombre registrado no acredita su autorización.' },
    { id: 'ofertas', titulo: 'Archivar certificado y comparar ofertas', hecho: has('certificado-ofertas') && cliente.ofertas?.some((o) => o.fuente === 'certificado-scomp'), destino: '#/captura', detalle: 'Importar el certificado recibido por el canal autorizado; las ofertas manuales no sustituyen ese documento.' }
  ];
  const advertencias = [];
  if (cliente.ingesta?.demostracion) advertencias.push('Expediente de demostración: no realizar gestiones reales.');
  const hasta = cliente.scomp?.vigenciaHasta;
  if (!parseLocal(hasta)) advertencias.push('Vigencia de ofertas sin verificar: revisar las fechas expresas del certificado.');
  else if (hasta < fecha) advertencias.push('La fecha de vigencia de ofertas registrada está vencida. Solicitar revisión al partícipe.');
  else if (parseLocal(cliente.scomp?.vigenciaDesde) && cliente.scomp.vigenciaDesde > fecha) advertencias.push('La vigencia de las ofertas registradas todavía no comienza.');
  advertencias.push('Revisar declaración de beneficiarios, autenticidad y vigencia de documentos. El sistema no acepta ni emite ofertas oficiales.');
  return { requisitos, advertencias, portal: portalAFP(perfil.afp), completados: requisitos.filter((r) => r.hecho).length, total: requisitos.length };
}

/** Explicit allowlist: never export portfolio objects or credential stores. */
export function resumenGestion(cliente, documentos, fecha) {
  const estado = evaluarOperacion(cliente, documentos, fecha);
  const clean = (v) => String(v || 'Sin registrar').replace(/[\r\n\t]/g, ' ');
  return [
    'PREVISMART — Preparación de gestión, NO es una Solicitud de Ofertas oficial',
    `Cliente: ${clean(cliente.perfil?.nombre || cliente.nombre)}`,
    `RUT: ${clean(cliente.perfil?.rut)}`, `AFP: ${clean(cliente.perfil?.afp)}`,
    `Partícipe declarado: ${clean(cliente.ruta?.gestion?.participe)}`,
    `Referencia declarada: ${clean(cliente.ruta?.gestion?.referencia)}`,
    `Fecha de envío declarada: ${clean(cliente.ruta?.gestion?.fechaEnvio)}`,
    '', 'Verificaciones locales:',
    ...estado.requisitos.map((r) => `${r.hecho ? '[Registrado]' : '[Pendiente]'} ${r.titulo}: ${r.detalle}`),
    '', 'Revisiones obligatorias:', ...estado.advertencias,
    '', 'Datos personales: entregar únicamente al destinatario autorizado. No contiene claves AFP.',
    '© 2026 Todos los derechos reservados · Desarrollado por P. Gallardo'
  ].join('\n');
}
