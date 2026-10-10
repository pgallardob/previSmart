import { mapearSaldos, AFPS } from './integracion.js';
import { parseLocal } from './dates.js';
import { validarPDF } from './documentos.js';
import { ETAPAS } from '../data/ruta.js';
import { cruzarAseguradoras } from './aseguradoras.js';

const texto = (v) => typeof v === 'string' && v.trim() ? v.trim() : null;
const vacio = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const rut = (v) => texto(v)?.replace(/[^\dkK]/g, '').toUpperCase() || null;
const afp = (v) => texto(v)?.toLowerCase().replace(/\bafp\b/g, '').replace(/\s/g, '') || null;
export function fechaNormalizada(v) {
  if (!texto(v)) return null;
  const m = v.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : v;
  return parseLocal(iso) ? iso.slice(0, 10) : null;
}
export function comprobarIdentidad(cliente, identidad = {}, credenciales = {}) {
  const usuarioRut = credenciales.afp === 'modelo' && /^[\d.]+-[\dkK]$/.test(credenciales.usuario || '') ? credenciales.usuario : null;
  const esperados = [cliente.perfil?.rut, credenciales.rut, usuarioRut].map(rut).filter(Boolean);
  const recibido = rut(identidad.rut);
  if (texto(identidad.rut) && !/^\d{1,8}[\dK]$/.test(recibido || '')) throw new Error('El documento o portal devolvió un RUT inválido.');
  if (recibido && esperados.some((r) => r !== recibido)) throw new Error('El RUT recibido no corresponde al cliente. No se importó ningún dato.');
  const recibida = afp(identidad.afp);
  const esperada = afp(credenciales.afp);
  if (recibida && esperada && recibida !== esperada) throw new Error('La AFP recibida no coincide con la descarga solicitada.');
}

export async function prepararDocumentosRPA(cliente, json) {
  if (json.documentos != null && !Array.isArray(json.documentos)) throw new Error('Lista de documentos RPA inválida.');
  const documentos = json.documentos || [];
  if (documentos.length > 30) throw new Error('Demasiados documentos en la respuesta RPA.');
  const entradas = [];
  let bytesTotales = 0;
  for (const d of documentos) {
    if (!d || typeof d.base64 !== 'string' || !d.base64 || d.base64.length > 35 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(d.base64) || d.base64.length % 4 !== 0) throw new Error('Documento RPA con base64 inválido.');
    const bin = atob(d.base64);
    bytesTotales += bin.length;
    if (bytesTotales > 50 * 1024 * 1024) throw new Error('Los documentos superan 50 MB en total.');
    const archivo = new File([Uint8Array.from(bin, (c) => c.charCodeAt(0))], texto(d.nombre)?.replace(/[\\/]/g, '_') || 'documento-afp.pdf', { type: 'application/pdf' });
    await validarPDF(archivo);
    entradas.push({ clienteId: cliente.id, clienteNombre: cliente.nombre, tipo: texto(d.tipo) || 'otro', archivo });
  }
  return entradas;
}
function completar(actual, entrante, prefijo, conflictos) {
  const out = { ...actual };
  for (const [key, value] of Object.entries(entrante)) {
    if (vacio(value)) continue;
    if (vacio(out[key])) out[key] = value;
    else if (String(out[key]) !== String(value)) conflictos.push(`${prefijo}.${key}`);
  }
  return out;
}
function evento(cliente, fuente, campos, conflictos, documentos = []) {
  return { eventos: [...(cliente.ingesta?.eventos || []), {
    fecha: new Date().toISOString(), fuente, campos, conflictos,
    documentos: documentos.map((d) => ({ id: d.id, tipo: d.tipo, sha256: d.sha256 || null }))
  }].slice(-100) };
}
function evidencia(cliente, pasos, fechas = {}) {
  const checklist = { ...(cliente.checklist || {}) };
  pasos.forEach((key) => { checklist[key] = true; });
  const etapa = ETAPAS.filter((et) => et.pasos.every((_, i) => checklist[`paso-${et.id}-${i}`]) && (et.acciones || []).every((_, i) => checklist[`acc-${et.id}-${i}`])).length;
  return { checklist, ruta: { ...(cliente.ruta || {}), etapa: Math.max(etapa, cliente.ruta?.etapa || 0), fechas: { ...(cliente.ruta?.fechas || {}), ...fechas } } };
}

/** Plan partial RPA data without fabricating values or overwriting declared profile fields. */
export function planearDescarga(cliente, json, credenciales, documentos = []) {
  if (!cliente) throw new Error('Selecciona un cliente.');
  if (cliente.ingesta?.demostracion) throw new Error('Crea un expediente real separado de la demostración para importar datos de producción.');
  if (json?.modo === 'prueba') throw new Error('El RPA está en modo prueba. No se importan sus saldos simulados en un expediente de producción.');
  let saldos;
  try { saldos = mapearSaldos(json); }
  catch (error) {
    if (!['SIN_DESGLOSE', 'SIN_SALDOS'].includes(error.code) || !Array.isArray(json.documentos) || !json.documentos.length) throw error;
    saldos = {};
  }
  const a = json.afiliado || {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error('Ficha del afiliado inválida.');
  comprobarIdentidad(cliente, { rut: a.rut, afp: json.afp }, credenciales);
  const sexo = texto(a.sexo)?.toLowerCase();
  const civil = texto(a.estadoCivil)?.toLowerCase();
  const afpRegistrada = AFPS.find((entidad) => entidad.id === afp(json.afp));
  const perfil = {
    afp: afpRegistrada ? afpRegistrada.nombre.replace(/^AFP\s+/, '') : texto(json.afp), rut: texto(a.rut) || texto(credenciales.rut),
    nombre: texto(a.nombre) || texto(json.nombreAfiliado), apellidoPaterno: texto(a.apellidoPaterno), apellidoMaterno: texto(a.apellidoMaterno),
    fechaNacimiento: fechaNormalizada(a.fechaNacimiento), sexo: ['f', 'femenino', 'mujer'].includes(sexo) ? 'F' : ['m', 'masculino', 'hombre'].includes(sexo) ? 'M' : null,
    estadoCivil: civil === 'conviviente' || civil === 'conviviente civil' ? 'auc' : ['soltero', 'casado', 'viudo', 'divorciado', 'auc'].includes(civil) ? civil : null,
    direccion: [a.direccion, a.comuna, a.region].map(texto).filter(Boolean).join(', ') || null,
    telefono: texto(a.telefono), email: texto(a.correo) || texto(a.email),
    multifondo: texto(json.fondo)?.match(/^([A-E])(?:\s|$)/)?.[1] || null,
    fechaPrimeraAfiliacion: fechaNormalizada(a.fechaPrimeraAfiliacion),
    ...(typeof a.mesesCotizados === 'number' ? { mesesCotizados: a.mesesCotizados } : {}),
    ...(typeof a.promedioRemuneraciones === 'number' ? { promedioRemuneraciones: a.promedioRemuneraciones } : {}),
    ...(typeof a.saludPlanUF === 'number' ? { saludPlanUF: a.saludPlanUF } : {})
  };
  for (const key of ['yaPensionado', 'hijosComunes', 'embarazo', 'matrimoniosAnteriores', 'trabajoPesado', 'sigueTrabajando', 'cotizacionesImpagas', 'cotizacionesRezagadas']) {
    if (typeof a[key] === 'boolean') perfil[key] = a[key];
  }
  const matrimonio = fechaNormalizada(a.fechaMatrimonio);
  if (matrimonio) perfil.fechaMatrimonio = matrimonio;
  if (['vejez', 'invalidez', 'terminal', 'sobrevivencia'].includes(a.rutaTipo)) perfil.rutaTipo = a.rutaTipo;
  if (['fonasa', 'isapre'].includes(a.saludTipo)) perfil.saludTipo = a.saludTipo;
  if (Array.isArray(a.otrasPensiones) && a.otrasPensiones.every((s) => ['ips', 'capredena', 'dipreca', 'mutualidad', 'accidente', 'extranjera'].includes(s))) perfil.otrasPensiones = a.otrasPensiones;
  const conflictos = [];
  const completado = completar(cliente.perfil || {}, perfil, 'perfil', conflictos);
  const patch = { perfil: completado, saldo: { ...(cliente.saldo || {}), ...saldos }, ...evidencia(cliente, Object.keys(saldos).length ? ['paso-preparacion-2'] : []) };
  if (saldos.bonoReconocimiento) patch.saldo.bonoReconocimiento = { ...(cliente.saldo?.bonoReconocimiento || {}), ...saldos.bonoReconocimiento };
  if (!cliente.perfil?.nombre && completado.nombre) patch.nombre = [completado.nombre, completado.apellidoPaterno, completado.apellidoMaterno].filter(Boolean).join(' ');
  if (Array.isArray(a.beneficiarios) && a.beneficiarios.length && !cliente.beneficiarios?.length) {
    patch.beneficiarios = a.beneficiarios.map((b) => {
      if (!b || typeof b !== 'object') throw new Error('Beneficiario descargado inválido.');
      const t = texto(b.tipo)?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return { nombre: texto(b.nombre), rut: texto(b.rut), tipo: t?.startsWith('hij') ? 'hijo' : ['conyuge', 'conviviente', 'padre_causante', 'filiacion'].includes(t) ? t : 'designado',
        fechaNacimiento: fechaNormalizada(b.fechaNacimiento), ...(typeof b.estudiante === 'boolean' ? { estudiante: b.estudiante } : {}), ...(texto(b.invalidez) ? { invalidez: b.invalidez } : {}) };
    });
  }
  const campos = Object.entries(perfil).filter(([key, value]) => !vacio(value) && vacio(cliente.perfil?.[key])).map(([key]) => `perfil.${key}`)
    .concat(Object.keys(saldos).map((key) => `saldo.${key}`));
  patch.ingesta = evento(cliente, 'rpa-afp', campos, conflictos, documentos);
  if (credenciales.autorizadoEn) patch.ingesta.eventos.at(-1).autorizacionDeclaradaEn = credenciales.autorizadoEn;
  return { patch, conflictos, sinDesglose: !Object.keys(saldos).length, faltantes: Object.entries(perfil).filter(([, value]) => vacio(value)).map(([key]) => `perfil.${key}`) };
}

/** Build a confirmed document import; zero values remain valid and absent fields stay absent. */
export function planearDocumento(cliente, r, documento) {
  if (cliente.ingesta?.demostracion) throw new Error('No se mezclan documentos reales con la cartera de demostración. Crea otro cliente.');
  comprobarIdentidad(cliente, r.perfil || {});
  const conflictos = [];
  const entrante = { ...(r.perfil || {}), ...(['A', 'B', 'C', 'D', 'E'].includes(r.saldo?.fondo) ? { multifondo: r.saldo.fondo } : {}) };
  const perfil = completar(cliente.perfil || {}, entrante, 'perfil', conflictos);
  const patch = {};
  if (Object.keys(entrante).length) patch.perfil = perfil;
  if (r.cotizaciones) patch.perfil = { ...perfil, cotizacionesImportadas: r.cotizaciones };
  if (!cliente.perfil?.nombre && perfil.nombre) patch.nombre = [perfil.nombre, perfil.apellidoPaterno, perfil.apellidoMaterno].filter(Boolean).join(' ');
  const saldo = Object.fromEntries(Object.entries(r.saldo || {}).filter(([, value]) => value != null && ['number', 'string'].includes(typeof value)));
  if (typeof saldo.bonoReconocimiento === 'number') saldo.bonoReconocimiento = { ...(cliente.saldo?.bonoReconocimiento || {}), monto: saldo.bonoReconocimiento };
  if (Object.keys(saldo).length) patch.saldo = { ...(cliente.saldo || {}), ...saldo };
  if (r.tipo === 'scomp') {
    patch.scomp = { ...(cliente.scomp || {}), ...(r.scomp || {}),
      ...Object.fromEntries(Object.entries({ ufEmisionCLP: r.saldo?.ufEmisionCLP, certSaldoEmitido: r.saldo?.certSaldoEmitido, certSaldoVence: r.saldo?.certSaldoVence,
        saldoDestinadoUF: r.saldo?.saldoDestinadoUF, ...r.meta }).filter(([, value]) => value != null)), fuente: documento || null };
    if (r.beneficiarios?.length && !cliente.beneficiarios?.length) patch.beneficiarios = r.beneficiarios;
    else if (r.beneficiarios?.length) conflictos.push('beneficiarios');
    if (r.ofertas?.length) patch.ofertas = cruzarAseguradoras(r.ofertas).map((o) => ({ ...o, fuente: 'certificado-scomp', documentoId: documento?.id || null }));
  }
  const campos = Object.keys(patch);
  const fechas = {};
  const pasos = Object.keys(saldo).length ? ['paso-preparacion-2'] : [];
  if (r.tipo === 'scomp') {
    pasos.push('paso-scomp-0', 'acc-scomp-0');
    if (r.scomp?.fechaEmision) fechas.ofertasEmitidas = r.scomp.fechaEmision;
    if (r.saldo?.certSaldoEmitido) { fechas.certEmitido = r.saldo.certSaldoEmitido; pasos.push('paso-solicitud-0', 'acc-certificado-0'); }
  } else if (!r.esCartola && r.tipoDoc === 'certificado-saldo') {
    pasos.push('paso-solicitud-0');
    if (r.saldo?.certEmitido) { fechas.certEmitido = r.saldo.certEmitido; pasos.push('acc-certificado-0'); }
  }
  Object.assign(patch, evidencia(cliente, pasos, fechas));
  patch.ingesta = evento(cliente, r.tipo === 'scomp' ? 'certificado-scomp' : r.tipo === 'antecedentes' ? r.tipoDoc : r.esCartola ? 'cartola-afp' : 'certificado-saldo', campos, conflictos, documento ? [documento] : []);
  return { patch, conflictos };
}

export function planearLote(cliente, resultados) {
  let actual = cliente;
  const patch = {}, conflictos = [];
  for (const r of resultados) {
    const plan = planearDocumento(actual, r, r.documento);
    Object.assign(patch, plan.patch);
    actual = { ...actual, ...plan.patch };
    conflictos.push(...plan.conflictos);
  }
  return { patch, conflictos: [...new Set(conflictos)] };
}
