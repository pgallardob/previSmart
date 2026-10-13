import { TM2020 } from '../data/tm2020.js';

const round6 = (value) => Math.round(value * 1e6) / 1e6;

/** SP NCG 306: mortality depends on declared sex, role and invalidity. */
export function tablaMortalidad(person, beneficiario = false) {
  if (!['M', 'F'].includes(person?.sexo)) throw new Error('Falta sexo declarado para seleccionar la tabla de mortalidad.');
  if (person.invalidez && !['total', 'parcial'].includes(person.invalidez)) throw new Error('Grado de invalidez inválido.');
  if (person.invalidez) return person.sexo === 'M' ? 'MI-H-2020' : 'MI-M-2020';
  return person.sexo === 'M' ? 'CB-H-2020' : beneficiario ? 'B-M-2020' : 'RV-M-2020';
}

/** SP Technical Note 9, equations 2 and 9–16. Integer-age, constant-rate scenario. */
export function supervivenciaCohorte(tabla, edad, anio) {
  const rows = TM2020.tables[tabla];
  if (!rows || !Number.isInteger(edad) || edad < rows[0][0] || edad > 110
      || !Number.isInteger(anio) || anio < 2020 || anio > 2100) throw new Error('Edad, año o tabla actuarial inválidos.');
  const survival = [1];
  for (let age = edad; age < 110; age++) {
    const row = rows[age - rows[0][0]];
    let q = row[1];
    for (let year = 2021; year <= anio + age - edad; year++) q *= 1 - row[2 + Math.min(year - 2021, 15)];
    survival.push(survival.at(-1) * (1 - q));
  }
  return survival;
}

export function calcularCNU({ titular, conyuge = null, hijos = [], anio, tasa }) {
  if (!Number.isFinite(tasa) || tasa < 0 || tasa > 0.2 || !Array.isArray(hijos) || hijos.length > 20) throw new Error('Parámetros de cálculo inválidos.');
  const tabla = tablaMortalidad;
  const holderTable = tabla(titular);
  const sx = supervivenciaCohorte(holderTable, titular.edad, anio);
  const discount = (t) => (1 + tasa) ** t;
  const holder = round6(sx.reduce((sum, s, t) => sum + s / discount(t), 0) - 11 / 24);
  const components = [{ tipo: 'titular', tabla: holderTable, edad: titular.edad, cnu: holder }];
  for (const child of hijos) if (child.invalidez || !Number.isInteger(child.edad) || child.edad < 0 || child.edad >= 24) throw new Error('Hijo fuera del rango actuarial admitido; usar el cálculo familiar específico para invalidez.');
  if (conyuge) {
    const spouseTable = tabla(conyuge, true);
    const sy = supervivenciaCohorte(spouseTable, conyuge.edad, anio);
    const terms = sy.map((s, t) => s * (1 - (sx[t] ?? 0)) / discount(t));
    let component = 0.6 * terms.reduce((a, b) => a + b, 0);
    if (hijos.length) {
      const until = 24 - Math.min(...hijos.map((h) => h.edad));
      component = 0.5 * terms.reduce((a, b) => a + b, 0)
        + 0.1 * terms.slice(until).reduce((a, b) => a + b, 0) - 0.1 * 11 / 24 * (terms[until] ?? 0);
    }
    components.push({ tipo: 'conyuge', tabla: spouseTable, edad: conyuge.edad, cnu: round6(component) });
  }
  for (const child of hijos) {
    const childTable = tabla(child, true);
    const sh = supervivenciaCohorte(childTable, child.edad, anio);
    const until = 24 - child.edad;
    let component = 0;
    for (let t = 0; t < until; t++) component += sh[t] * (1 - (sx[t] ?? 0)) / discount(t);
    component += 11 / 24 * sh[until] * (1 - (sx[until] ?? 0)) / discount(until);
    component *= conyuge ? 0.15 : 0.15 + 0.5 / hijos.length;
    components.push({ tipo: 'hijo', tabla: childTable, edad: child.edad, cnu: round6(component) });
  }
  return { componentes: components, total: round6(components.reduce((sum, c) => sum + c.cnu, 0)), anio, tasa };
}

/** Gross monthly RP before adjustments, commissions, health, tax and public benefits. */
export function pensionRPSimulada(capitalCLP, cnu, mesesDevengados = 0) {
  if (!Number.isSafeInteger(capitalCLP) || capitalCLP < 0 || !Number.isFinite(cnu) || cnu <= 0
      || !Number.isInteger(mesesDevengados) || mesesDevengados < 0 || mesesDevengados > 120) throw new Error('Base de retiro programado inválida.');
  return capitalCLP / (12 * cnu + mesesDevengados);
}
