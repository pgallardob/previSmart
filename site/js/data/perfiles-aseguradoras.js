/* Public product facts and insurer-obligation ratings; not personal quotes or an exhaustive market ranking. */
export const REVISION_ASEGURADORAS = '2026-10-12';
export const PERFILES_ASEGURADORAS = [
  {
    id: 'bicevida', nombre: 'BICE Vida', razonSocial: 'BICE Vida Compañía de Seguros S.A.', rutCMF: '96656410',
    alias: ['BICE VIDA', 'BICEVIDA', 'BICE VIDA SEGUROS S.A.'],
    producto: 'https://www.bicevida.cl/rentas-vitalicias/renta-vitalicia-previsional',
    simulador: 'https://www.bicevida.cl/centro-de-ayuda/simulador-renta-vitalicia',
    modalidades: ['Inmediata', 'Temporal + diferida', 'Inmediata + retiro programado'],
    clausulas: ['Período garantizado', 'Aumento temporal', 'Aumento de sobrevivencia'],
    documentacion: 'Ficha y póliza disponibles desde la página del producto.',
    distincion: 'Cuota mortuoria de 15 UF publicada, sujeta al régimen y póliza; no es un pago concedido.',
    observacion: 'Absorbió Vida Security el 01/01/2026. No se cuentan como dos alternativas independientes; las ofertas históricas no se reescriben.',
    riesgo: { nota: 'AA+', perspectiva: 'Estable', agencia: "Moody's Local Chile", fecha: '2026-06-11',
      url: 'https://www.cmfchile.cl/institucional/estadisticas/resenas/resena_ver_archivo.php?archivo=aa_20260611.96656410.76188980',
      sha256: 'a76f7f0d26070f6476a10619deeb38566068ed1ceebf5ec1af3f108f9df55bcf' }
  },
  {
    id: 'confuturo', nombre: 'Confuturo', razonSocial: 'Compañía de Seguros Confuturo S.A.', rutCMF: '96571890',
    alias: ['CONFUTURO', 'CONFUTURO SEGUROS S.A.', 'COMPAÑÍA DE SEGUROS CONFUTURO S.A.'],
    producto: 'https://www.confuturo.cl/productos/rentas-vitalicias',
    simulador: 'https://simulatupension.confuturo.cl/',
    modalidades: ['Inmediata', 'Temporal + diferida', 'Inmediata + retiro programado'],
    clausulas: ['Período garantizado', 'Aumento temporal', 'Aumento de sobrevivencia'],
    documentacion: 'POL220150726/727; CAD220150728/729 y CAD220210212 enlazados en la página del producto.',
    distincion: 'Publica pólizas y cláusulas para revisar el pago al titular y a sus beneficiarios.',
    observacion: 'La clasificación corresponde a la aseguradora, no a Inversiones Confuturo ni a su holding.',
    riesgo: { nota: 'AA+', perspectiva: 'Estables', agencia: 'Feller Rate', fecha: '2026-01-08',
      url: 'https://www.cmfchile.cl/institucional/estadisticas/resenas/resena_ver_archivo.php?archivo=aa_20260108.96571890.79844680',
      sha256: '21a441a405aa59ec5e214dcb1cf7284d7a26b69cf2ad2cb013abc326706c2a47' }
  },
  {
    id: 'consorcio', nombre: 'Consorcio Vida', razonSocial: 'Compañía de Seguros de Vida Consorcio Nacional de Seguros S.A.', rutCMF: '99012000',
    alias: ['CONSORCIO', 'CONSORCIO VIDA', 'CONSORCIO S.A.', 'CONSORCIO NACIONAL DE SEGUROS'],
    producto: 'https://sitio.consorcio.cl/rentas-vitalicias',
    simulador: 'https://sitio.consorcio.cl/rentas-vitalicias',
    modalidades: ['Inmediata', 'Temporal + diferida', 'Inmediata + retiro programado'],
    clausulas: ['Aumento temporal', 'Período garantizado: revisar cobertura propuesta'],
    documentacion: 'Guía y alternativas publicadas en el producto; solicitar condiciones completas de la póliza.',
    distincion: 'Publica la alternativa de aumento temporal y sus etapas de pago.',
    observacion: 'Su página comercial muestra AA+, pero el informe CMF consultado de septiembre de 2026 informa AAA. No se usa la publicidad como clasificación fechada.',
    riesgo: { nota: 'AAA', perspectiva: 'Estable', agencia: "Moody's Local Chile", fecha: '2026-09-10',
      url: 'https://www.cmfchile.cl/institucional/estadisticas/resenas/resena_ver_archivo.php?archivo=aa_20260910.99012000.76188980',
      sha256: 'a51e4bacb4e1f79fb901893bf581ddf2c065be7ae4cd700e6e26a995e33d15f6' }
  }
];
