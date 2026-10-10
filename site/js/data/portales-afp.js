/* Public AFP websites listed by SCOMP; no private endpoints or credentials. */
export const PORTALES_AFP = Object.freeze([
  { id: 'capital', nombre: 'Capital', url: 'https://home.afpcapital.cl/' },
  { id: 'cuprum', nombre: 'Cuprum', url: 'https://www.cuprum.cl/' },
  { id: 'planvital', nombre: 'Planvital', url: 'https://planvital.cl/afiliado/inicio' },
  { id: 'modelo', nombre: 'Modelo', url: 'https://www.afpmodelo.cl/' },
  { id: 'habitat', nombre: 'Habitat', url: 'https://www.afphabitat.cl/' },
  { id: 'provida', nombre: 'Provida', url: 'https://www.provida.cl/' },
  { id: 'uno', nombre: 'Uno', url: 'https://www.uno.cl/' }
]);

export function portalAFP(nombre) {
  const id = String(nombre || '').toLowerCase().replace(/\bafp\b/g, '').replace(/\s/g, '');
  return PORTALES_AFP.find((p) => p.id === id) || null;
}
