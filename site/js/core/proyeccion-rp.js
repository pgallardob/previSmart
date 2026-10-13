import { calcularCNUFamilia } from './cnu-familia.js';
import { pensionRPSimulada } from './cnu.js';
import { aISO, edadExacta, parseLocal } from './dates.js';

/** End-of-month deposits, effective annual real return, constant purchasing-power CLP. */
export function proyectarCapital({ capitalInicialCLP, aporteMensualCLP, tasaRealAnualPct, meses }) {
  if (![capitalInicialCLP, aporteMensualCLP].every((n) => Number.isSafeInteger(n) && n >= 0)
      || !Number.isFinite(tasaRealAnualPct) || tasaRealAnualPct < -50 || tasaRealAnualPct > 50
      || !Number.isInteger(meses) || meses < 1 || meses > 360) throw new Error('Capital, aporte, retorno real o plazo de proyección inválidos.');
  const mensual = (1 + tasaRealAnualPct / 100) ** (1 / 12) - 1;
  let capital = capitalInicialCLP;
  const puntos = [{ mes: 0, capitalCLP: capital }];
  for (let mes = 1; mes <= meses; mes++) {
    capital = capital * (1 + mensual) + aporteMensualCLP;
    if (!Number.isFinite(capital) || capital > Number.MAX_SAFE_INTEGER) throw new Error('La proyección supera la precisión monetaria admitida.');
    if (mes % 12 === 0 || mes === meses) puntos.push({ mes, capitalCLP: capital });
  }
  return { capitalFinalCLP: capital, aporteTotalCLP: aporteMensualCLP * meses, puntos, tasaMensual: mensual };
}

function avanzarMeses(fecha, meses) {
  const inicio = parseLocal(fecha), result = new Date(inicio.getFullYear(), inicio.getMonth() + meses, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(inicio.getDate(), lastDay));
  return result;
}

export function huellaProyeccionRP(cliente) {
  const p = cliente?.perfil || {}, d = cliente?.sobrevivencia || {};
  return JSON.stringify([cliente?.saldo?.obligatorio, p.fechaNacimiento, p.sexo, p.rutaTipo, p.estadoCivil,
    cliente?.beneficiarios, d.proyMeses, d.proyAporteCLP, d.proyRetornoPct, d.proyTasaRPpct, d.proyHijosEstudiantes]);
}

/** Planning scenario only: current mortality held as an explicit hypothesis, no future normative rate. */
export function proyectarRP(cliente, fecha) {
  const d = cliente?.sobrevivencia || {}, p = cliente?.perfil || {}, faltantes = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !parseLocal(fecha)) faltantes.push('Fecha válida de inicio del ejercicio');
  if (d.proyConfirmado !== true || d.proyHuella !== huellaProyeccionRP(cliente)) faltantes.push('Aceptar las hipótesis de capital, aportes, retorno, tasa y familia futura');
  if (p.rutaTipo && p.rutaTipo !== 'vejez') faltantes.push('Esta proyección de ahorro corresponde a planificación de vejez, no a terminal/invalidez/sobrevivencia');
  if (faltantes.length) return { estado: 'pendiente', faltantes };
  try {
    const capital = proyectarCapital({ capitalInicialCLP: cliente?.saldo?.obligatorio, aporteMensualCLP: d.proyAporteCLP,
      tasaRealAnualPct: d.proyRetornoPct, meses: d.proyMeses });
    const futura = avanzarMeses(fecha, d.proyMeses), edad = edadExacta(p.fechaNacimiento, futura)?.anios;
    const omitidos = [], grupo = [], faltantesPension = [];
    for (const [i, b] of (cliente.beneficiarios || []).entries()) {
      const edadB = edadExacta(b.fechaNacimiento, futura)?.anios;
      if (edadB == null) { faltantesPension.push(`Nacimiento del beneficiario ${i + 1}`); continue; }
      if (b.tipo === 'hijo' && !b.invalidez && edadB >= 24) { omitidos.push(b.nombre || `Hijo ${i + 1}`); continue; }
      if (b.tipo === 'hijo' && !b.invalidez && edadB >= 18 && d.proyHijosEstudiantes !== true) faltantesPension.push(`Hipótesis de estudios del hijo ${i + 1} entre 18 y 24 años`);
      grupo.push({ ...b, edad: edadB });
    }
    let cnu = null, pensionHipoteticaCLP = null;
    if (!['M', 'F'].includes(p.sexo) || edad == null) faltantesPension.push('Nacimiento y sexo del titular');
    if (['casado', 'auc'].includes(p.estadoCivil) && !grupo.some((b) => ['conyuge', 'conviviente'].includes(b.tipo))) faltantesPension.push('Cónyuge/conviviente en la familia proyectada; no se presume su ausencia');
    if (!Number.isFinite(d.proyTasaRPpct) || d.proyTasaRPpct < 0 || d.proyTasaRPpct > 20) faltantesPension.push('Tasa anual CNU hipotética explícita (no es una tasa futura publicada)');
    if (!faltantesPension.length) {
      try {
        cnu = calcularCNUFamilia({ titular: { edad, sexo: p.sexo }, beneficiarios: grupo, anio: futura.getFullYear(), tasa: d.proyTasaRPpct / 100 });
        pensionHipoteticaCLP = pensionRPSimulada(Math.round(capital.capitalFinalCLP), cnu.total, 0);
      } catch (error) { faltantesPension.push(error.message); }
    }
    return { estado: 'hipotesis', ...capital, fechaInicio: fecha, fechaFutura: aISO(futura), edadFutura: edad,
      capitalInicialCLP: cliente.saldo.obligatorio, aporteMensualCLP: d.proyAporteCLP, tasaRealAnualPct: d.proyRetornoPct,
      tasaCNUhipoteticaPct: d.proyTasaRPpct ?? null, cnu, pensionHipoteticaCLP, faltantesPension, omitidos,
      advertencia: 'Hipótesis matemática en pesos de poder adquisitivo constante: aportes al final de cada mes, retorno real y tasa CNU declarados. Supone que el titular y los beneficiarios proyectados siguen vivos y conserva sus tablas TM2020, incluso si deben reemplazarse normativamente antes de esa fecha. No predice rentabilidad, tasas futuras, nuevos beneficiarios ni cotizaciones de aseguradoras; no acredita edad actuarial, elegibilidad ni pensión AFP. No incluye comisiones, salud, impuestos, SIS ni beneficios concedidos. No modifica saldos ni pensiones documentales.' };
  } catch (error) { return { estado: 'pendiente', faltantes: [error.message] }; }
}
