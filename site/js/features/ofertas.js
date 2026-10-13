/* PreviSmart · ofertas.js (feature) — matriz comparativa SCOMP. */

import { getClienteActivo, guardarSeccion, subscribe, getCliente, actualizarExpediente } from '../core/store.js';
import { consultarAseguradoras } from '../core/integracion.js';
import { cruzarAseguradoras } from '../core/aseguradoras.js';
import { DIRECTORIO_BASE } from '../data/aseguradoras.js';
import { getUF, onUF } from '../core/uf.js';
import { clp, uf, fechaCorta } from '../core/format.js';
import { evaluarOferta, ordenarOfertas, mejores } from '../core/ofertas.js';
import { diferenciasAnuales } from '../core/calculos.js';
import { pensionLiquida } from '../core/liquida.js';
import { evaluarBeneficios } from '../core/beneficios.js';
import { abrirDialog, cerrarDialog, cablearCierre } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { crearPropuesta } from '../core/propuesta.js';
import { iniciarDescargaCalculos } from './informe-calculos.js';
import { cablearConsolidacion, renderConsolidacion } from './consolidacion-scomp.js';
import { renderPreparacionAseguradoras } from './preparacion-aseguradoras.js';

const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

let unsub = null, unsubUF = null;

export function init(main) {
  if (unsub) { unsub(); unsub = null; }
  if (unsubUF) { unsubUF(); unsubUF = null; }
  cablearCierre(main.querySelector('#dlg-oferta'));
  cablearCierre(main.querySelector('#dlg-ofe-confirmar'));
  cablear(main);
  cablearConsolidacion(main);
  render(main);
  const limpiarPDF = iniciarDescargaCalculos(main, 'ofe');
  unsub = subscribe(() => render(main));
  unsubUF = onUF(() => render(main));
  main.querySelector('#ofe-directorio-actualizar')?.addEventListener('click', () => cargarDirectorio(main));
  cargarDirectorio(main);
  return () => { unsub?.(); unsubUF?.(); limpiarPDF(); };
}

async function cargarDirectorio(main) {
  const clienteId = getClienteActivo()?.id;
  const button = main.querySelector('#ofe-directorio-actualizar');
  if (button?.disabled) return;
  if (button) button.disabled = true;
  let directorio;
  try { directorio = await consultarAseguradoras(); }
  catch { directorio = { ...DIRECTORIO_BASE, advertencia: 'Servicio RPA o fuente en línea no disponibles; se usa la copia local fechada.' }; }
  if (!main.isConnected) return;
  const estado = main.querySelector('#ofe-directorio-estado');
  if (estado) estado.textContent = `${directorio.aseguradoras.length} entidades · ${directorio.origen === 'en-linea' ? 'en línea' : 'copia local'} · ${directorio.consultadoEn}. ${directorio.advertencia || 'Cruce nominal, no certificación de solvencia ni emisión de ofertas.'}`;
  const lista = main.querySelector('#ofe-aseguradoras-lista');
  if (lista) lista.innerHTML = directorio.aseguradoras.map((a) => `<option value="${esc(a.nombre)}"></option>`).join('');
  const cliente = getCliente(clienteId);
  if (cliente?.ofertas?.length && getClienteActivo()?.id === clienteId) {
    const ofertas = cruzarAseguradoras(cliente.ofertas, directorio);
    if (JSON.stringify(ofertas) !== JSON.stringify(cliente.ofertas)) {
      try { actualizarExpediente(clienteId, { ofertas }); }
      catch (error) { toast(error.message, 'danger'); }
    }
  }
  if (button) button.disabled = false;
}

function cablear(main) {
  const dlg = main.querySelector('#dlg-oferta');
  const form = main.querySelector('#form-oferta');
  const dlgConf = main.querySelector('#dlg-ofe-confirmar');
  let confirmarAccion = null;

  main.querySelector('#btn-nueva-oferta')?.addEventListener('click', () => abrirOferta(main, null));
  main.querySelector('#ofe-orden')?.addEventListener('change', () => render(main));

  main.querySelector('#btn-ver-propuesta')?.addEventListener('click', () => {
    const preview = main.querySelector('#ofe-print');
    preview.focus({ preventScroll: true });
    preview.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  main.querySelector('#btn-imprimir-ofertas')?.addEventListener('click', () => {
    if (!getClienteActivo() || !main.querySelector('#ofe-print .propuesta')) { toast('Selecciona un cliente y revisa su propuesta antes de imprimir.', 'warning'); return; }
    document.body.classList.add('impresion-ofertas');
    window.addEventListener('afterprint', () => document.body.classList.remove('impresion-ofertas'), { once: true });
    window.print();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const cliente = getClienteActivo();
    if (!cliente) return;
    const idx = form.querySelector('#ofe-idx').value;
    const anterior = idx !== '' ? cliente.ofertas[Number(idx)] : null;
    const f = new FormData(form);
    const o = {
      ...(anterior || {}),
      aseguradora: String(f.get('aseguradora') || '').trim(),
      clasificacion: f.get('clasificacion') || null,
      pensionUF: num(f.get('pensionUF')),
      primaUF: num(f.get('primaUF')),
      periodoGarantizadoAnios: Number(f.get('periodoGarantizadoAnios')) || 0,
      incrementoConyugeUF: num(f.get('incrementoConyugeUF')) || null,
      sobrevConyugePct: Number(f.get('sobrevConyugePct')) || null,
      sobrevHijosPct: Number(f.get('sobrevHijosPct')) || null,
      cuotaMortuoriaUF: num(f.get('cuotaMortuoriaUF')) || null,
      aumentoDiferidoMes: Number(f.get('aumentoDiferidoMes')) || null,
      aumentoDiferidoPct: Number(f.get('aumentoDiferidoPct')) || null,
      comisionUF: num(f.get('comisionUF')) || null,
      codigoOferta: String(f.get('codigoOferta') || '').trim() || null,
      tasaDescuentoPct: Number(f.get('tasaDescuentoPct')) || null,
      aumentoTemporalPct: Number(f.get('aumentoTemporalPct')) || null,
      aumentoTemporalMeses: Number(f.get('aumentoTemporalMeses')) || null,
      ofertaBruta: Boolean(f.get('ofertaBruta')),
      adelantable: Boolean(f.get('adelantable')),
      notas: String(f.get('notas') || ''),
      fuente: anterior ? 'edicion-manual' : 'manual'
    };
    if (anterior?.aseguradora !== o.aseguradora) o.cruceAseguradora = cruzarAseguradoras([o])[0].cruceAseguradora;
    const lista = [...(getCliente(cliente.id).ofertas || [])];
    if (idx !== '') lista[Number(idx)] = o; else lista.push(o);
    guardarSeccion(cliente.id, 'ofertas', lista);
    cerrarDialog(dlg);
    toast('Oferta guardada', 'success');
  });

  const accionOferta = (e) => {
    const btn = e.target.closest('[data-acc]');
    if (!btn) return;
    const idx = Number(e.target.closest('[data-idx]')?.dataset.idx);
    const cliente = getClienteActivo();
    if (!cliente) return;
    const lista = [...(cliente.ofertas || [])];
    if (btn.dataset.acc === 'editar') abrirOferta(main, idx);
    if (btn.dataset.acc === 'eliminar') {
      main.querySelector('#ofe-conf-texto').textContent =
        `Se eliminará la oferta de “${lista[idx]?.aseguradora}”.`;
      confirmarAccion = () => { lista.splice(idx, 1); guardarSeccion(cliente.id, 'ofertas', lista); toast('Oferta eliminada', 'info'); };
      abrirDialog(dlgConf);
    }
  };
  main.querySelector('#ofe-filas')?.addEventListener('click', accionOferta);
  main.querySelector('#ofe-cards')?.addEventListener('click', accionOferta);

  main.querySelector('#ofe-conf-si')?.addEventListener('click', () => {
    confirmarAccion?.();
    confirmarAccion = null;
    cerrarDialog(dlgConf);
  });
}

function abrirOferta(main, idx) {
  const cliente = getClienteActivo();
  if (!cliente) return;
  const form = main.querySelector('#form-oferta');
  const o = idx != null ? cliente.ofertas[idx] : null;
  form.querySelector('#ofe-idx').value = idx ?? '';
  for (const el of form.elements) {
    if (!el.name || el.name === 'ofe-idx') continue;
    const v = o?.[el.name];
    if (el.type === 'checkbox') el.checked = Boolean(v);
    else el.value = el.classList.contains('money') ? String(v ?? '').replace('.', ',') : v ?? '';
  }
  main.querySelector('#dlg-oferta-titulo').textContent = o ? 'Editar oferta' : 'Nueva oferta';
  abrirDialog(main.querySelector('#dlg-oferta'));
}

function render(main) {
  const cliente = getClienteActivo();
  const vacio = main.querySelector('#ofe-vacio');
  const cuerpo = main.querySelector('#ofe-cuerpo');

  if (!cliente) {
    main.querySelector('#ofe-print').innerHTML = '';
    main.querySelector('#ofe-scomp').innerHTML = '';
    cuerpo.hidden = true;
    vacio.innerHTML = `
      <div class="empty">
        <span class="empty__icono">${icono('i-table')}</span>
        <p class="empty__titulo">Sin cliente activo</p>
        <p>Selecciona un cliente para generar su propuesta y comparar cotizaciones recibidas.</p>
        <a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a>
      </div>`;
    return;
  }

  vacio.innerHTML = '';
  if (cliente.ingesta?.demostracion) vacio.innerHTML = '<p class="badge badge--warning">DEMOSTRACIÓN: datos sintéticos, sin ofertas oficiales.</p>';
  cuerpo.hidden = false;
  renderConsolidacion(main, cliente);
  renderPreparacionAseguradoras(main, cliente);

  const ufv = getUF().valor;
  const ofertas = cliente.ofertas || [];
  const orden = main.querySelector('#ofe-orden')?.value || 'pension';
  const count = main.querySelector('#ofe-count');
  const filas = main.querySelector('#ofe-filas');
  const cards = main.querySelector('#ofe-cards');
  const detalle = main.querySelector('#ofe-detalle');

  count.textContent = `${ofertas.length} oferta${ofertas.length === 1 ? '' : 's'}`;
  main.querySelector('#ofe-tabla-wrap').hidden = ofertas.length === 0;
  main.querySelector('#ofe-print').innerHTML = crearPropuesta(cliente, getUF());
  if (!ofertas.length) main.querySelector('#ofe-scomp').innerHTML = '';

  if (!ofertas.length) {
    filas.innerHTML = '';
    if (cards) cards.innerHTML = '';
    detalle.innerHTML = `
      <div class="empty u-p-6">
        <span class="empty__icono">${icono('i-file-text')}</span>
        <p class="empty__titulo">Propuesta disponible sin cotizaciones de aseguradoras</p>
        <p>Los cálculos propios se generan automáticamente en la propuesta inferior, sin requerir un SCOMP. Este bloque compara cotizaciones cuando se reciben; no genera precios comerciales de aseguradoras.</p>
      </div>`;
    return;
  }

  const evaluadas = ofertas.map((o) => ({ oferta: o, _ev: evaluarOferta(o, ufv) }));
  const ordenadas = ordenarOfertas(evaluadas, orden);
  const best = mejores(evaluadas);

  /* Banner consulta SCOMP (datos del Certificado de Ofertas real) */
  const sc = cliente.scomp;
  const scompEl = main.querySelector('#ofe-scomp');
  if (scompEl) {
    scompEl.innerHTML = sc?.codigoConsulta ? `
      <div class="veredicto veredicto--info">
        <span class="veredicto__icono">${icono('i-info')}</span>
        <div>
          <p class="veredicto__titulo">Consulta SCOMP N° ${esc(sc.codigoConsulta)}</p>
          <p class="veredicto__texto">Certificado de Ofertas emitido el ${sc.fechaEmision ? fechaCorta(sc.fechaEmision) : '—'}${sc.vigenciaDesde ? ` · ofertas aceptables desde el ${fechaCorta(sc.vigenciaDesde)}` : ''}${sc.vigenciaHasta ? ` hasta el ${fechaCorta(sc.vigenciaHasta)}` : ''}${sc.maxConsultas ? ` · máximo ${sc.maxConsultas} consultas por Certificado de Saldo` : ''}.</p>
        </div>
      </div>` : '';
  }

  /* Diferencia anual vs la mejor pensión (columna del SCOMP real:
     se calcula desde los CLP redondeados, igual que el documento) */
  const diferencias = diferenciasAnuales(ofertas, ufv);
  const difAnual = (e) => {
    const delta = diferencias[ofertas.indexOf(e.oferta)]?.diferenciaAnualCLP;
    return delta == null ? null : -delta;
  };

  /* Total mensual estimado (maestro §58): líquida + beneficios estatales */
  const salud = {
    tipo: cliente.perfil?.saludTipo,
    planUF: cliente.perfil?.saludPlanUF
  };
  const benef = evaluarBeneficios(cliente, ufv);
  const extraMensual = (benef?.total?.pguCLP || 0) + (benef?.total?.bacCLP || 0);

  filas.innerHTML = ordenadas.map((e) => {
    const o = e.oferta;
    const ev = e._ev;
    const idxReal = ofertas.indexOf(o);
    const esMejorPension = evaluadas.indexOf(e) === best.pension;
    const esMejorTasa = evaluadas.indexOf(e) === best.tasa;
    return `
    <tr data-idx="${idxReal}">
      <td><strong>${esc(o.aseguradora)}</strong>
        ${esMejorPension ? `<span class="badge badge--success">${icono('i-trophy')} mayor pensión</span>` : ''}
        ${esMejorTasa ? `<span class="badge badge--info">${icono('i-star')} mejor tasa</span>` : ''}
      </td>
      <td>${o.clasificacion ? `<span class="badge badge--neutral">${esc(o.clasificacion)}</span>` : '—'}</td>
      <td><span class="money">${uf(o.pensionUF)}</span><br><span class="tiny muted">${ev.pensionCLP != null ? clp(ev.pensionCLP) : ''}</span></td>
      <td>${(() => {
        const liq = pensionLiquida(o.pensionUF, ufv, salud);
        return liq ? `<span class="money"><strong>${clp(liq.liquida + extraMensual)}</strong></span><br><span class="tiny muted">${extraMensual ? `+${clp(extraMensual)} benef.` : 'líquida'}</span>` : '—';
      })()}</td>
      <td>${uf(o.primaUF)}</td>
      <td>${ev.tasaImplicitaPct != null ? `<strong>${ev.tasaImplicitaPct.toFixed(2)}%</strong>` : '—'}</td>
      <td>${o.periodoGarantizadoAnios ? `${o.periodoGarantizadoAnios} a` : '—'}</td>
      <td>${o.cuotaMortuoriaUF ? `${o.cuotaMortuoriaUF} UF` : '—'}</td>
      <td>${o.aumentoDiferidoPct ? `${o.aumentoDiferidoPct}% mes ${o.aumentoDiferidoMes || '?'}${o.adelantable ? '↩' : ''}` : '—'}</td>
      <td>${ev.alertas.length ? `<span class="badge ${ev.alertas.some(a => a.tipo === 'danger') ? 'badge--danger' : 'badge--warning'}" title="${esc(ev.alertas.map(a => a.texto).join(' · '))}">${icono('i-triangle-alert')} ${ev.alertas.length}</span>` : `<span class="badge badge--success">${icono('i-circle-check')}</span>`}</td>
      <td class="u-flex u-gap-1">
        <button class="btn btn--ghost btn--sm" type="button" data-acc="editar" title="Editar oferta" aria-label="Editar oferta">${icono('i-pencil')}</button>
        <button class="btn btn--ghost btn--sm" type="button" data-acc="eliminar" title="Eliminar oferta" aria-label="Eliminar oferta">${icono('i-x')}</button>
      </td>
    </tr>`;
  }).join('');

  /* Tarjetas para móvil (sin scroll horizontal) */
  if (cards) cards.innerHTML = ordenadas.map((e) => {
    const o = e.oferta;
    const ev = e._ev;
    const idxReal = ofertas.indexOf(o);
    const esMejorPension = evaluadas.indexOf(e) === best.pension;
    const esMejorTasa = evaluadas.indexOf(e) === best.tasa;
    const liq = pensionLiquida(o.pensionUF, ufv, salud);
    return `
    <article class="card" data-idx="${idxReal}">
      <div class="ofe-card__head">
        <div>
          <strong>${esc(o.aseguradora)}</strong>
          ${o.clasificacion ? `<span class="badge badge--neutral u-ms-2">${esc(o.clasificacion)}</span>` : ''}
          ${o.codigoOferta ? `<span class="tiny muted">· N° ${esc(o.codigoOferta)}</span>` : ''}
          ${o.cruceAseguradora ? `<span class="tiny muted"> · ${o.cruceAseguradora.estado === 'coincide-directorio' ? 'coincide con directorio público' : 'nombre sin cruce confirmado'}</span>` : ''}
        </div>
        <div class="u-flex u-gap-1">
          <button class="btn btn--ghost btn--sm" type="button" data-acc="editar" title="Editar oferta" aria-label="Editar oferta">${icono('i-pencil')}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-acc="eliminar" title="Eliminar oferta" aria-label="Eliminar oferta">${icono('i-x')}</button>
        </div>
      </div>
      <div class="u-flex u-items-center u-gap-2 u-wrap">
        <span class="ofe-card__pension money">${uf(o.pensionUF)}</span>
        ${ev.pensionCLP != null ? `<span class="small muted">≈ ${clp(ev.pensionCLP)}/mes</span>` : ''}
        ${liq ? `<span class="small muted">· total ${clp(liq.liquida + extraMensual)}</span>` : ''}
      </div>
      <div class="u-flex u-gap-1 u-wrap u-mt-1">
        ${esMejorPension ? `<span class="badge badge--success">${icono('i-trophy')} mayor pensión</span>` : ''}
        ${esMejorTasa ? `<span class="badge badge--info">${icono('i-star')} mejor tasa</span>` : ''}
        ${ev.alertas.length ? `<span class="badge ${ev.alertas.some(a => a.tipo === 'danger') ? 'badge--danger' : 'badge--warning'}">${icono('i-triangle-alert')} ${ev.alertas.length} alerta${ev.alertas.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      <dl class="ofe-card__grid u-mt-3 u-mb-0">
        <dt>Prima</dt><dd>${uf(o.primaUF)}</dd>
        <dt>Tasa implícita</dt><dd>${ev.tasaImplicitaPct != null ? ev.tasaImplicitaPct.toFixed(2) + '%' : '—'}</dd>
        <dt>Período garantizado</dt><dd>${o.periodoGarantizadoAnios ? o.periodoGarantizadoAnios + ' años' : '—'}</dd>
        <dt>Aumento temporal</dt><dd>${o.aumentoTemporalPct ? `${o.aumentoTemporalPct}% por ${o.aumentoTemporalMeses || '?'} meses` : '—'}</dd>
        <dt>Tasa descuento único</dt><dd>${o.tasaDescuentoPct != null ? o.tasaDescuentoPct + '%' : '—'}</dd>
        <dt>Dif. anual en condiciones registradas iguales</dt><dd>${(() => { const d = difAnual(e); return d != null ? (d > 0 ? '−' + clp(d) : '$0') : '—'; })()}</dd>
        <dt>Cuota mortuoria</dt><dd>${o.cuotaMortuoriaUF ? o.cuotaMortuoriaUF + ' UF' : '—'}</dd>
        <dt>Aumento diferido</dt><dd>${o.aumentoDiferidoPct ? `${o.aumentoDiferidoPct}% mes ${o.aumentoDiferidoMes || '?'}${o.adelantable ? ' ↩' : ''}` : '—'}</dd>
        <dt>Sobrev. cónyuge/hijos</dt><dd>${[o.sobrevConyugePct, o.sobrevHijosPct].filter(x => x != null).join('% / ') || '—'}${o.sobrevConyugePct != null || o.sobrevHijosPct != null ? '%' : ''}</dd>
      </dl>
    </article>`;
  }).join('');

  // alertas expandidas bajo la tabla
  const conAlertas = evaluadas.filter((e) => e._ev.alertas.length);
  detalle.innerHTML = conAlertas.length ? conAlertas.map((e) => `
    <div class="veredicto veredicto--${e._ev.alertas.some(a => a.tipo === 'danger') ? 'danger' : 'warning'} u-mt-2">
      <span class="veredicto__icono">${icono('i-triangle-alert')}</span>
      <div>
        <p class="veredicto__titulo">${esc(e.oferta.aseguradora)}</p>
        <p class="veredicto__texto">${e._ev.alertas.map((a) => esc(a.texto)).join(' · ')}</p>
      </div>
    </div>`).join('') : '';

}
