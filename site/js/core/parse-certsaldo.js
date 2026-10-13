/* PreviSmart · parse-certsaldo.js — parser del Certificado (Electrónico)
   de Saldo que emite cada AFP. Cada AFP tiene su propio formato, así que
   la extracción es heurística y conservadora: captura solo líneas que
   nombran explícitamente el concepto. La vista de revisión muestra lo
   encontrado antes de escribir el expediente — nada se aplica a ciegas.
   Afinable con certificados reales por AFP. */

const NFC = (t) => String(t).normalize('NFC').replace(/ /g, ' ');
const numCLP = (s) => Number(String(s || '').replace(/[^\d-]/g, '')) || 0;
const numUF = (s) => Number(String(s || '').replace(/\./g, '').replace(',', '.')) || 0;

const CLAVES = [
  [/saldo\s+(de\s+)?(la\s+)?cuenta\s+(de\s+)?(capitalizaci[oó]n\s+)?individual\s+(de\s+)?(cotizaciones\s+)?obligatorias/i, 'obligatorio'],
  [/saldo\s+obligatorio/i, 'obligatorio'],
  [/ahorro\s+previsional\s+voluntario|saldo\s+(de\s+)?apv\b|\bAPV\b/i, 'apv'],
  [/dep[oó]sitos?\s+convenidos?/i, 'depositosConvenidos'],
  [/cotizaciones\s+voluntarias/i, 'cotizacionesVoluntarias'],
  [/cuenta\s*(2|dos)\b|ahorro\s+voluntario/i, 'cuenta2'],
  [/cuenta\s+de\s+ahorro\s+para\s+(la\s+)?indemnizaci[oó]n|\bCAI\b/i, 'cuentaIndemnizacion'],
  [/bono\s+de\s+reconocimiento/i, 'bonoReconocimiento'],
  [/bono\s+por\s+hijo/i, 'bonoPorHijo'],
  [/otros\s+bonos/i, 'otrosBonos']
];

/**
 * Extrae saldos CLP de un certificado de saldo AFP (texto del PDF).
 * @returns {{saldo:object, perfil:object, detectado:string[]}}
 */
/** Nombre de cuenta de cartola → campo del expediente. */
function campoCuenta(nombre) {
  if (/obligatori/i.test(nombre)) return 'obligatorio';
  if (/apv|previsional\s+voluntario/i.test(nombre)) return 'apv';
  if (/\b2\b|\bdos\b/i.test(nombre)) return 'cuenta2';
  if (/dep[oó]sito|convenido/i.test(nombre)) return 'depositosConvenidos';
  if (/indemnizaci/i.test(nombre)) return 'cuentaIndemnizacion';
  if (/voluntari/i.test(nombre)) return 'cotizacionesVoluntarias';
  return null;
}

const fechaISO = (s) => s.replace(/(\d{2})[\/-](\d{2})[\/-](\d{4})/, '$3-$2-$1');
const montoEnLinea = (l) => l.match(/\$\s*[\d.]+/) || l.match(/UF\s*[\d.,]+/i);

export function parsearCertSaldo(texto) {
  const lineas = NFC(texto).split('\n');
  const saldo = {};
  const perfil = {};
  const detectado = [];
  /* Candidatos con fecha explícita: cartola AFP (p.ej. Modelo) declara
     "Ahorro en CUENTA OBLIGATORIA al DD/MM/AAAA $N.NNN.NNN" para saldo
     inicial Y final, y "¿Cuánto ahorro tenía al <fecha>?" en el resumen.
     Gana la fecha mayor por cuenta = saldo al cierre del período. */
  const candidatos = {};
  /* OCR de escaneados degrada las líneas de detalle ("Ahorro en…"),
     pero el bloque resumen suele sobrevivir: "Cta. Obligatoria $X"
     (inicial y final en la misma línea → el último $ es el final) junto
     a "Saldo Final al dd/mm/aaaa". */
  let fechaFinalCartola = null;
  let montoCtaOblig = null;

  for (const cruda of lineas) {
    const l = cruda.trim();
    if (!l) continue;

    const mSF = l.match(/saldo\s+final\s+al\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (mSF) fechaFinalCartola = fechaISO(mSF[1]);
    if (/cta\.?\s*obligatoria/i.test(l)) {
      const ms = l.match(/\$\s*[\d.]+/g);
      if (ms) montoCtaOblig = numCLP(ms[ms.length - 1]);
    }

    const mAh = l.match(/ahorro en (cuenta [a-záéíóúñ0-9 .]+?) al (\d{2}\/\d{2}\/\d{4})/i)
      || l.match(/cu[aá]nto ahorro ten[ií]a al (\d{2}\/\d{2}\/\d{4})/i);
    if (mAh) {
      const cuenta = mAh[2] ? mAh[1] : 'CUENTA OBLIGATORIA';
      const fecha = mAh[2] || mAh[1];
      const campo = campoCuenta(cuenta);
      // La línea puede traer columnas (fondo + total): el último $ es el total.
      const montos = l.slice(mAh.index + mAh[0].length).match(/\$\s*[\d.]+/g);
      const v = montos ? numCLP(montos[montos.length - 1]) : 0;
      if (campo && v && (!candidatos[campo] || fechaISO(fecha) > candidatos[campo].fecha)) {
        candidatos[campo] = { fecha: fechaISO(fecha), monto: v };
      }
      continue;
    }

    for (const [re, campo] of CLAVES) {
      if (saldo[campo] != null || !re.test(l)) continue;
      const monto = montoEnLinea(l);
      if (!monto) continue;
      saldo[campo] = /UF/i.test(monto[0]) ? { uf: numUF(monto[0].replace(/[^\d.,]/g, '')) } : numCLP(monto[0]);
      detectado.push(`${campo}: ${monto[0].trim()}`);
    }
  }

  if (montoCtaOblig && !candidatos.obligatorio) {
    candidatos.obligatorio = { fecha: fechaFinalCartola || '9999-12-31', monto: montoCtaOblig };
  }

  /* Los saldos fechados de la cartola ganan sobre la heurística genérica. */
  let fechaSaldo = null;
  for (const [campo, c] of Object.entries(candidatos)) {
    saldo[campo] = c.monto;
    detectado.push(`${campo}: $${c.monto.toLocaleString('es-CL')} al ${c.fecha} (cartola)`);
    if (!fechaSaldo || c.fecha > fechaSaldo) fechaSaldo = c.fecha;
  }
  if (fechaSaldo) saldo.saldoAl = fechaSaldo;

  /* Identidad: RUT/CI + nombre + AFP emisora, si aparecen explícitos.
     La cartola Modelo usa "NOMBRE APELLIDOS C.I.: 12.345.678-9" y
     "A.F.P. MODELO" (sigla con puntos). */
  const plano = lineas.join(' ');
  const rut = plano.match(/(?:RUT|C\.?\s?[IiLl1]\.?)[:\sN°]*\s*([\d.]+-[\dkK])/i);
  if (rut) perfil.rut = rut[1];
  const nom = plano.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ ]{6,60})\s+C\.?\s?[IiLl1]\.?\s*:/);
  if (nom) perfil.nombre = nom[1].trim()
    .replace(/^(provida|cuprum|habitat|capital|planvital|modelo|uno|afp|a\.f\.p\.?)\s+/i, '');
  const afp = plano.match(/A\.?\s?F\.?\s?P\.?\s+(PROVIDA|CUPRUM|HABITAT|CAPITAL|PLANVITAL|MODELO|UNO)\b/i);
  if (afp) perfil.afp = afp[1][0].toUpperCase() + afp[1].slice(1).toLowerCase();
  const fondo = plano.match(/fondo\s+([A-E])\s+equivale/i)
    || plano.match(/saldo en el fondo ([A-E])\b/i)
    || plano.match(/fondos de pensiones tengo mis ahorros\?*\s*\d*\s*([A-E])\b/i);
  if (fondo) saldo.fondo = fondo[1].toUpperCase();
  const emision = plano.match(/(?:fecha\s+de\s+)?emisión\s*:?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i);
  if (emision) saldo.certEmitido = fechaISO(emision[1]);
  else if (fechaSaldo) saldo.certEmitido = fechaSaldo; // saldo al cierre del período

  /* Normaliza montos UF→CLP solo si el certificado declara su UF. */
  const ufRef = plano.match(/valor\s+(de\s+la\s+)?UF[^$]*\$\s*([\d.,]+)/i);
  if (ufRef) saldo.ufEmisionCLP = numUF(ufRef[2]);
  if (saldo.ufEmisionCLP) {
    for (const k of Object.keys(saldo)) {
      if (saldo[k] && typeof saldo[k] === 'object' && saldo[k].uf != null) {
        saldo[k] = Math.round(saldo[k].uf * saldo.ufEmisionCLP);
      }
    }
  }

  return { saldo, perfil, detectado };
}
