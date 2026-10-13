/* PreviSmart · integracion.js — conexión directa a la AFP del afiliado
   (vía 2 del presiso.md: RPA propia, sin agregadores de pago).

   El afiliado entrega su usuario y clave de la sucursal virtual de su
   AFP durante la sesión informativa; la app los captura en la vista
   Captura y el SERVICIO RPA local (rpa/) hace la autenticación y la
   descarga. La PWA no puede loguearse sola contra las AFP (CORS,
   captchas), por eso el flujo es:

     reunion → captura de credenciales → servicio RPA → saldos →
     escritura en cliente.saldo (fuente única de verdad de la app).

    Seguridad: credentials are temporary for this tab session, not stored
    permanently. They are never exported or printed. They are sent only to the
   endpoint del servicio RPA configurado (localhost). */

const KEY_CFG = 'prevismart.rpa.v1';
const KEY_CRED = 'prevismart.cred.afp.v1';
let credencialesMigradas = false;

/** AFPs del sistema con sucursal virtual (rpa/adapters/). */
export const AFPS = [
  { id: 'provida', nombre: 'AFP Provida' },
  { id: 'cuprum', nombre: 'AFP Cuprum' },
  { id: 'habitat', nombre: 'AFP Habitat' },
  { id: 'capital', nombre: 'AFP Capital' },
  { id: 'planvital', nombre: 'AFP PlanVital' },
  { id: 'modelo', nombre: 'AFP Modelo' },
  { id: 'uno', nombre: 'AFP Uno' }
];

/* ---------------- Configuración del servicio RPA ---------------- */

function leerCfg() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY_CFG) || '{}');
    /* Default: el .exe portable y `npm start` siempre levantan el
       servicio en localhost:8787 — funciona sin configurar nada,
       aunque el endpoint guardado quedara vacío. */
    return { endpoint: typeof d?.endpoint === 'string' && d.endpoint ? d.endpoint : 'http://localhost:8787', token: typeof d?.token === 'string' ? d.token : '' };
  } catch {
    return { endpoint: 'http://localhost:8787', token: '' };
  }
}

export function getConfig() { return leerCfg(); }

export function estaConfigurada() {
  return Boolean(leerCfg().endpoint);
}

export function guardarConfig(patch = {}) {
  const nueva = { ...leerCfg(), ...patch };
  validarEndpoint(nueva.endpoint);
  localStorage.setItem(KEY_CFG, JSON.stringify(nueva));
  return nueva;
}

function validarEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol)
      || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.port === '3000'
      || url.username || url.password || url.search || url.hash) {
    throw new Error('El servicio RPA debe estar en localhost o 127.0.0.1.');
  }
}

export function borrarConfig() {
  localStorage.removeItem(KEY_CFG);
}

/* Credentials stay separate from the portfolio and expire with the tab session. */

function leerCreds() {
  try {
    migrarCredenciales();
    const data = JSON.parse(sessionStorage.getItem(KEY_CRED) || '{}');
    return data && typeof data === 'object' && !Array.isArray(data) ? Object.assign(Object.create(null), data) : Object.create(null);
  } catch {
    return Object.create(null);
  }
}

function escribirCreds(mapa) {
  migrarCredenciales();
  sessionStorage.setItem(KEY_CRED, JSON.stringify(mapa));
}

function migrarCredenciales() {
  if (credencialesMigradas) return;
  const legacy = localStorage.getItem(KEY_CRED);
  if (legacy) {
    const data = JSON.parse(legacy);
    const actual = JSON.parse(sessionStorage.getItem(KEY_CRED) || '{}');
    // Move, do not discard: remove the durable copy only after a successful session write.
    sessionStorage.setItem(KEY_CRED, JSON.stringify({ ...(data || {}), ...(actual || {}) }));
    localStorage.removeItem(KEY_CRED);
  }
  credencialesMigradas = true;
}

export function borrarTodasCredenciales() {
  sessionStorage.removeItem(KEY_CRED);
  localStorage.removeItem(KEY_CRED);
  credencialesMigradas = true;
}

/** Guarda (o reemplaza) las credenciales de un cliente. */
export function guardarCredenciales(clienteId, { afp, rut, usuario, clave, consentimiento = false }) {
  if (typeof clienteId !== 'string' || !clienteId || !AFPS.some((a) => a.id === afp)
      || typeof usuario !== 'string' || !usuario.trim() || typeof clave !== 'string' || !clave) throw new Error('AFP, usuario o clave inválidos');
  const mapa = leerCreds();
  mapa[clienteId] = {
    afp: AFPS.some((a) => a.id === afp) ? afp : 'provida',
    rut: rut || '',
    usuario: String(usuario).trim(),
    clave: String(clave),
    guardadoEn: new Date().toISOString(),
    ...(consentimiento === true ? { autorizadoEn: new Date().toISOString() } : {})
  };
  escribirCreds(mapa);
  return mapa[clienteId];
}

/** Credenciales de un cliente (o null). Nunca muestra la clave en logs. */
export function getCredenciales(clienteId) {
  return leerCreds()[clienteId] || null;
}

/** ¿El cliente ya tiene credenciales capturadas? */
export function tieneCredenciales(clienteId) {
  return Boolean(leerCreds()[clienteId]);
}

/** Borra las credenciales de un cliente. */
export function borrarCredenciales(clienteId) {
  const mapa = leerCreds();
  delete mapa[clienteId];
  escribirCreds(mapa);
}

/* ---------------- Descarga vía servicio RPA ---------------- */

/**
 * Solicita al servicio RPA la autenticación como el propio afiliado
 * y la descarga de saldos. Devuelve el JSON de saldos normalizado
 * (mapearSaldos) o lanza un error descriptivo.
 */
export async function descargarSaldosAFP(clienteId) {
  const cfg = leerCfg();
  const cred = leerCreds()[clienteId];
  if (!cfg.endpoint) throw new Error('Servicio RPA sin configurar: define su endpoint en Ajustes.');
  if (!cred) throw new Error('El afiliado aún no ha entregado sus credenciales (Captura → Credenciales AFP).');
  validarEndpoint(cfg.endpoint);

  let resp;
  try {
    resp = await fetch(`${cfg.endpoint.replace(/\/+$/, '')}/afp/descargar`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {})
      },
      body: JSON.stringify({
        afp: cred.afp,
        rut: cred.rut,
        usuario: cred.usuario,
        clave: cred.clave
      })
    });
  } catch {
    throw new Error(`El servicio RPA no responde en ${cfg.endpoint} — ¿está corriendo? (abre PreviSmart.exe o \`npm start\` en rpa/)`);
  }
  if (!resp.ok) {
    const detalle = await resp.json().catch(() => null);
    throw new Error(typeof detalle?.error === 'string' ? detalle.error : `El servicio RPA respondió HTTP ${resp.status}`);
  }
  return resp.json();
}

export async function consultarSaludRPA() {
  const cfg = getConfig();
  validarEndpoint(cfg.endpoint);
  if (!estaConfigurada()) throw new Error('Configura el servicio RPA antes de verificarlo.');
  const response = await fetch(`${cfg.endpoint.replace(/\/+$/, '')}/health`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('El servicio RPA no respondió correctamente.');
  const data = await response.json();
  if (data?.servicio !== 'prevismart-rpa' || typeof data.version !== 'string' || !['real', 'prueba'].includes(data.modo) || !Array.isArray(data.afps) || data.afps.length > 7) throw new Error('Servicio no identificado o versión antigua; reinicia la entrega actual.');
  return data;
}

export async function consultarAseguradoras() {
  const cfg = leerCfg();
  validarEndpoint(cfg.endpoint);
  const response = await fetch(`${cfg.endpoint.replace(/\/+$/, '')}/aseguradoras`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('El directorio de aseguradoras no está disponible.');
  const data = await response.json();
  if (data?.fuente !== 'https://www.scomp.cl/participes.html' || !Array.isArray(data.aseguradoras) || data.aseguradoras.length > 100) throw new Error('Directorio de aseguradoras inválido.');
  for (const a of data.aseguradoras) {
    if (typeof a.id !== 'string' || typeof a.nombre !== 'string' || new URL(a.sitio).protocol !== 'https:' || (a.alias != null && !Array.isArray(a.alias))) throw new Error('Entidad del directorio inválida.');
  }
  return data;
}

/**
 * Normaliza la respuesta del servicio RPA al esquema de PreviSmart.
 * Tanto si los datos vienen por descarga como a mano, viven en el
 * MISMO lugar: cliente.saldo (fuente única, cero redundancia).
 */
export function mapearSaldos(json = {}) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Respuesta RPA inválida.');
  if (json.cuentas != null && !Array.isArray(json.cuentas)) throw new Error('Desglose de cuentas RPA inválido.');
  const out = {};
  for (const [campo, alias] of [['bonoPorHijo', 'bonoPorHijoCLP'], ['otrosBonos', 'otrosBonosCLP']]) {
    const value = json[alias] ?? json[campo];
    if (value == null) continue;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Saldo ${campo} inválido.`);
    out[campo] = value;
  }
  if (json.pensionEstimadaUF != null) {
    if (typeof json.pensionEstimadaUF !== 'number' || !Number.isFinite(json.pensionEstimadaUF) || json.pensionEstimadaUF < 0) throw new Error('Pensión UF recibida inválida.');
    out.pensionEstimadaUF = json.pensionEstimadaUF;
  }
  if (json.pensionEstimadaCLP != null) {
    if (typeof json.pensionEstimadaCLP !== 'number' || !Number.isSafeInteger(json.pensionEstimadaCLP) || json.pensionEstimadaCLP < 0) throw new Error('Pensión CLP recibida inválida.');
    out.pensionEstimadaCLP = json.pensionEstimadaCLP;
  }
  const bono = json.bonoReconocimiento;
  if (bono != null) {
    if (!bono || typeof bono !== 'object' || typeof bono.monto !== 'number' || !Number.isSafeInteger(bono.monto) || bono.monto < 0
        || (bono.estado != null && !['pendiente', 'liquidado', 'visado'].includes(bono.estado))) throw new Error('Bono de Reconocimiento recibido inválido.');
    out.bonoReconocimiento = { monto: bono.monto, ...(bono.estado ? { estado: bono.estado } : {}) };
  }
  const campos = { obligatorio: 'saldoObligatorioCLP', apv: 'apvCLP', depositosConvenidos: 'depositosConvenidosCLP', cotizacionesVoluntarias: 'cotizacionesVoluntariasCLP', cuenta2: 'cuenta2CLP' };
  if (Array.isArray(json.cuentas) && !json.cuentas.length && json.saldoTotalCLP != null) {
    const error = new Error('El portal sólo devolvió un total sin desglose de cuentas. Se requiere extraer el saldo desde sus documentos.');
    error.code = 'SIN_DESGLOSE';
    throw error;
  }
  if (Array.isArray(json.cuentas) && json.cuentas.length) {
    for (const cuenta of json.cuentas) {
      const tipo = String(cuenta?.tipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const campo = /cuenta\s*(2|dos)\b|ahorro voluntario/.test(tipo) ? 'cuenta2' : /depositos?.*convenidos?/.test(tipo) ? 'depositosConvenidos'
        : /cotizaciones? voluntarias?/.test(tipo) ? 'cotizacionesVoluntarias' : /\bapv\b|ahorro previsional voluntario/.test(tipo) ? 'apv' : /obligatoria/.test(tipo) ? 'obligatorio' : null;
      if (!campo) continue;
      const valor = Number(cuenta.monto);
      if (!Number.isSafeInteger(valor) || valor < 0) throw new Error('Monto de cuenta descargada inválido.');
      out[campo] = (out[campo] || 0) + valor;
      if (!Number.isSafeInteger(out[campo])) throw new Error('La suma de las cuentas excede el rango seguro.');
    }
    if (!Object.keys(out).length) throw new Error('No se identificaron las cuentas descargadas; no se usan totales como saldo obligatorio.');
    return { ...out, ...(typeof json.afp === 'string' ? { afp: json.afp } : {}), capturadoEn: new Date().toISOString(), capturadoPor: 'rpa-directo' };
  }
  for (const [campo, alias] of Object.entries(campos)) {
    const valor = json[alias] ?? json[campo];
    if (valor == null) continue;
    if ((typeof valor !== 'number' && typeof valor !== 'string') || String(valor).trim() === '') throw new Error(`Saldo ${campo} inválido.`);
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero < 0) throw new Error(`Saldo ${campo} inválido.`);
    out[campo] = numero;
  }
  if (!Object.keys(out).length) {
    const error = new Error('La AFP no devolvió saldos reconocibles; no se modificó el expediente.');
    error.code = 'SIN_SALDOS';
    throw error;
  }
  return { ...out, ...(typeof json.afp === 'string' ? { afp: json.afp } : {}), capturadoEn: new Date().toISOString(), capturadoPor: 'rpa-directo' };
}
