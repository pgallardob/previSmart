/* PreviSmart · modulos.js — registro único de módulos/vistas.
   Fuente de verdad para navegación, router y panel.
   estado: 'listo' (implementado) | 'fase' (planificado, muestra pantalla pendiente) */

export const GRUPOS = [
  { id: 'proceso', nombre: 'Proceso' },
  { id: 'calculo', nombre: 'Cálculo' },
  { id: 'decision', nombre: 'Decisión' },
  { id: 'referencia', nombre: 'Referencia' }
];

export const MODULOS = [
  {
    id: 'panel', nombre: 'Panel', icono: 'i-layout-dashboard', grupo: 'proceso',
    estado: 'listo', fase: 2,
    desc: 'UF del día, cartera de clientes y estado del proceso.',
    tabbar: true
  },
  {
    id: 'perfil', nombre: 'Perfil del cliente', icono: 'i-user-round', grupo: 'proceso',
    estado: 'listo', fase: 4,
    desc: 'Datos personales, beneficiarios, saldos y antecedentes laborales.',
    tabbar: true
  },
  {
    id: 'captura', nombre: 'Captura de datos', icono: 'i-download', grupo: 'proceso',
    estado: 'listo', fase: 11,
    desc: 'Conexión AFP vía RPA local y carga de documentos oficiales (respaldo legal).'
  },
  {
    id: 'elegibilidad', nombre: 'Elegibilidad', icono: 'i-badge-check', grupo: 'proceso',
    estado: 'listo', fase: 4,
    desc: 'Edad legal, vejez anticipada, mínimo 2 UF y excedente de libre disposición.'
  },
  {
    id: 'ruta', nombre: 'Ruta del proceso', icono: 'i-route', grupo: 'proceso',
    estado: 'listo', fase: 8,
    desc: 'Las 7 etapas y los 25 pasos, con plazos y vigencias.'
  },
  {
    id: 'checklist', nombre: 'Checklist', icono: 'i-clipboard-check', grupo: 'proceso',
    estado: 'listo', fase: 8,
    desc: 'Documentos, preguntas para la AFP y la aseguradora, y las 10 comprobaciones.',
    tabbar: true
  },
  {
    id: 'beneficios', nombre: 'Beneficios estatales', icono: 'i-landmark', grupo: 'calculo',
    estado: 'listo', fase: 5,
    desc: 'PGU, BAC, CEV, garantía estatal y cuota mortuoria.'
  },
  {
    id: 'liquida', nombre: 'Pensión líquida', icono: 'i-calculator', grupo: 'calculo',
    estado: 'listo', fase: 7,
    desc: 'De renta bruta en UF a pesos líquidos: salud e impuesto único.'
  },
  {
    id: 'sobrevivencia', nombre: 'Sobrevivencia', icono: 'i-heart-handshake', grupo: 'calculo',
    estado: 'listo', fase: 7,
    desc: 'Escenarios de fallecimiento, período garantizado e incrementos.'
  },
  {
    id: 'modalidades', nombre: 'Modalidades', icono: 'i-scale', grupo: 'decision',
    estado: 'listo', fase: 6,
    desc: 'Retiro programado, renta vitalicia inmediata y combinadas.'
  },
  {
    id: 'ofertas', nombre: 'Ofertas SCOMP', icono: 'i-table', grupo: 'decision',
    estado: 'listo', fase: 6,
    desc: 'Matriz multi-criterio para comparar contratos completos.',
    tabbar: true
  },
  {
    id: 'reporte', nombre: 'Reporte', icono: 'i-file-text', grupo: 'decision',
    estado: 'listo', fase: 9,
    desc: 'Resumen imprimible para la AFP o el asesor.'
  },
  {
    id: 'glosario', nombre: 'Glosario y fuentes', icono: 'i-book-open', grupo: 'referencia',
    estado: 'listo', fase: 9,
    desc: 'Cada concepto explicado con su fuente oficial.'
  },
  {
    id: 'guia-estilos', nombre: 'Guía de estilos', icono: 'i-palette', grupo: 'referencia',
    estado: 'listo', fase: 2,
    desc: 'Design system vivo: componentes y tokens en todos sus estados.'
  },
  {
    id: 'ajustes', nombre: 'Ajustes', icono: 'i-settings', grupo: 'referencia',
    estado: 'listo', fase: 10,
    desc: 'Tema, valor UF manual, respaldo de datos y acerca de.'
  }
];

export const TABBAR_MAX = 4; // + botón "Más"

export function moduloPorId(id) {
  return MODULOS.find((m) => m.id === id) || null;
}

export function modulosPorGrupo() {
  return GRUPOS.map((g) => ({
    ...g,
    modulos: MODULOS.filter((m) => m.grupo === g.id)
  }));
}
