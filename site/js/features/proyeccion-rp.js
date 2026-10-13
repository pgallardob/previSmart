import { getClienteActivo, guardarSeccion } from '../core/store.js';
import { huellaProyeccionRP } from '../core/proyeccion-rp.js';

const FIELDS = { 'proy-meses': 'proyMeses', 'proy-aporte': 'proyAporteCLP', 'proy-retorno': 'proyRetornoPct', 'proy-tasa': 'proyTasaRPpct' };
export function cablearProyeccionRP(main) {
  for (const id of [...Object.keys(FIELDS), 'proy-estudios', 'proy-confirmar']) main.querySelector(`#${id}`).addEventListener('change', (event) => {
    const c = getClienteActivo(); if (!c) return;
    if (event.target.id !== 'proy-confirmar') main.querySelector('#proy-confirmar').checked = false;
    const d = { ...c.sobrevivencia };
    for (const [id, key] of Object.entries(FIELDS)) {
      const value = main.querySelector(`#${id}`).value.trim();
      d[key] = value ? Number(key === 'proyAporteCLP' ? value.replace(/\./g, '').replace(',', '.') : value) : null;
    }
    d.proyHijosEstudiantes = main.querySelector('#proy-estudios').checked;
    d.proyConfirmado = main.querySelector('#proy-confirmar').checked;
    d.proyHuella = d.proyConfirmado ? huellaProyeccionRP({ ...c, sobrevivencia: d }) : null;
    guardarSeccion(c.id, 'sobrevivencia', d);
  });
}
export function poblarProyeccionRP(main, cliente) {
  for (const [id, key] of Object.entries(FIELDS)) main.querySelector(`#${id}`).value = cliente.sobrevivencia?.[key] ?? '';
  main.querySelector('#proy-estudios').checked = cliente.sobrevivencia?.proyHijosEstudiantes === true;
  main.querySelector('#proy-confirmar').checked = cliente.sobrevivencia?.proyConfirmado === true
    && cliente.sobrevivencia?.proyHuella === huellaProyeccionRP(cliente);
}
