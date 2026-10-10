import { addDiasHabiles, aISO, parseLocal } from './dates.js';

/** Operator-selected policy, not a statutory retention requirement. */
export const DIAS_RETENCION = 30;
export const CALENDARIO_RETENCION = { desde: '2026-01-01', hasta: '2027-12-31' };

export function vencimientoRetencion(fechaFirma) {
  const inicio = parseLocal(fechaFirma);
  if (!inicio || fechaFirma !== aISO(inicio)) throw new Error('Fecha de firma inválida.');
  if (fechaFirma < CALENDARIO_RETENCION.desde || fechaFirma > CALENDARIO_RETENCION.hasta) throw new Error('Actualiza y verifica el calendario de feriados antes de calcular este plazo.');
  // The signature day is day zero; start counting on the next business day.
  const vencimiento = aISO(addDiasHabiles(fechaFirma, DIAS_RETENCION));
  if (vencimiento > CALENDARIO_RETENCION.hasta) throw new Error('El plazo supera el calendario de feriados disponible. Actualízalo antes de generar la autorización.');
  return vencimiento;
}
