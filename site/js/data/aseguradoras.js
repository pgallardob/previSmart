/* Public SCOMP participant-directory snapshot, verified 2026-10-09.
   This is not a price feed, solvency rating or authorization to issue offers. */
export const FUENTE_ASEGURADORAS = 'https://www.scomp.cl/participes.html';
export const ASEGURADORAS_BASE = [
  { id: 'bicevida', nombre: 'BiceVida Seguros S.A.', sitio: 'https://eligetuseguro.bicevida.cl/', alias: ['BICE VIDA', 'BICEVIDA'] },
  { id: 'confuturo', nombre: 'Confuturo Seguros S.A.', sitio: 'https://www.confuturo.cl/', alias: ['CONFUTURO'] },
  { id: 'sura', nombre: 'Sura Seguros S.A.', sitio: 'https://www.sura.cl/', alias: ['SURA', 'SEGUROS DE VIDA SURA'] },
  { id: 'pentavida', nombre: 'Pentavida Seguros S.A.', sitio: 'https://www.pentavida.cl/', alias: ['PENTA VIDA', 'PENTAVIDA'] },
  { id: 'rentanacional', nombre: 'Renta Nacional S.A.', sitio: 'https://retiro10rentasvitalicias.rentanacional.cl/', alias: ['RENTA NACIONAL'] },
  { id: '4life', nombre: '4Life Seguros S.A.', sitio: 'https://4lifeseguros.cl/', alias: ['4 LIFE SEGUROS', '4LIFE', '4 LIFE'] },
  { id: 'metlife', nombre: 'Metlife S.A.', sitio: 'https://w3.metlife.cl/', alias: ['METLIFE', 'METLIFE CHILE'] },
  { id: 'vidasecurity', nombre: 'Vida Security S.A.', sitio: 'https://www.vidasecurity.cl/', alias: ['VIDA SECURITY', 'SECURITY'] },
  { id: 'cnlife', nombre: 'cn Life S.A.', sitio: 'https://www.cnlife.cl/', alias: ['CN LIFE', 'CNLIFE'] },
  { id: 'euroamerica', nombre: 'Euroamerica S.A.', sitio: 'https://www.euroamerica.cl/', alias: ['EUROAMERICA', 'EUROAMÉRICA'] },
  { id: 'consorcio', nombre: 'Consorcio S.A.', sitio: 'https://web.consorcio.cl/', alias: ['CONSORCIO VIDA', 'CONSORCIO', 'CONSORCIO NACIONAL DE SEGUROS'] },
  { id: 'principal', nombre: 'Principal S.A.', sitio: 'https://www.principal.cl/', alias: ['PRINCIPAL', 'PRINCIPAL VIDA'] },
  { id: 'augustar', nombre: 'AuguStar Seguros de Vida', sitio: 'https://www.augustarseguros.cl/', alias: ['AUGUSTAR SEGUROS', 'AUGUSTAR'] }
];
export const DIRECTORIO_BASE = { fuente: FUENTE_ASEGURADORAS, consultadoEn: '2026-10-09', origen: 'copia-local', aseguradoras: ASEGURADORAS_BASE };
