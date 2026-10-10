const KEY = 'prevismart.asesor.v1';
const CAMPOS = ['nombre', 'registro', 'email', 'telefono'];
export function getAsesor() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return Object.fromEntries(CAMPOS.map((campo) => [campo, typeof raw?.[campo] === 'string' ? raw[campo].slice(0, 200).trim() : '']));
  } catch { return Object.fromEntries(CAMPOS.map((campo) => [campo, ''])); }
}
export function guardarAsesor(datos) {
  const asesor = Object.fromEntries(CAMPOS.map((campo) => [campo, typeof datos?.[campo] === 'string' ? datos[campo].trim() : '']));
  if (!asesor.nombre || (!asesor.email && !asesor.telefono) || Object.values(asesor).some((v) => v.length > 200)) throw new Error('Indica el nombre del responsable y al menos un contacto, sin exceder 200 caracteres.');
  if (asesor.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asesor.email)) throw new Error('Correo del responsable inválido.');
  localStorage.setItem(KEY, JSON.stringify(asesor));
  return asesor;
}
export function contactoAsesor(asesor = getAsesor()) { return [asesor.email, asesor.telefono].filter(Boolean).join(' · '); }
