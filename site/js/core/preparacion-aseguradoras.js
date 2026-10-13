import { PERFILES_ASEGURADORAS, REVISION_ASEGURADORAS } from '../data/perfiles-aseguradoras.js';
import { clienteParaPropuesta } from './consolidacion-scomp.js';

const nombre = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Available before SCOMP: public facts are separate from each client's supplied price and commission. */
export function prepararAseguradoras(cliente) {
  const ofertas = clienteParaPropuesta(cliente)?.ofertas || [];
  return PERFILES_ASEGURADORAS.map((p) => {
    const aliases = [p.nombre, p.razonSocial, ...p.alias].map(nombre);
    const propias = ofertas.filter((o) => aliases.includes(nombre(o.aseguradora)));
    return { ...p, consultadoEn: REVISION_ASEGURADORAS, ofertasCliente: propias,
      estadoPrecio: propias.length ? `${propias.length} oferta(s) registradas para este cliente; cotejar fuente y vigencia`
        : 'Ficha preparatoria disponible; sin precio personalizado registrado',
      costos: 'No se publica un arancel individual de prima/pensión en la página de producto consultada. No significa costo cero. Cuantificar comisión, prima y cargos con la propuesta recibida.',
      control: 'Pedir el mismo capital, modalidad, beneficiarios, garantía y aumento temporal a cada compañía; comparar bruto, líquido y etapas de pago.',
      cautela: 'Clasificación del informe consultado: no garantiza una pensión ni equivale a una recomendación o a verificar la clasificación vigente hoy.' };
  });
}
