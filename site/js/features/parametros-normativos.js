import { historialParametros, revisarPaqueteParametros, guardarPaqueteParametros, exportarHistorialParametros } from '../core/parametros-normativos.js';
import { parametrosIncluidos, obtenerTablaImpuesto, obtenerTasaRP } from '../data/normativa-2026.js';
import { getAsesor } from '../core/asesor.js';
import { operacionesActivas } from '../core/actividad.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const descripcion = (p) => p.tipo === 'impuesto-mensual'
  ? `Impuesto mensual ${p.periodo} · ocho tramos`
  : `Tasa RP ${(p.tasa * 100).toFixed(2)}% · ${p.desde} a ${p.hasta}`;
function download(text, name) {
  const link = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function iniciarParametros(main) {
  const file = main.querySelector('#aj-param-file'), status = main.querySelector('#aj-param-estado');
  const preview = main.querySelector('#aj-param-revision'), apply = main.querySelector('#aj-param-aplicar');
  let paquete = null, ticket = 0;
  const clear = () => { ticket++; paquete = null; preview.hidden = true; apply.disabled = true; main.querySelector('#aj-param-confirmar').checked = false; };
  const render = () => {
    const tax = obtenerTablaImpuesto(), rp = obtenerTasaRP(), history = historialParametros();
    main.querySelector('#aj-param-vigencia').textContent = [tax ? descripcion(tax) : 'Sin tabla tributaria revisada para el mes actual',
      rp ? descripcion(rp) : 'Sin tasa RP revisada para la fecha actual', history.error || `${history.registros.length} revisiones locales conservadas`].join(' · ');
    main.querySelector('#aj-param-historial').innerHTML = history.registros.length
      ? history.registros.map((r) => `<li>${esc(descripcion(r.parametro))} · ${esc(r.parametro.fuente)} · revisado ${esc(r.revisadoEn)} por ${esc(r.responsable)}</li>`).join('')
      : '<li>Se usan los parámetros incluidos en la aplicación cuando corresponde su período.</li>';
  };
  main.querySelector('#aj-param-responsable').value = getAsesor().nombre;
  main.querySelector('#aj-param-cargar').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    clear(); const current = ticket, selected = file.files?.[0]; file.value = '';
    if (!selected) return;
    try {
      if (selected.size > 65536) throw new Error('El archivo supera 64 KB.');
      const parsed = revisarPaqueteParametros(await selected.text());
      if (!main.isConnected || current !== ticket) return;
      paquete = parsed;
      main.querySelector('#aj-param-fuentes').innerHTML = parsed.parametros.map((p) =>
        `<li><strong>${esc(descripcion(p))}</strong><br>${esc(p.fuente)} · publicado ${esc(p.publicadoEn)}<br><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Cotejar fuente oficial</a></li>`).join('');
      main.querySelector('#aj-param-json').textContent = JSON.stringify(parsed, null, 2);
      preview.hidden = false; apply.disabled = false;
      status.textContent = 'Archivo leído, todavía no aplicado. Revisa los valores completos y su publicación oficial.';
    } catch (error) { if (main.isConnected && current === ticket) status.textContent = error.message; }
  });
  main.querySelector('#aj-param-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      if (!paquete) throw new Error('Carga primero un paquete para revisar.');
      if (operacionesActivas() > 0) throw new Error('Termina las operaciones activas antes de cambiar parámetros.');
      const result = guardarPaqueteParametros(paquete, { responsable: main.querySelector('#aj-param-responsable').value,
        confirmado: main.querySelector('#aj-param-confirmar').checked }, parametrosIncluidos());
      clear(); render(); status.textContent = `${result.agregados} parámetros incorporados. Al abrir las calculadoras se utilizará la revisión correspondiente a cada fecha; los expedientes no se modificaron.`;
    } catch (error) { status.textContent = error.message; }
  });
  main.querySelector('#aj-param-ejemplo').addEventListener('click', () => download(JSON.stringify({ schemaVersion: 1, parametros: parametrosIncluidos() }, null, 2), 'PreviSmart-parametros-incluidos.json'));
  main.querySelector('#aj-param-exportar').addEventListener('click', () => {
    try { download(exportarHistorialParametros(), 'PreviSmart-historial-parametros.json'); }
    catch (error) { status.textContent = error.message; }
  });
  const changed = (event) => { if (event.key === 'prevismart.parametros.v1') { clear(); render(); status.textContent = 'Los parámetros cambiaron en otra pestaña. Revisa de nuevo antes de aplicar.'; } };
  window.addEventListener('storage', changed); render();
  return () => { clear(); window.removeEventListener('storage', changed); };
}
