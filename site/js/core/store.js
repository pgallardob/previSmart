/* PreviSmart · store.js — persistencia local versionada, multi-cliente.
   Todo el estado vive en localStorage bajo 'prevismart.v1'.
   Sin backend: los datos del asesor y sus clientes quedan en el dispositivo. */

const KEY = 'prevismart.v1';
export const SCHEMA_VERSION = 1;

const oyentes = new Set();
const SECCIONES = ['perfil', 'beneficiarios', 'saldo', 'elegibilidad', 'beneficios', 'modalidades', 'ofertas', 'liquida', 'sobrevivencia', 'ruta', 'checklist', 'scomp', 'ingesta'];
const SENSIBLES = new Set(['clave', 'password', 'contrasena', 'contraseña', 'token', 'authorization', 'credenciales', 'credentials', '__proto__', 'constructor', 'prototype']);
const NUMERICOS = ['pensionUF', 'primaUF', 'periodoGarantizadoAnios', 'incrementoConyugeUF', 'sobrevConyugePct', 'sobrevHijosPct', 'cuotaMortuoriaUF', 'aumentoDiferidoMes', 'aumentoDiferidoPct', 'comisionUF', 'tasaDescuentoPct', 'aumentoTemporalPct', 'aumentoTemporalMeses', 'obligatorio', 'apv', 'depositosConvenidos', 'cotizacionesVoluntarias', 'cuenta2', 'bonoPorHijo', 'otrosBonos', 'pensionEstimadaUF', 'mesesCotizados', 'promedioRemuneraciones', 'saludPlanUF', 'maxConsultas'];
const BOOLEANOS = ['yaPensionado', 'hijosComunes', 'embarazo', 'cotizacionesImpagas', 'trabajoPesado', 'sigueTrabajando', 'estudiante', 'ofertaBruta', 'adelantable', 'eld'];
const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
let cargaBloqueada = false;
let puedeEditar = typeof window === 'undefined';
let ultimoLeido = null;
let state = cargar();
let ultimoPersistido = JSON.stringify(state);

function sinSecretos(valor) {
  if (Array.isArray(valor)) return valor.map(sinSecretos);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor)
    .filter(([key]) => !SENSIBLES.has(key.toLowerCase())).map(([key, v]) => [key, sinSecretos(v)]));
  return valor;
}

function normalizarCliente(crudo) {
  if (!crudo || typeof crudo.nombre !== 'string' || !crudo.nombre.trim()) throw new Error('nombre inválido');
  const c = clienteVacio({ nombre: crudo.nombre, notas: typeof crudo.notas === 'string' ? crudo.notas : '' });
  for (const key of SECCIONES) {
    if (crudo[key] == null) continue;
    const value = crudo[key];
    if (['ofertas', 'beneficiarios'].includes(key)) {
      if (!Array.isArray(value) || value.some((v) => !v || typeof v !== 'object' || Array.isArray(v))) throw new Error('lista inválida');
    } else if (typeof value !== 'object' || (Array.isArray(value) && key !== 'elegibilidad')) throw new Error('sección inválida');
    c[key] = sinSecretos(value);
    const registros = Array.isArray(c[key]) ? c[key] : [c[key]];
    for (const registro of registros) for (const campo of NUMERICOS) {
      if (registro[campo] == null || registro[campo] === '') continue;
      const numero = Number(registro[campo]);
      if (!Number.isFinite(numero) || numero < 0) throw new Error('monto o porcentaje inválido');
      registro[campo] = numero;
    }
    for (const registro of registros) for (const campo of BOOLEANOS) {
      if (registro[campo] != null && typeof registro[campo] !== 'boolean') throw new Error('declaración booleana inválida');
    }
  }
  if (c.perfil?.otrasPensiones != null && !Array.isArray(c.perfil.otrasPensiones)) throw new Error('pensiones inválidas');
  if (!c.ruta.fechas) c.ruta.fechas = {};
  if (typeof c.ruta.fechas !== 'object' || Array.isArray(c.ruta.fechas)) throw new Error('fechas inválidas');
  if (!Array.isArray(c.ingesta.eventos) || c.ingesta.eventos.some((e) => !e || typeof e.fuente !== 'string' || !Array.isArray(e.campos) || !Array.isArray(e.conflictos))) throw new Error('Auditoría de ingesta inválida');
  c.ruta.etapa = Math.min(7, Math.max(0, Math.trunc(Number(c.ruta.etapa) || 0)));
  return c;
}

function estadoInicial() {
  return {
    schemaVersion: SCHEMA_VERSION,
    ajustes: {},
    clienteActivoId: null,
    clientes: []
  };
}

function cargar() {
  try {
    const raw = localStorage.getItem(KEY);
    ultimoLeido = raw;
    if (!raw) return estadoInicial();
    const d = JSON.parse(raw);
    if (d?.schemaVersion !== SCHEMA_VERSION || !Array.isArray(d?.clientes)) {
      cargaBloqueada = true;
      return estadoInicial();
    }
    const clientes = d.clientes.map((raw) => {
      if (!idValido(raw?.id)) throw new Error('id inválido');
      return { ...normalizarCliente(raw), id: raw.id, creadoEn: raw.creadoEn, actualizadoEn: raw.actualizadoEn };
    });
    if (new Set(clientes.map((c) => c.id)).size !== clientes.length) throw new Error('ids duplicados');
    return { ...estadoInicial(), clientes, clienteActivoId: clientes.some((c) => c.id === d.clienteActivoId) ? d.clienteActivoId : clientes[0]?.id || null };
  } catch {
    cargaBloqueada = true;
    return estadoInicial();
  }
}

function guardar() {
  if (!puedeEditar) throw new Error('Otra pestaña controla la edición de esta cartera. Cierra esa pestaña y recarga antes de guardar.');
  if (localStorage.getItem(KEY) !== ultimoLeido) throw new Error('La cartera cambió en otra pestaña. Recarga para evitar sobrescribir datos nuevos.');
  if (cargaBloqueada) throw new Error('Datos locales inválidos: no se sobrescribieron. Revisa el respaldo antes de borrar o restaurar.');
  const raw = JSON.stringify(state);
  localStorage.setItem(KEY, raw);
  ultimoLeido = raw;
}

function emitir() {
  oyentes.forEach((fn) => { try { fn(state); } catch { /* oyente defectuoso */ } });
}

function commit() {
  try {
    guardar();
    ultimoPersistido = JSON.stringify(state);
  } catch (error) {
    state = JSON.parse(ultimoPersistido);
    emitir();
    throw new Error(cargaBloqueada || !puedeEditar || localStorage.getItem(KEY) !== ultimoLeido ? error.message : 'No se pudo guardar en el dispositivo. Libera espacio e intenta de nuevo.');
  }
  emitir();
}

/* ---------------- API pública ---------------- */

export function getState() { return state; }
export function exigirEdicion() {
  if (!puedeEditar) throw new Error('Esta pestaña está en modo lectura. Usa la pestaña que controla la edición.');
}
export function iniciarEdicionExclusiva() {
  if (typeof window === 'undefined') return Promise.resolve(true);
  return new Promise((resolve) => {
    if (!navigator.locks) { puedeEditar = false; resolve(false); return; }
    navigator.locks.request('prevismart-cartera-editor', { ifAvailable: true }, async (lock) => {
      puedeEditar = Boolean(lock);
      resolve(puedeEditar);
      if (lock) await new Promise(() => {}); // Released automatically when this document closes.
    }).catch(() => { puedeEditar = false; resolve(false); });
  });
}
export function estadoPersistencia() {
  return { ok: !cargaBloqueada, error: cargaBloqueada ? 'La cartera local está dañada o es incompatible. No se sobrescribirá; restaura un respaldo antes de continuar.' : null };
}

export function subscribe(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/* ---- Cartera de clientes ---- */

function nuevoId() {
  return globalThis.crypto?.randomUUID?.()
    || `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

export function clienteVacio({ nombre, notas = '' }) {
  const ahora = new Date().toISOString();
  return {
    id: nuevoId(),
    nombre: String(nombre || '').trim(),
    notas,
    creadoEn: ahora,
    actualizadoEn: ahora,
    perfil: null,        // Fase 4
    beneficiarios: [],   // Fase 4
    saldo: null,         // Fase 4
    elegibilidad: null,  // Fase 4 (resultado calculado)
    beneficios: null,    // Fase 5
    modalidades: null,   // Fase 6
    ofertas: [],         // Fase 6
    liquida: null,       // Fase 7
    sobrevivencia: null, // Fase 7
    ruta: { etapa: 0, fechas: {} },  // Fase 8
    checklist: {},       // Fase 8
    scomp: null,         // datos de la consulta SCOMP (código, fechas, vigencia)
    ingesta: { eventos: [] }
  };
}

export function listarClientes() {
  return state.clientes;
}

export function getClienteActivo() {
  return state.clientes.find((c) => c.id === state.clienteActivoId) || null;
}

export function getCliente(id) {
  return state.clientes.find((c) => c.id === id) || null;
}

export function crearCliente({ nombre, notas }) {
  if (!String(nombre || '').trim()) return null;
  const c = clienteVacio({ nombre, notas });
  state.clientes.push(c);
  state.clienteActivoId = c.id;
  commit();
  return c;
}

export function actualizarCliente(id, patch) {
  const c = getCliente(id);
  if (!c) return null;
  const { nombre, notas } = patch;
  if (nombre !== undefined) c.nombre = String(nombre).trim();
  if (notas !== undefined) c.notas = notas;
  c.actualizadoEn = new Date().toISOString();
  commit();
  return c;
}

export function eliminarCliente(id) {
  const i = state.clientes.findIndex((c) => c.id === id);
  if (i === -1) return false;
  state.clientes.splice(i, 1);
  if (state.clienteActivoId === id) {
    state.clienteActivoId = state.clientes[0]?.id || null;
  }
  commit();
  return true;
}

export function setClienteActivo(id) {
  if (id !== null && !getCliente(id)) return false;
  state.clienteActivoId = id;
  commit();
  return true;
}

/** Explicitly reset memory and persistence together after user confirmation. */
export function borrarCartera() {
  cargaBloqueada = false;
  state = estadoInicial();
  commit();
}

/** Guarda una sección completa del expediente del cliente
    (perfil, saldo, ofertas, checklist, ruta, ...). */
export function guardarSeccion(id, seccion, datos) {
  const c = getCliente(id);
  if (!c || !SECCIONES.includes(seccion)) return false;
  const normalizado = normalizarCliente({ ...c, [seccion]: datos });
  c[seccion] = normalizado[seccion];
  c.actualizadoEn = new Date().toISOString();
  commit();
  return true;
}

/** Validate every section before publishing one atomic portfolio mutation. */
export function actualizarExpediente(id, patch) {
  const cliente = getCliente(id);
  if (!cliente) throw new Error('El cliente ya no existe.');
  if (!patch || Object.keys(patch).some((key) => key !== 'nombre' && !SECCIONES.includes(key))) throw new Error('Actualización de expediente inválida.');
  const validado = normalizarCliente({ ...cliente, ...patch });
  for (const key of Object.keys(patch)) cliente[key] = key === 'nombre' ? validado.nombre : validado[key];
  cliente.actualizadoEn = new Date().toISOString();
  commit();
  return cliente;
}

/* ---- Export / import ---- */

export function exportarCliente(id) {
  const c = getCliente(id);
  if (!c) return null;
  return JSON.stringify({ tipo: 'prevismart-cliente', schemaVersion: SCHEMA_VERSION, cliente: sinSecretos(c) }, null, 2);
}

export function exportarCartera() {
  return JSON.stringify({ tipo: 'prevismart-cartera', schemaVersion: SCHEMA_VERSION, clientes: sinSecretos(state.clientes) }, null, 2);
}

/** Restore a confirmed full backup with stable IDs, including an empty portfolio. */
export function validarCartera(d) {
  let clientes;
  try {
    if (d?.tipo !== 'prevismart-cartera' || d.schemaVersion !== SCHEMA_VERSION || !Array.isArray(d.clientes)) throw new Error();
    clientes = d.clientes.map((raw) => {
      if (!idValido(raw?.id)) throw new Error();
      return { ...normalizarCliente(raw), id: raw.id, creadoEn: raw.creadoEn, actualizadoEn: raw.actualizadoEn };
    });
    if (new Set(clientes.map((c) => c.id)).size !== clientes.length) throw new Error();
  } catch { return { ok: false, error: 'respaldo de cartera inválido' }; }
  return { ok: true, clientes };
}

export function restaurarCartera(json) {
  let d;
  try { d = JSON.parse(json); } catch { return { ok: false, error: 'respaldo de cartera inválido' }; }
  const validacion = validarCartera(d);
  if (!validacion.ok) return validacion;
  const clientes = validacion.clientes;
  state = { ...estadoInicial(), clientes, clienteActivoId: clientes.some((c) => c.id === state.clienteActivoId) ? state.clienteActivoId : clientes[0]?.id || null };
  const bloqueoAnterior = cargaBloqueada;
  cargaBloqueada = false;
  try { commit(); } catch (error) { cargaBloqueada = bloqueoAnterior; throw error; }
  return { ok: true, importados: clientes.length };
}

/** Importa un export (cliente único o cartera). Fusiona sin sobrescribir ids. */
export function importar(json) {
  let d;
  try { d = JSON.parse(json); } catch { return { ok: false, error: 'archivo inválido' }; }
  if (d?.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: 'versión de respaldo incompatible' };

  const entrantes = d?.tipo === 'prevismart-cliente' ? [d.cliente]
    : d?.tipo === 'prevismart-cartera' ? d.clientes
    : null;
  if (!Array.isArray(entrantes) || !entrantes.length) {
    return { ok: false, error: 'no contiene clientes PreviSmart' };
  }
  let normalizados;
  try { normalizados = entrantes.map(normalizarCliente); } catch {
    return { ok: false, error: 'expediente inválido' };
  }

  let n = 0;
  for (const c of normalizados) {
    state.clientes.push(c);
    n += 1;
  }
  if (!n) return { ok: false, error: 'no se importó ningún cliente' };
  if (!getClienteActivo()) state.clienteActivoId = normalizados[0].id;
  commit();
  return { ok: true, importados: n };
}
