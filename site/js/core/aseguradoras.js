import { DIRECTORIO_BASE } from '../data/aseguradoras.js';
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/s\.?\s*a\.?\s*$/i, '').replace(/[^a-z0-9]/g, '');

/** Cross-reference identity only. Never supply premiums, rates or ratings from a directory. */
export function cruzarAseguradoras(ofertas, directorio = DIRECTORIO_BASE) {
  return ofertas.map((oferta) => {
    const nombre = normalizar(oferta.aseguradora);
    const coincidencias = directorio.aseguradoras.filter((a) => [a.nombre, ...(a.alias || [])].some((n) => normalizar(n) === nombre));
    const entidad = coincidencias.length === 1 ? coincidencias[0] : null;
    return { ...oferta, cruceAseguradora: {
      estado: entidad ? 'coincide-directorio' : coincidencias.length > 1 ? 'ambiguo' : 'sin-coincidencia',
      id: entidad?.id || null, nombre: entidad?.nombre || null, sitio: entidad?.sitio || null,
      fuente: directorio.fuente, consultadoEn: directorio.consultadoEn, origen: directorio.origen
    } };
  });
}
