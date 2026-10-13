import { calcularCNU, supervivenciaCohorte, tablaMortalidad } from './cnu.js';

const round6 = (value) => Math.round(value * 1e6) / 1e6;
const TIPOS = new Set(['conyuge', 'conviviente', 'filiacion', 'padre_causante', 'hijo']);

/** SP Annex 7: one declared family, integer ages; not an eligibility decision. */
export function calcularCNUFamilia({ titular = null, beneficiarios = [], anio, tasa, sobrevivencia = false }) {
  if (!Number.isFinite(tasa) || tasa < 0 || tasa > 0.2 || !Number.isInteger(anio) || anio < 2020 || anio > 2100
      || !Array.isArray(beneficiarios) || beneficiarios.length > 20 || typeof sobrevivencia !== 'boolean'
      || (sobrevivencia && !beneficiarios.length)) throw new Error('Parámetros familiares inválidos.');
  const hijos = beneficiarios.filter((b) => b?.tipo === 'hijo');
  const adultos = beneficiarios.filter((b) => ['conyuge', 'conviviente', 'filiacion'].includes(b?.tipo));
  const padres = beneficiarios.filter((b) => b?.tipo === 'padre_causante');
  if (adultos.length > 1 || padres.length > 2 || (padres.length && (adultos.length || hijos.length))) throw new Error('Se requiere cálculo específico para grupos múltiples o padres concurrentes con otros beneficiarios.');
  for (const b of beneficiarios) {
    if (!TIPOS.has(b?.tipo) || !Number.isInteger(b.edad) || b.edad < 0 || b.edad > 110
        || (b.tipo !== 'hijo' && b.edad < 18) || (b.tipo === 'hijo' && !b.invalidez && b.edad >= 24)) throw new Error('Tipo o edad del beneficiario fuera del rango admitido.');
    tablaMortalidad(b, true);
  }
  const adulto = adultos[0];
  if (adulto?.tipo === 'conviviente' && hijos.some((b) => typeof b.hijoComun !== 'boolean')) throw new Error('Declarar para cada hijo si es común con el conviviente civil.');

  // Preserve the already validated Note 9 retirement path exactly.
  if (!sobrevivencia && !padres.length && (!adulto || adulto.tipo === 'conyuge') && !hijos.some((b) => b.invalidez)) {
    return calcularCNU({ titular, conyuge: adulto || null, hijos, anio, tasa });
  }
  const componentes = sobrevivencia ? [] : calcularCNU({ titular, anio, tasa }).componentes;
  const sx = sobrevivencia ? null : supervivenciaCohorte(tablaMortalidad(titular), titular.edad, anio);
  const sinAdulto = !adultos.length;
  for (const b of beneficiarios) {
    const tabla = tablaMortalidad(b, true), sb = supervivenciaCohorte(tabla, b.edad, anio);
    const terms = sb.map((s, t) => s * (sobrevivencia ? 1 : 1 - (sx[t] ?? 0)) / (1 + tasa) ** t);
    const full = terms.reduce((sum, term) => sum + term, 0) - (sobrevivencia ? 11 / 24 : 0);
    const deferred = (until) => terms.slice(until).reduce((sum, term) => sum + term, 0) - 11 / 24 * (terms[until] ?? 0);
    let cnu, formula;
    if (b.tipo === 'hijo') {
      const until = 24 - b.edad;
      const extra = sinAdulto ? 0.5 / hijos.length : 0;
      if (b.invalidez === 'total') {
        cnu = (0.15 + extra) * full; formula = sinAdulto ? 'hijo inválido total sin adulto' : 'hijo inválido total con adulto';
      } else if (b.invalidez === 'parcial') {
        cnu = until <= 0 ? (0.11 + extra) * full
          : (0.15 + (sobrevivencia ? extra : 0)) * (terms.slice(0, until).reduce((sum, term) => sum + term, 0) - (sobrevivencia ? 11 / 24 : 0))
            + (0.11 + extra) * terms.slice(until).reduce((sum, term) => sum + term, 0) + 0.04 * 11 / 24 * (terms[until] ?? 0);
        formula = 'hijo inválido parcial: cambio de porcentaje a los 24';
      } else {
        cnu = (0.15 + extra) * (terms.slice(0, until).reduce((sum, term) => sum + term, 0)
          - (sobrevivencia ? 11 / 24 : 0) + 11 / 24 * (terms[until] ?? 0));
        formula = 'hijo no inválido hasta los 24';
      }
    } else if (b.tipo === 'padre_causante') {
      cnu = 0.5 * full; formula = 'padre/madre sin otros beneficiarios';
    } else {
      const invalidos = hijos.some((h) => h.invalidez);
      const until = hijos.length ? 24 - Math.min(...hijos.filter((h) => !h.invalidez).map((h) => h.edad)) : 0;
      if (b.tipo === 'conviviente') {
        const comunes = hijos.some((h) => h.hijoComun);
        if (!hijos.length) cnu = 0.6 * full;
        else if (invalidos) cnu = (comunes ? 0.5 : 0.15) * full;
        else cnu = (comunes ? 0.5 : 0.15) * full + (comunes ? 0.1 : 0.45) * deferred(until);
        formula = 'conviviente civil: hijos comunes declarados';
      } else {
        const base = b.tipo === 'filiacion' ? 0.36 : 0.6;
        const conHijos = b.tipo === 'filiacion' ? 0.3 : 0.5;
        cnu = !hijos.length ? base * full : invalidos ? conHijos * full : conHijos * full + (base - conHijos) * deferred(until);
        formula = `${b.tipo}: con/sin hijos e invalidez declarada`;
      }
    }
    componentes.push({ tipo: b.tipo, tabla, edad: b.edad, cnu: round6(cnu), formula });
  }
  return { componentes, total: round6(componentes.reduce((sum, c) => sum + c.cnu, 0)), anio, tasa, sobrevivencia };
}
