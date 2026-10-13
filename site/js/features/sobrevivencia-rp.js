import { getClienteActivo, guardarSeccion } from '../core/store.js';
import { huellaSobrevivenciaRP } from '../core/simulacion-sobrevivencia-rp.js';

const FIELDS = { 'srp-capital': 'srpCapitalCLP', 'srp-fecha': 'srpCapitalFecha', 'srp-referencia': 'srpReferencia',
  'srp-meses': 'srpMesesDevengados', 'srp-pension-causante': 'srpPensionCausanteCLP', 'srp-meses-hijo': 'srpMesesRestantesHijo' };
const NUMBERS = new Set(['srpCapitalCLP', 'srpMesesDevengados', 'srpPensionCausanteCLP', 'srpMesesRestantesHijo']);
const MONEY = new Set(['srpCapitalCLP', 'srpPensionCausanteCLP']);

export function cablearSobrevivenciaRP(main) {
  for (const id of [...Object.keys(FIELDS), 'srp-confirmar']) main.querySelector(`#${id}`).addEventListener('change', (event) => {
    const c = getClienteActivo(); if (!c) return;
    if (event.target.id !== 'srp-confirmar') main.querySelector('#srp-confirmar').checked = false;
    const d = { ...c.sobrevivencia };
    for (const [id, key] of Object.entries(FIELDS)) {
      const value = main.querySelector(`#${id}`).value.trim();
      d[key] = !value ? null : NUMBERS.has(key) ? Number(MONEY.has(key) ? value.replace(/\./g, '').replace(',', '.') : value) : value;
    }
    d.srpConfirmado = main.querySelector('#srp-confirmar').checked;
    d.srpHuella = d.srpConfirmado ? huellaSobrevivenciaRP({ ...c, sobrevivencia: d }) : null;
    guardarSeccion(c.id, 'sobrevivencia', d);
  });
}
export function poblarSobrevivenciaRP(main, cliente) {
  for (const [id, key] of Object.entries(FIELDS)) main.querySelector(`#${id}`).value = cliente.sobrevivencia?.[key] ?? '';
  main.querySelector('#srp-confirmar').checked = cliente.sobrevivencia?.srpConfirmado === true
    && cliente.sobrevivencia?.srpHuella === huellaSobrevivenciaRP(cliente);
}
