import { pensionRPSimulada } from './cnu.js';
import { calcularCNUFamilia } from './cnu-familia.js';
import { edadExacta, parseLocal } from './dates.js';
import { obtenerTasaRP } from '../data/normativa-2026.js';

const fechaValida = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseLocal(value);

/** A declaration applies only to the exact group used when it was confirmed. */
export function huellaGrupoRP(cliente) {
  const p = cliente?.perfil || {};
  const family = cliente?.beneficiarios || [];
  const base = [p.fechaNacimiento, p.sexo, p.rutaTipo, p.yaPensionado, p.estadoCivil,
    family.map((b) => [b.tipo, b.fechaNacimiento, b.sexo, b.invalidez, b.estudiante])];
  if (p.rutaTipo === 'invalidez' || p.yaPensionado || family.some((b) => b.tipo === 'conviviente')) {
    base.push(p.invalidezTitular, cliente?.sobrevivencia?.rpFechaInicio,
      family.map((b) => b.hijoComun ?? null));
  }
  return JSON.stringify(base);
}

/** Separate simulation: never mutates or promotes an estimate to an AFP source field. */
export function simularRP(cliente, fecha) {
  const p = cliente?.perfil || {}, d = cliente?.sobrevivencia || {};
  const faltantes = [];
  const parametroTasa = obtenerTasaRP(fecha);
  if (!parametroTasa) faltantes.push('Fecha sin tasa RP revisada vigente; actualizar parámetros en Ajustes con la circular aplicable');
  if (fecha >= '2029-07-01') faltantes.push('Revisar nuevas tablas de mortalidad: TM2020 tiene un período máximo de seis años desde julio de 2023');
  if (d.rpGrupoConfirmado !== true || d.rpHuella !== huellaGrupoRP(cliente)) faltantes.push('Confirmar el grupo familiar completo y las condiciones del escenario');
  if (p.rutaTipo && !['vejez', 'invalidez'].includes(p.rutaTipo)) faltantes.push('La ruta terminal/sobrevivencia requiere un escenario específico; no se calcula como pensión del titular vivo');
  if (p.yaPensionado || p.rutaTipo === 'invalidez') {
    if (!fechaValida(d.rpFechaInicio) || d.rpFechaInicio < '2023-07-01' || d.rpFechaInicio > fecha) faltantes.push('Fecha de inicio/siniestro válida desde 01/07/2023 para las tablas TM2020; los casos anteriores necesitan tablas históricas');
    if (d.rpCondicionesConfirmadas !== true || !String(d.rpReferenciaCondiciones || '').trim()) faltantes.push('Cotejar condiciones de recálculo/dictamen y registrar su referencia');
  }
  if (p.rutaTipo === 'invalidez' && !['total', 'parcial'].includes(p.invalidezTitular)) faltantes.push('Grado de invalidez declarado del titular en Perfil');
  if (!['M', 'F'].includes(p.sexo)) faltantes.push('Sexo del titular');
  const fechaCalculo = parseLocal(fecha);
  const edad = fechaCalculo ? edadExacta(p.fechaNacimiento, fechaCalculo)?.anios : null;
  if (edad == null || edad < 20 || edad > 110) faltantes.push('Fecha de nacimiento válida del titular');
  const usaCapitalDeclarado = d.rpCapitalCLP != null && d.rpCapitalCLP !== '';
  const capital = usaCapitalDeclarado ? d.rpCapitalCLP : cliente?.saldo?.obligatorio;
  if (usaCapitalDeclarado && (d.rpCapitalConfirmado !== true || !fechaValida(d.rpCapitalFecha)
      || d.rpCapitalFecha > fecha || !String(d.rpCapitalReferencia || '').trim())) faltantes.push('Cotejar capital destinado al escenario, fecha y referencia; no se suman APV/bonos automáticamente');
  if (!Number.isSafeInteger(capital) || capital < 0) faltantes.push('Capital válido en CLP');
  const z = d.rpMesesDevengados;
  if (!Number.isInteger(z) || z < 0 || z > 120) faltantes.push('Meses de pensión devengados pendientes (declarar 0 si no existen)');
  const family = cliente?.beneficiarios || [];
  const spouses = family.filter((b) => ['conyuge', 'conviviente'].includes(b.tipo));
  const extendido = family.some((b) => b.invalidez || !['conyuge', 'hijo'].includes(b.tipo));
  if (extendido && (d.rpCondicionesConfirmadas !== true || !String(d.rpReferenciaCondiciones || '').trim())) faltantes.push('Cotejar derechos del grupo ampliado y registrar la referencia de revisión');
  const miembros = family.map((b, index) => {
    const edadB = fechaCalculo ? edadExacta(b.fechaNacimiento, fechaCalculo)?.anios : null;
    if (!['M', 'F'].includes(b.sexo)) faltantes.push(`Sexo del beneficiario ${index + 1} (Perfil / Beneficiarios)`);
    if (edadB == null || edadB > 110) faltantes.push(`Fecha de nacimiento válida del beneficiario ${index + 1}`);
    if (b.tipo === 'hijo' && !b.invalidez && (edadB >= 24 || (edadB >= 18 && b.estudiante !== true))) faltantes.push(`Revisar derecho y condición de estudiante del hijo ${index + 1}`);
    return { edad: edadB, sexo: b.sexo, tipo: b.tipo, invalidez: b.invalidez, hijoComun: b.hijoComun };
  });
  if (['casado', 'auc'].includes(p.estadoCivil) && !spouses.length) faltantes.push('Registrar el cónyuge o revisar el grupo familiar; no se presume ausencia de beneficiarios');
  const comision = d.rpComisionPct;
  if (comision != null && (!Number.isFinite(comision) || comision < 0 || comision > 100 || !String(d.rpComisionReferencia || '').trim())) faltantes.push('Comisión declarada válida y referencia del cargo AFP; no se presume un costo cero');
  if (faltantes.length) return { estado: 'pendiente', faltantes };
  try {
    const resultado = calcularCNUFamilia({ titular: { edad, sexo: p.sexo, invalidez: p.rutaTipo === 'invalidez' ? p.invalidezTitular : null },
      beneficiarios: miembros, anio: fechaCalculo.getFullYear(), tasa: parametroTasa.tasa });
    const pensionCLP = pensionRPSimulada(capital, resultado.total, z);
    return { estado: 'simulacion', ...resultado, parametroTasa, capitalCLP: capital, mesesDevengados: z, fecha,
      pensionCLP, edad, tipoEscenario: p.yaPensionado ? 'recálculo referencial TM2020' : p.rutaTipo === 'invalidez' ? 'invalidez declarada TM2020' : 'vejez',
      capitalFuente: usaCapitalDeclarado ? `Capital declarado para el escenario · ${d.rpCapitalFecha} · ${d.rpCapitalReferencia}` : 'Saldo obligatorio registrado',
      revisionCondiciones: d.rpCondicionesConfirmadas === true ? d.rpReferenciaCondiciones : null,
      comisionPct: comision ?? null, comisionCLP: comision != null ? pensionCLP * comision / 100 : null,
      pensionTrasComisionCLP: comision != null ? pensionCLP * (1 - comision / 100) : null,
      comisionReferencia: comision != null ? d.rpComisionReferencia : null,
      advertencia: 'Ejercicio con edades en años cumplidos y grupo declarado, no pensión AFP ni liquidación SIS. El capital destinado, dictamen, saldo retenido y derechos requieren cotejo; no se inventan aportes adicionales ni se suman APV/bonos. No acredita elegibilidad ni ajustes regulatorios. La comisión, si se declara, se muestra aparte del bruto; salud, impuesto y beneficios requieren sus antecedentes. No proyecta aportes ni rentabilidad futura.' };
  } catch (error) { return { estado: 'pendiente', faltantes: [error.message] }; }
}
