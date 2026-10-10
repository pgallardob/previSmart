/* PreviSmart · checklist.js — checklist documental y de preguntas.
   Contenido literal del maestro §41 (carpeta), §42 (pedir a la AFP),
   §43 (pedir a la aseguradora), §44 (familia) y §56 (errores comunes). */

export const CHECKLIST_GRUPOS = [
  {
    id: 'carpeta', titulo: 'Carpeta documental', icono: 'i-folder', fuente: 'maestro §41',
    items: [
      { id: 'cedula', texto: 'Cédula vigente', cat: 'Identidad' },
      { id: 'nacimiento', texto: 'Certificado de nacimiento', cat: 'Identidad' },
      { id: 'matrimonio', texto: 'Certificado de matrimonio', cat: 'Estado civil' },
      { id: 'auc', texto: 'Certificado de Acuerdo de Unión Civil', cat: 'Estado civil' },
      { id: 'divorcio', texto: 'Antecedentes de divorcio/nulidad, si corresponde', cat: 'Estado civil' },
      { id: 'mat-anteriores', texto: 'Información sobre eventuales matrimonios anteriores', cat: 'Estado civil' },
      { id: 'nac-hijos', texto: 'Certificados de nacimiento de hijos', cat: 'Hijos' },
      { id: 'estudios', texto: 'Situación de estudios de hijos', cat: 'Hijos' },
      { id: 'invalidez', texto: 'Antecedentes de invalidez cuando corresponda', cat: 'Hijos' },
      { id: 'cartola', texto: 'Última cartola AFP', cat: 'AFP' },
      { id: 'saldo', texto: 'Saldo actual', cat: 'AFP' },
      { id: 'fondo', texto: 'Fondo en que está invertido', cat: 'AFP' },
      { id: 'cot-recientes', texto: 'Cotizaciones recientes', cat: 'AFP' },
      { id: 'cot-impagas', texto: 'Cotizaciones impagas', cat: 'AFP' },
      { id: 'rezagos', texto: 'Rezagos', cat: 'AFP' },
      { id: 'bono-recon', texto: 'Bono de Reconocimiento', cat: 'AFP' },
      { id: 'bono-hijo', texto: 'Bono por Hijo', cat: 'AFP' },
      { id: 'apv', texto: 'APV', cat: 'AFP' },
      { id: 'dep-conv', texto: 'Depósitos convenidos', cat: 'AFP' },
      { id: 'cot-vol', texto: 'Cotizaciones voluntarias', cat: 'AFP' },
      { id: 'cuenta2', texto: 'Cuenta 2', cat: 'AFP' },
      { id: 'remuneraciones', texto: 'Remuneraciones', cat: 'Laboral' },
      { id: 'historia-cot', texto: 'Historia de cotizaciones', cat: 'Laboral' },
      { id: 'empleadores', texto: 'Empleadores', cat: 'Laboral' },
      { id: 'sin-cotizar', texto: 'Períodos sin cotizar', cat: 'Laboral' },
      { id: 'ips', texto: 'Pensiones IPS', cat: 'Otros sistemas' },
      { id: 'sobrev', texto: 'Pensiones de sobrevivencia', cat: 'Otros sistemas' },
      { id: 'capredena', texto: 'Capredena', cat: 'Otros sistemas' },
      { id: 'dipreca', texto: 'Dipreca', cat: 'Otros sistemas' },
      { id: 'mutualidades', texto: 'Mutualidades', cat: 'Otros sistemas' },
      { id: 'accidente', texto: 'Accidentes del trabajo', cat: 'Otros sistemas' },
      { id: 'extranjera', texto: 'Pensiones extranjeras', cat: 'Otros sistemas' },
      { id: 'pgu', texto: 'PGU', cat: 'Beneficios' },
      { id: 'seg-social', texto: 'Beneficios del Seguro Social', cat: 'Beneficios' },
      { id: 'bac', texto: 'BAC', cat: 'Beneficios' },
      { id: 'cev', texto: 'CEV', cat: 'Beneficios' },
      { id: 'garantia', texto: 'Eventual Garantía Estatal', cat: 'Beneficios' }
    ]
  },
  {
    id: 'afp', titulo: 'Pedir por escrito a la AFP', icono: 'i-building-2', fuente: 'maestro §42',
    items: [
      { id: 'a-saldo-total', texto: 'Saldo total para pensión' },
      { id: 'a-saldo-oblig', texto: 'Saldo obligatorio' },
      { id: 'a-apv', texto: 'APV' },
      { id: 'a-dep-conv', texto: 'Depósitos convenidos' },
      { id: 'a-cot-vol', texto: 'Cotizaciones voluntarias' },
      { id: 'a-bono-recon', texto: 'Bono de Reconocimiento' },
      { id: 'a-bono-hijo', texto: 'Bono por Hijo' },
      { id: 'a-otros-bonos', texto: 'Otros bonos' },
      { id: 'a-beneficiarios', texto: 'Beneficiarios reconocidos' },
      { id: 'a-pension-rp', texto: 'Pensión estimada en retiro programado' },
      { id: 'a-pension-rv', texto: 'Pensión estimada en renta vitalicia' },
      { id: 'a-anticipada', texto: 'Derecho a vejez anticipada' },
      { id: 'a-eld', texto: 'Derecho a excedente de libre disposición' },
      { id: 'a-pgu', texto: 'Derecho potencial a PGU' },
      { id: 'a-bac', texto: 'Derecho potencial a BAC' },
      { id: 'a-cev', texto: 'Derecho potencial a CEV si es mujer' },
      { id: 'a-impagas', texto: 'Existencia de cotizaciones impagas' },
      { id: 'a-posteriores', texto: 'Eventuales cotizaciones posteriores a la solicitud' },
      { id: 'a-fechas-cert', texto: 'Fecha de emisión y vencimiento del Certificado de Saldo' }
    ]
  },
  {
    id: 'aseguradora', titulo: 'Pedir a la compañía de seguros', icono: 'i-shield-check', fuente: 'maestro §43 — no basta preguntar “¿cuánto me paga?”',
    items: [
      { id: 's-nombre', texto: 'Nombre exacto de la compañía' },
      { id: 's-clasif', texto: 'Clasificación de riesgo' },
      { id: 's-renta', texto: 'Renta mensual' },
      { id: 's-moneda', texto: 'Moneda / UF' },
      { id: 's-inicio', texto: 'Fecha de inicio' },
      { id: 's-prima', texto: 'Prima única' },
      { id: 's-comision', texto: 'Comisión' },
      { id: 's-condiciones', texto: 'Condiciones especiales' },
      { id: 's-perg', texto: 'Período garantizado' },
      { id: 's-pct-sobrev', texto: 'Porcentaje de sobrevivencia' },
      { id: 's-beneficiarios', texto: 'Beneficiarios considerados' },
      { id: 's-nuevos-benef', texto: 'Tratamiento de nuevos beneficiarios' },
      { id: 's-divorcio', texto: 'Tratamiento de divorcio' },
      { id: 's-fallecimiento', texto: 'Tratamiento de fallecimiento' },
      { id: 's-mortuoria', texto: 'Cuota mortuoria' },
      { id: 's-clausulas', texto: 'Cláusulas adicionales' },
      { id: 's-aumento', texto: 'Posibilidad de aumento diferido' },
      { id: 's-adelanto', texto: 'Condiciones para adelantar aumentos' },
      { id: 's-tributacion', texto: 'Tributación' },
      { id: 's-salud', texto: 'Descuentos de salud' },
      { id: 's-reclamos', texto: 'Procedimiento de reclamos' },
      { id: 's-poliza', texto: 'Condiciones de la póliza' },
      { id: 's-garantias', texto: 'Garantías estatales aplicables' },
      { id: 's-docs', texto: 'Documentación contractual completa' }
    ]
  },
  {
    id: 'familia', titulo: 'Preguntas sobre la familia (antes de SCOMP)', icono: 'i-users', fuente: 'maestro §44',
    items: [
      { id: 'f-quienes', texto: '¿Quiénes son legalmente mis beneficiarios de sobrevivencia?' },
      { id: 'f-cambio', texto: '¿Cómo cambia la pensión si se considera a cada uno de ellos?' }
    ]
  }
];

/* Errores comunes a evitar (maestro §56) — se muestran como advertencias */
export const ERRORES_COMUNES = [
  'No pedir pensión neta ni pensiones de sobrevivencia',
  'No revisar períodos garantizados',
  'No revisar aumento diferido',
  'No revisar incrementos de sobrevivencia',
  'No comprobar el Bono de Reconocimiento',
  'No preguntar por BAC/CEV',
  'Asumir que la PGU es automática',
  'Asumir que toda la renta vitalicia es heredable',
  'Asumir que la garantía estatal cubre cualquier monto',
  'Desconocer las comisiones',
  'Firmar sin leer las condiciones especiales',
  'Confiar en una simulación no oficial',
  'Confundir una oferta SCOMP con una recomendación personalizada'
];
