/* PreviSmart · ruta.js — las 7 etapas del proceso (maestro §40)
   con los 25 pasos de la secuencia recomendada (maestro §57)
   asignados a cada una, y los plazos legales que las gobiernan. */

export const ETAPAS = [
  {
    id: 'preparacion', num: 1, nombre: 'Preparación',
    desc: 'Reunir la carpeta completa antes de pedir nada: identidad, familia, AFP, laboral, otros sistemas y beneficios.',
    plazo: null,
    pasos: [
      'Pedir a la AFP una revisión completa del expediente previsional',
      'Verificar beneficiarios',
      'Verificar saldo',
      'Verificar Bono de Reconocimiento',
      'Verificar APV y depósitos convenidos',
      'Verificar cotizaciones impagas',
      'Determinar si existe excedente de libre disposición',
      'Determinar si corresponde BAC',
      'Determinar si corresponde CEV',
      'Determinar PGU potencial'
    ]
  },
  {
    id: 'solicitud', num: 2, nombre: 'Solicitud AFP',
    desc: 'Solicitar formalmente la pensión a la AFP.',
    plazo: null,
    pasos: ['Emitir Certificado de Saldo'],
    acciones: ['Solicitar formalmente la pensión ante la AFP']
  },
  {
    id: 'certificado', num: 3, nombre: 'Certificado de Saldo',
    desc: 'La AFP emite el certificado con el saldo y la composición del capital.',
    plazo: { texto: 'La AFP tiene normalmente hasta 10 días hábiles para emitirlo; el certificado vence a los 35 días corridos. Puede variar según el estado del Bono de Reconocimiento.', tipo: 'mixto' },
    pasos: [],
    acciones: [
      'Registrar fecha de emisión del certificado',
      'Verificar que el saldo y la composición sean correctos',
      'Registrar la fecha de vencimiento (35 días corridos)'
    ]
  },
  {
    id: 'scomp', num: 4, nombre: 'SCOMP',
    desc: 'Se solicitan las ofertas a las compañías de seguros participantes.',
    plazo: { texto: 'Máximo 3 consultas por certificado. Solo ofertas internas (las externas se eliminaron en sep-2025).', tipo: 'consultas' },
    pasos: ['Entrar a SCOMP'],
    acciones: ['Registrar fecha de solicitud de ofertas']
  },
  {
    id: 'ofertas', num: 5, nombre: 'Certificado de Ofertas',
    desc: 'Debe analizarse dentro de su período de vigencia.',
    plazo: { texto: 'Las ofertas internas tienen vigencia de 12 días hábiles.', tipo: 'habiles' },
    pasos: [
      'Solicitar renta vitalicia simple',
      'Solicitar renta vitalicia con las condiciones de sobrevivencia que interesen',
      'Solicitar, cuando proceda, alternativas de renta vitalicia diferida'
    ]
  },
  {
    id: 'decision', num: 6, nombre: 'Decisión',
    desc: 'Se selecciona aseguradora, modalidad, renta y condiciones especiales — comparando contratos completos, no solo el monto.',
    plazo: null,
    pasos: [
      'Comparar las ofertas',
      'Analizar solvencia de las compañías (mínimo BBB)',
      'Calcular pensión líquida',
      'Calcular escenario de fallecimiento temprano',
      'Calcular escenario de larga longevidad',
      'Calcular situación del cónyuge e hijos',
      'Revisar PGU / BAC / CEV',
      'Revisar comisiones'
    ]
  },
  {
    id: 'aceptacion', num: 7, nombre: 'Aceptación',
    desc: 'Se firma la documentación correspondiente ante la entidad habilitada. La renta vitalicia es irrevocable: este es el punto de no retorno.',
    plazo: null,
    pasos: [
      'Revisar contrato definitivo',
      'Sólo entonces aceptar'
    ]
  }
];

/* Las 10 comprobaciones antes de firmar (maestro §60) */
export const COMPROBACIONES_FINALES = [
  '¿Cuál es exactamente mi saldo de pensión?',
  '¿Quiénes son mis beneficiarios legales?',
  '¿Cuánto me ofrecen en renta vitalicia simple?',
  '¿Cuánto me ofrecen con período garantizado?',
  '¿Cuánto recibiría mi cónyuge/hijos si fallezco?',
  '¿Tengo derecho a excedente de libre disposición?',
  '¿Tengo derecho a PGU?',
  '¿Tengo derecho al Beneficio por Años Cotizados?',
  'Si soy mujer, ¿tengo derecho a CEV y cuánto?',
  '¿Qué recibo realmente después de salud e impuestos y qué ocurre si fallezco prematuramente?'
];
