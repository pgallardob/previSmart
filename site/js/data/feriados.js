/* PreviSmart · feriados.js — feriados Chile 2026-2027.
   Fuente: calendario oficial de feriados (api.boostr.cl, que replica el
   listado de feriados legales). Usados para el cálculo de DÍAS HÁBILES
   (SCOMP: vigencia de ofertas, emisión de Certificado de Saldo).
   Nota: las elecciones caen en fin de semana en 2026-2027 y no alteran
   los días hábiles. Actualizar este archivo anualmente. */

export const FERIADOS = [
  // 2026
  { fecha: '2026-01-01', nombre: 'Año Nuevo' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo' },
  { fecha: '2026-04-04', nombre: 'Sábado Santo' },
  { fecha: '2026-05-01', nombre: 'Día Nacional del Trabajo' },
  { fecha: '2026-05-21', nombre: 'Día de las Glorias Navales' },
  { fecha: '2026-06-21', nombre: 'Día Nacional de los Pueblos Indígenas' },
  { fecha: '2026-06-29', nombre: 'San Pedro y San Pablo' },
  { fecha: '2026-07-16', nombre: 'Día de la Virgen del Carmen' },
  { fecha: '2026-08-15', nombre: 'Asunción de la Virgen' },
  { fecha: '2026-09-18', nombre: 'Independencia Nacional' },
  { fecha: '2026-09-19', nombre: 'Día de las Glorias del Ejército' },
  { fecha: '2026-10-12', nombre: 'Encuentro de Dos Mundos' },
  { fecha: '2026-10-31', nombre: 'Día de las Iglesias Evangélicas y Protestantes' },
  { fecha: '2026-11-01', nombre: 'Día de Todos los Santos' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
  // 2027
  { fecha: '2027-01-01', nombre: 'Año Nuevo' },
  { fecha: '2027-03-26', nombre: 'Viernes Santo' },
  { fecha: '2027-03-27', nombre: 'Sábado Santo' },
  { fecha: '2027-05-01', nombre: 'Día Nacional del Trabajo' },
  { fecha: '2027-05-21', nombre: 'Día de las Glorias Navales' },
  { fecha: '2027-06-21', nombre: 'Día Nacional de los Pueblos Indígenas' },
  { fecha: '2027-06-28', nombre: 'San Pedro y San Pablo' },
  { fecha: '2027-07-16', nombre: 'Día de la Virgen del Carmen' },
  { fecha: '2027-08-15', nombre: 'Asunción de la Virgen' },
  { fecha: '2027-09-17', nombre: 'Feriado Adicional Fiestas Patrias' },
  { fecha: '2027-09-18', nombre: 'Independencia Nacional' },
  { fecha: '2027-09-19', nombre: 'Día de las Glorias del Ejército' },
  { fecha: '2027-10-11', nombre: 'Encuentro de Dos Mundos' },
  { fecha: '2027-10-31', nombre: 'Día de las Iglesias Evangélicas y Protestantes' },
  { fecha: '2027-11-01', nombre: 'Día de Todos los Santos' },
  { fecha: '2027-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2027-12-25', nombre: 'Navidad' }
];

export const FERIADOS_SET = new Set(FERIADOS.map((f) => f.fecha));
