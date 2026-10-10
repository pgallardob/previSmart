let activas = 0;
export function operacionesActivas() { return activas; }
export function iniciarOperacion() {
  activas++;
  let finalizada = false;
  return () => { if (!finalizada) { finalizada = true; activas--; } };
}
