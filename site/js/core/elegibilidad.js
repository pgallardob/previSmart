/* PreviSmart · elegibilidad.js — motor puro de verificación.
   Recibe el cliente y la UF vigente; devuelve veredictos con
   estado, explicación y fuente. Sin DOM: testeable. */

import { NORMATIVA } from '../data/normativa-2026.js';
import { edadExacta, fechaCumple, diasCorridosEntre, hoy, parseLocal } from './dates.js';
import { ufAclp } from './format.js';

const MESES_ANIO = 12;

function mesesEntre(a, b) {
  return (b.getFullYear() - a.getFullYear()) * MESES_ANIO + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
}

/** Perfil completo mínimo para evaluar: sexo + fechaNacimiento. */
export function datosFaltantes(cliente) {
  const falta = [];
  const p = cliente?.perfil || {};
  if (!p.sexo) falta.push('sexo');
  if (!edadExacta(p.fechaNacimiento)) falta.push('fecha de nacimiento válida');
  if (!cliente?.saldo?.pensionEstimadaUF) falta.push('pensión estimada (UF)');
  if (!Number.isFinite(p.promedioRemuneraciones)) falta.push('promedio de remuneraciones');
  return falta;
}

/**
 * Evalúa la elegibilidad del cliente.
 * @returns {Array<{id, estado, titulo, texto, fuente}>}
 *   estado: 'success' | 'warning' | 'danger' | 'info' | 'pendiente'
 */
export function evaluarElegibilidad(cliente, valorUF) {
  const v = [];
  const p = cliente?.perfil || {};
  const s = cliente?.saldo || {};
  const beneficiarios = cliente?.beneficiarios || [];
  const N = NORMATIVA;

  if (!cliente) return v;

  /* ---- Ruta especial (maestro §51-53) ---- */
  const rutasEspeciales = {
    invalidez: 'Pensión de invalidez: usa procedimiento y requisitos propios (dictamen médico, SIS). No se evalúa con la pauta de vejez.',
    terminal: 'Enfermedad terminal certificada: tiene reglas especiales (p. ej., BAC sin estar pensionado).',
    sobrevivencia: 'Pensión de sobrevivencia: el causante falleció; los beneficiarios tramitan ante su AFP y SCOMP puede intervenir.'
  };
  if (p.rutaTipo && rutasEspeciales[p.rutaTipo]) {
    v.push({
      id: 'ruta', estado: 'info',
      titulo: `Ruta especial: ${p.rutaTipo}`,
      texto: rutasEspeciales[p.rutaTipo] + ' Los cálculos de esta pantalla se orientan a vejez.',
      fuente: 'DL 3.500 — maestro §51-53'
    });
  }

  /* ---- Edad legal (§2) ---- */
  const edad = edadExacta(p.fechaNacimiento);
  if (p.sexo && edad) {
    const legal = N.edadLegal[p.sexo === 'F' ? 'mujer' : 'hombre'];
    if (edad.anios >= legal) {
      v.push({
        id: 'edad', estado: 'success',
        titulo: `Edad legal cumplida (${edad.anios} años)`,
        texto: `Con ${legal} años cumplidos puede solicitar pensión de vejez. No está obligada a dejar de trabajar.`,
        fuente: N.edadLegal.fuente
      });
    } else {
      const fecha = fechaCumple(p.fechaNacimiento, legal);
      const faltan = diasCorridosEntre(hoy(), fecha);
      v.push({
        id: 'edad', estado: 'warning',
        titulo: `Aún no cumple la edad legal (${edad.anios} años)`,
        texto: `Cumple ${legal} años el ${fecha.toLocaleDateString('es-CL')} (en ${faltan} días). Alternativa: vejez anticipada si la pensión alcanza los requisitos.`,
        fuente: N.edadLegal.fuente
      });
    }
  } else {
    v.push({ id: 'edad', estado: 'pendiente', titulo: 'Edad legal', texto: 'Completa sexo y fecha de nacimiento en el perfil.', fuente: N.edadLegal.fuente });
  }

  /* ---- Datos de pensión ---- */
  const pensionUF = Number(s.pensionEstimadaUF) || null;
  const pensionCLP = pensionUF != null && Number.isFinite(valorUF) && valorUF > 0 ? ufAclp(pensionUF, valorUF) : null;
  const promedio = Number(p.promedioRemuneraciones) || null;
  const edadLegalOk = p.sexo && edad
    ? edad.anios >= N.edadLegal[p.sexo === 'F' ? 'mujer' : 'hombre']
    : null;

  /* ---- Mínimo 2 UF para renta vitalicia (§8) ---- */
  if (pensionUF == null) {
    v.push({ id: 'min2uf', estado: 'pendiente', titulo: 'Mínimo 2 UF para renta vitalicia', texto: 'Ingresa la pensión estimada (UF) en el perfil para verificar.', fuente: N.rentaVitaliciaMinUF.fuente });
  } else if (pensionUF >= N.rentaVitaliciaMinUF.valor) {
    v.push({
      id: 'min2uf', estado: 'success',
      titulo: `Supera el mínimo: ${pensionUF.toFixed(2)} UF ≥ 2 UF`,
      texto: 'Puede acceder a renta vitalicia inmediata y a renta temporal + vitalicia diferida. Umbral vigente desde 01-09-2025 (antes era 3 UF).',
      fuente: N.rentaVitaliciaMinUF.fuente
    });
  } else {
    v.push({
      id: 'min2uf', estado: 'danger',
      titulo: `Bajo el mínimo: ${pensionUF.toFixed(2)} UF < 2 UF`,
      texto: 'No puede financiar una renta vitalicia; la modalidad disponible sería retiro programado (y revisar PGU/beneficios).',
      fuente: N.rentaVitaliciaMinUF.fuente
    });
  }

  /* ---- Vejez anticipada y ELD (§2, §34-35) — solo si no cumple edad legal ---- */
  const veredictoAnticipada = () => {
    if (pensionUF == null || promedio == null || pensionCLP == null) {
      return { id: 'anticipada', estado: 'pendiente', titulo: 'Vejez anticipada', texto: 'Falta pensión estimada y/o promedio de remuneraciones.', fuente: N.vejezAnticipada.fuente };
    }
    const ok70 = pensionCLP >= N.vejezAnticipada.pctPromedioMinimo * promedio;
    const ok12 = pensionUF >= N.vejezAnticipada.minUF;
    if (ok70 && ok12) {
      return { id: 'anticipada', estado: 'success', titulo: 'Califica para vejez anticipada', texto: `Pensión estimada cumple AMBAS condiciones: ≥70% del promedio y ≥12 UF (${pensionUF.toFixed(2)} UF).`, fuente: N.vejezAnticipada.fuente };
    }
    const fallan = [!ok70 ? `pensión < 70% del promedio` : null, !ok12 ? `pensión < 12 UF` : null].filter(Boolean).join(' y ');
    return { id: 'anticipada', estado: 'warning', titulo: 'No califica para vejez anticipada', texto: `Se requieren ambas condiciones a la vez. Falla: ${fallan}.`, fuente: N.vejezAnticipada.fuente };
  };
  if (edadLegalOk === false) v.push(veredictoAnticipada());

  /* ---- ELD ---- */
  {
    if (pensionUF == null || promedio == null || pensionCLP == null) {
      v.push({ id: 'eld', estado: 'pendiente', titulo: 'Excedente de libre disposición (ELD)', texto: 'Falta pensión estimada y/o promedio de remuneraciones.', fuente: N.excedenteLibreDisposicion.fuente });
    } else {
      const ok70 = pensionCLP >= N.excedenteLibreDisposicion.pctPromedioMinimo * promedio;
      const ok12 = pensionUF >= N.excedenteLibreDisposicion.pensionMinUF;
       if (ok70 && ok12) {
        v.push({
          id: 'eld', estado: 'success',
          titulo: 'Probable derecho a ELD',
          texto: `La pensión estimada supera 70% del promedio y 12 UF. La AFP debe confirmar el monto retirable CON CÁLCULO OFICIAL antes de comprometer capital con la aseguradora (maestro §35).`,
          fuente: N.excedenteLibreDisposicion.fuente
        });
      } else {
        v.push({ id: 'eld', estado: 'info', titulo: 'Sin derecho evidente a ELD', texto: `La pensión estimada no supera a la vez el 70% del promedio y 12 UF.`, fuente: N.excedenteLibreDisposicion.fuente });
      }
    }
  }

  /* ---- Cónyuge: plazos de matrimonio (§15) ---- */
  const hayConyuge = beneficiarios.some((b) => b.tipo === 'conyuge' || b.tipo === 'conviviente')
    || ['casado', 'auc'].includes(p.estadoCivil);
  if (hayConyuge && parseLocal(p.fechaMatrimonio)) {
    const meses = mesesEntre(parseLocal(p.fechaMatrimonio), hoy());
    const exento = p.hijosComunes || p.embarazo;
    const requeridos = p.yaPensionado ? N.conyugePlazos.causantePensionadoAnios * 12 : N.conyugePlazos.causanteNoPensionadoMeses;
    if (exento) {
      v.push({ id: 'conyuge', estado: 'success', titulo: 'Cónyuge con derecho (excepción)', texto: `Plazo de matrimonio eximido por hijos comunes o embarazo.`, fuente: N.conyugePlazos.fuente });
    } else if (meses >= requeridos) {
      v.push({ id: 'conyuge', estado: 'success', titulo: `Cónyuge con derecho a sobrevivencia`, texto: `Matrimonio de ${meses} meses ≥ ${requeridos} meses exigidos (${p.yaPensionado ? 'causante ya pensionado: 3 años' : 'causante no pensionado: 6 meses'}).`, fuente: N.conyugePlazos.fuente });
    } else {
      v.push({ id: 'conyuge', estado: 'danger', titulo: 'Cónyuge aún sin derecho', texto: `Lleva ${meses} meses de ${requeridos} exigidos. Declarar el matrimonio correctamente antes de pedir ofertas SCOMP.`, fuente: N.conyugePlazos.fuente });
    }
  } else if (hayConyuge) {
    v.push({ id: 'conyuge', estado: 'pendiente', titulo: 'Plazos del cónyuge', texto: 'Registra la fecha de matrimonio/AUC en el perfil.', fuente: N.conyugePlazos.fuente });
  }

  /* ---- Beneficiarios declarados (§13-14) ---- */
  if (beneficiarios.length) {
    const resumen = beneficiarios.map((b) => NOMBRES_TIPO[b.tipo] || b.tipo).join(', ');
    v.push({ id: 'beneficiarios', estado: 'info', titulo: `${beneficiarios.length} beneficiario(s) declarado(s)`, texto: `${resumen}. El grupo familiar afecta la prima y las ofertas SCOMP.`, fuente: 'DL 3.500 — maestro §13' });
  } else {
    v.push({ id: 'beneficiarios', estado: 'warning', titulo: 'Sin beneficiarios declarados', texto: 'Si existen, deben declararse antes de pedir ofertas: cambian el cálculo de la pensión y las coberturas.', fuente: 'DL 3.500 — maestro §13' });
  }

  /* ---- Alertas de expediente ---- */
  if (s.bonoReconocimiento?.monto > 0 && s.bonoReconocimiento.estado === 'pendiente') {
    v.push({ id: 'bono', estado: 'warning', titulo: 'Bono de Reconocimiento sin liquidar/visar', texto: 'Puede afectar el plazo de emisión del Certificado de Saldo (10 días hábiles). Regularizar antes.', fuente: 'Spensiones — maestro §3-4' });
  }
  if (p.cotizacionesImpagas) {
    v.push({ id: 'impagas', estado: 'warning', titulo: 'Cotizaciones impagas', texto: 'Revisar y regularizar antes de emitir el Certificado de Saldo: no financian pensión si no se pagan.', fuente: 'maestro §41-42, §56' });
  }

  /* ---- Rutas y situaciones especiales (§30, §32, §50) ---- */
  if (p.trabajoPesado) {
    v.push({
      id: 'trabajo-pesado', estado: 'info',
      titulo: 'Trabajo pesado declarado',
      texto: 'Pensión anticipada por labores pesadas con reglas propias de años y descuento. Verificar el cálculo especial con la AFP (ruta distinta a la vejez común).',
      fuente: 'DL 3.500 — maestro §50'
    });
  }
  if (p.sigueTrabajando) {
    v.push({
      id: 'sigue-trabajando', estado: 'info',
      titulo: 'Pensionado que sigue trabajando',
      texto: 'Si cotiza después de pensionarse aplica la cotización adicional del empleador de la reforma (escalón gradual hacia 8,5 %). Confirmar tratamiento con la AFP/empleador.',
      fuente: 'Ley 21.735 — maestro §30-32'
    });
  }

  /* ---- Ley 21.818 (§16) ---- */
  v.push({
    id: 'ley21818', estado: 'info',
    titulo: 'Ley 21.818 vigente (sep-2026)',
    texto: 'Personas condenadas por delitos graves contra el causante (incl. violencia intrafamiliar) quedan excluidas de la pensión de sobrevivencia. La CMF regula el recálculo.',
    fuente: N.ley21818.fuente
  });

  return v;
}

export const NOMBRES_TIPO = {
  conyuge: 'cónyuge',
  conviviente: 'conviviente civil',
  hijo: 'hijo(a)',
  filiacion: 'padre/madre de hijo no matrimonial',
  padre_causante: 'padre/madre del causante (carga)'
};

/** % legal de sobrevivencia según beneficiario (maestro §14). */
export function pctSobrevivencia(b, hayHijosConDerecho) {
  const T = NORMATIVA.sobrevivenciaPct;
  switch (b.tipo) {
    case 'conyuge':
    case 'conviviente':
      return hayHijosConDerecho ? T.conyugeConHijosConDerecho : T.conyuge;
    case 'hijo': {
      const edad = edadExacta(b.fechaNacimiento)?.anios ?? null;
      if (b.invalidez === 'total') return T.hijoMenor18; // invalidez total conserva el mayor porcentaje aplicable
      if (edad != null && edad < 18) return T.hijoMenor18;
      if (b.estudiante && edad != null && edad < 24) return T.hijoEstudianteMenor24;
      if (b.invalidez === 'parcial' && edad != null && edad >= 24) return T.hijoInvalidoParcialMayor24;
      return 0;
    }
    case 'filiacion':
      return hayHijosConDerecho ? T.filiacionNoMatrimonialConHijos : T.filiacionNoMatrimonial;
    case 'padre_causante':
      return T.padresCarga;
    default: return 0;
  }
}
