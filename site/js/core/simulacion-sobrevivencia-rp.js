import { calcularCNUFamilia } from './cnu-familia.js';
import { pensionRPSimulada } from './cnu.js';
import { edadExacta, parseLocal } from './dates.js';
import { obtenerTasaRP } from '../data/normativa-2026.js';

export function huellaSobrevivenciaRP(cliente) {
  const d = cliente?.sobrevivencia || {};
  return JSON.stringify([(cliente?.beneficiarios || []).map((b) => [b.tipo, b.fechaNacimiento, b.sexo, b.invalidez, b.estudiante, b.hijoComun]),
    d.srpCapitalCLP, d.srpCapitalFecha, d.srpReferencia, d.srpMesesDevengados, d.srpPensionCausanteCLP, d.srpMesesRestantesHijo]);
}

/** Separate group scenario: its aggregate never becomes the holder's pension or benefits base. */
export function simularSobrevivenciaRP(cliente, fecha) {
  const d = cliente?.sobrevivencia || {}, family = cliente?.beneficiarios || [], faltantes = [];
  const date = parseLocal(fecha), tasa = obtenerTasaRP(fecha);
  if (!date || !tasa || fecha >= '2029-07-01') faltantes.push('Fecha, tasa RP y tablas vigentes para el ejercicio');
  if (d.srpConfirmado !== true || d.srpHuella !== huellaSobrevivenciaRP(cliente)) faltantes.push('Confirmar capital remanente, derechos del grupo y referencia del cotejo');
  if (!Number.isSafeInteger(d.srpCapitalCLP) || d.srpCapitalCLP < 0) faltantes.push('Capital remanente válido, declarado por separado en CLP');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.srpCapitalFecha || '') || !parseLocal(d.srpCapitalFecha) || d.srpCapitalFecha > fecha
      || !String(d.srpReferencia || '').trim()) faltantes.push('Fecha no futura y referencia documental del capital/derechos');
  if (!Number.isInteger(d.srpMesesDevengados) || d.srpMesesDevengados < 0 || d.srpMesesDevengados > 120) faltantes.push('Meses devengados declarados, incluido cero');
  if (!family.length) faltantes.push('Beneficiarios declarados; no se presume su ausencia');
  const miembros = family.map((b, index) => {
    const edad = date ? edadExacta(b.fechaNacimiento, date)?.anios : null;
    if (edad == null || !['M', 'F'].includes(b.sexo)) faltantes.push(`Nacimiento y sexo del beneficiario ${index + 1}`);
    if (b.tipo === 'hijo' && !b.invalidez && (edad >= 24 || (edad >= 18 && b.estudiante !== true))) faltantes.push(`Derecho/estudios del hijo ${index + 1}`);
    return { ...b, edad };
  });
  const orfandad = miembros.length > 0 && miembros.every((b) => b.tipo === 'hijo' && !b.invalidez);
  if (orfandad && (!Number.isFinite(d.srpPensionCausanteCLP) || d.srpPensionCausanteCLP <= 0)) faltantes.push('Pensión de referencia/documentada del causante para el tope de orfandad; no se infiere desde el saldo');
  const hijo23 = orfandad && miembros.length === 1 && miembros[0].edad === 23;
  if (hijo23 && (!Number.isInteger(d.srpMesesRestantesHijo) || d.srpMesesRestantesHijo < 1 || d.srpMesesRestantesHijo > 12
      || d.srpMesesDevengados !== 0)) faltantes.push('Hijo único de 23 años: meses reales restantes hasta 24 (1–12) y revisión específica si hay meses devengados');
  if (faltantes.length) return { estado: 'pendiente', faltantes };
  try {
    const cnu = calcularCNUFamilia({ beneficiarios: miembros, sobrevivencia: true, anio: date.getFullYear(), tasa: tasa.tasa });
    const hijos = miembros.filter((b) => b.tipo === 'hijo'), adulto = miembros.find((b) => ['conyuge', 'conviviente', 'filiacion'].includes(b.tipo));
    const base = hijo23 ? null : pensionRPSimulada(d.srpCapitalCLP, cnu.total, d.srpMesesDevengados);
    const pensiones = miembros.map((b) => {
      let porcentaje;
      if (b.tipo === 'hijo') porcentaje = (b.invalidez === 'parcial' && b.edad >= 24 ? 0.11 : 0.15) + (!adulto ? 0.5 / hijos.length : 0);
      else if (b.tipo === 'padre_causante') porcentaje = 0.5;
      else if (b.tipo === 'filiacion') porcentaje = hijos.length ? 0.3 : 0.36;
      else if (b.tipo === 'conviviente' && hijos.length) porcentaje = hijos.some((h) => h.hijoComun) ? 0.5 : 0.15;
      else porcentaje = hijos.length ? 0.5 : 0.6;
      const antesTope = hijo23 ? d.srpCapitalCLP / d.srpMesesRestantesHijo : base * porcentaje;
      const topeCLP = orfandad ? 2 * d.srpPensionCausanteCLP : null;
      return { tipo: b.tipo, nombre: b.nombre || null, porcentaje, antesTopeCLP: antesTope,
        pensionCLP: topeCLP == null ? antesTope : Math.min(antesTope, topeCLP), topeCLP };
    });
    return { estado: 'simulacion', ...cnu, pensiones, totalMensualCLP: pensiones.reduce((sum, p) => sum + p.pensionCLP, 0),
      baseMensualCLP: base, capitalCLP: d.srpCapitalCLP, capitalFecha: d.srpCapitalFecha, referencia: d.srpReferencia,
      parametroTasa: tasa, mesesDevengados: d.srpMesesDevengados, mesesRestantesHijo: hijo23 ? d.srpMesesRestantesHijo : null,
      advertencia: 'Ejercicio separado con capital remanente y derechos cotejados; no acredita fallecimiento, SIS, beneficiarios ni pensión AFP. No se inventan aportes adicionales, ajustes mínimos, salud, impuestos ni comisiones. El total corresponde al grupo y no se usa como pensión individual para PGU/BAC/CEV.' };
  } catch (error) { return { estado: 'pendiente', faltantes: [error.message] }; }
}
