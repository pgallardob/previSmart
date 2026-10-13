import { prepararAseguradoras } from '../core/preparacion-aseguradoras.js';
import { uf } from '../core/format.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderPreparacionAseguradoras(main, cliente) {
  const fichas = prepararAseguradoras(cliente);
  main.querySelector('#ofe-preparacion-aseguradoras').innerHTML = fichas.map((a) => {
    const comisiones = a.ofertasCliente.filter((o) => typeof o.comisionUF === 'number' && Number.isFinite(o.comisionUF) && o.comisionUF >= 0);
    return `<article class="card"><h3>${esc(a.nombre)}</h3><p class="small"><strong>Modalidades:</strong> ${esc(a.modalidades.join(' · '))}</p>
      <p class="small"><strong>Coberturas a revisar:</strong> ${esc(a.clausulas.join(' · '))}</p>
      <p class="small"><strong>Informe de riesgo:</strong> ${esc(a.riesgo.nota)} · ${esc(a.riesgo.agencia)} · ${esc(a.riesgo.fecha)} · ${esc(a.riesgo.perspectiva)}.</p>
      <p class="small">${esc(a.cautela)}</p><p class="small">${esc(a.distincion)}</p><p class="small">${esc(a.observacion)}</p>
      <p class="small"><strong>Situación del cliente:</strong> ${esc(a.estadoPrecio)}</p><p class="small"><strong>Costos:</strong> ${esc(a.costos)}</p>
      <p class="small"><strong>Comisiones registradas:</strong> ${comisiones.length ? comisiones.map((o) => esc(uf(o.comisionUF))).join(' · ') + '; cotejar la base y quién las paga' : 'No informadas; no se presume comisión cero'}</p>
      <p class="small">${esc(a.control)}</p><div class="u-flex u-gap-2 u-wrap">
        <a class="btn btn--secondary btn--sm" href="${esc(a.producto)}" target="_blank" rel="noopener noreferrer">Producto oficial</a>
        <a class="btn btn--secondary btn--sm" href="${esc(a.riesgo.url)}" target="_blank" rel="noopener noreferrer">Informe CMF</a>
        <a class="btn btn--secondary btn--sm" href="${esc(a.simulador)}" target="_blank" rel="noopener noreferrer">Sitio / simulador oficial</a></div>
      <p class="tiny muted">Fuentes consultadas ${esc(a.consultadoEn)}. Estos enlaces no envían datos del expediente automáticamente.</p></article>`;
  }).join('');
}
