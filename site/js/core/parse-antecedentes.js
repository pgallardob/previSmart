import { parseLocal } from './dates.js';

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const normalizar = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
function fechaTexto(s) {
  const m = s?.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  const mes = m && MESES[m[2].toLowerCase()];
  const iso = mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  return parseLocal(iso) ? iso : null;
}
export function esAntecedenteAFP(texto) {
  return /certificado\s+(?:de\s+)?(?:afiliaci[oó]n|cotizaciones)/i.test(normalizar(texto));
}
/** Explicit certificate fields only; a listed contribution period is not a lifetime total. */
export function parsearAntecedentes(texto) {
  const plano = normalizar(texto);
  const tipoDoc = /certificado\s+(?:de\s+)?afiliaci[oó]n/i.test(plano) ? 'certificado-afiliacion' : 'certificado-cotizaciones';
  const perfil = {}, detectado = [];
  const rut = plano.match(/R\.?\s*U\.?\s*T\.?\s*:?\s*([\d.]+-[\dkK])/i);
  if (rut) perfil.rut = rut[1];
  const nombre = plano.match(/certifica\s+que(?:\s+a\s+la\s+fecha,?)?\s+(?:el|la)\s+Sr(?:a)?\.?\s*:?\s*([^,]+?),?\s+R\.?\s*U\.?\s*T\.?/i);
  if (nombre) perfil.nombre = nombre[1].trim();
  const afp = plano.match(/A\.?\s*F\.?\s*P\.?\s+(Modelo|Provida|Cuprum|Habitat|Capital|Planvital|Uno)\b/i);
  if (afp) perfil.afp = afp[1];
  const primera = plano.match(/ingres[oó]\s+al\s+nuevo\s+Sistema\s+Previsional\s+con\s+fecha\s+(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i);
  if (primera && fechaTexto(primera[1])) perfil.fechaPrimeraAfiliacion = fechaTexto(primera[1]);
  if (perfil.fechaPrimeraAfiliacion) detectado.push('Fecha de primera afiliación al sistema previsional');
  const direccion = plano.match(/DOMICILIO\s*:\s*(.*?)\s+registra\s+en\s+su\s+CUENTA/i);
  if (direccion?.[1].replace(/[\s,]/g, '')) perfil.direccion = direccion[1].replace(/^\s*,\s*/, '').trim();
  const periodos = new Set();
  for (const m of plano.matchAll(/\b(0[1-9]|1[0-2])[-/](19\d{2}|20\d{2})\s+COTIZACI[OÓ]N\s+(?:NORMAL|OBLIGATORIA)/gi)) periodos.add(`${m[2]}-${m[1]}`);
  const cotizaciones = periodos.size ? { mesesObservados: periodos.size, periodosPagados: [...periodos].sort(), coberturaCompleta: false,
    nota: 'Meses distintos con cotización normal observada en este documento; no se presume historial laboral completo ni remuneración imponible.' } : null;
  if (cotizaciones) detectado.push(`${cotizaciones.mesesObservados} meses con cotización observada (no total de vida laboral)`);
  return { tipo: 'antecedentes', tipoDoc, perfil, saldo: {}, detectado, cotizaciones };
}
