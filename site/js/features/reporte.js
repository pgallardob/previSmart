/* PreviSmart · reporte.js — documento imprimible del expediente. */

import { getClienteActivo, subscribe } from '../core/store.js';
import { getUF, onUF, etiquetaOrigen } from '../core/uf.js';
import { clp, clpDec, uf, pct, fechaCorta } from '../core/format.js';
import { evaluarElegibilidad, pctSobrevivencia, NOMBRES_TIPO } from '../core/elegibilidad.js';
import { evaluarBeneficios } from '../core/beneficios.js';
import { evaluarOferta } from '../core/ofertas.js';
import { escenarioSobrevivencia } from '../core/liquida.js';
import { edadExacta, fechaCumple } from '../core/dates.js';
import { NORMATIVA } from '../data/normativa-2026.js';
import { ETAPAS } from '../data/ruta.js';
import { modeloInformeCalculos, renderInformeCalculos } from '../core/informe-calculos.js';
import { iniciarDescargaCalculos } from './informe-calculos.js';
import { pensionReferencia } from '../core/calculos.js';
import { clienteParaPropuesta } from '../core/consolidacion-scomp.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icono = (n) => `<svg class="icon" aria-hidden="true"><use href="./assets/icons/sprite.svg#${n}"></use></svg>`;
let unsub = null;

export function init(main) {
  if (unsub) { unsub(); unsub = null; }
  main.querySelector('#btn-imprimir')?.addEventListener('click', () => window.print());
  render(main);
  const limpiarPDF = iniciarDescargaCalculos(main, 'rep');
  unsub = subscribe(() => render(main));
  const unsubUF = onUF(() => render(main));
  return () => { unsub?.(); unsubUF(); limpiarPDF(); };
}

const f = (v) => (v == null || v === '') ? '—' : esc(v);

function render(main) {
  const cliente = clienteParaPropuesta(getClienteActivo());
  const vacio = main.querySelector('#rep-vacio');
  const cuerpo = main.querySelector('#rep-cuerpo');

  if (!cliente) {
    cuerpo.hidden = true;
    vacio.innerHTML = `<div class="empty"><span class="empty__icono">${icono('i-file-text')}</span><p class="empty__titulo">Sin cliente activo</p><p>Selecciona un cliente para generar su reporte.</p><a class="btn btn--primary" href="#/panel">${icono('i-users')} Ir a la cartera</a></div>`;
    return;
  }
  vacio.innerHTML = '';
  cuerpo.hidden = false;

  const ufv = getUF().valor;
  const ufMeta = getUF();
  const p = cliente.perfil || {};
  const s = cliente.saldo || {};
  const pension = pensionReferencia(cliente, ufv);
  const edad = p.fechaNacimiento ? edadExacta(p.fechaNacimiento) : null;
  const legal = p.sexo ? NORMATIVA.edadLegal[p.sexo === 'F' ? 'mujer' : 'hombre'] : null;
  const veredictos = evaluarElegibilidad(cliente, ufv);
  const benef = evaluarBeneficios(cliente, ufv);
  const ofertas = cliente.ofertas || [];
  const sov = cliente.sobrevivencia || {};
  const etapa = cliente.ruta?.etapa ?? 0;
  const chk = cliente.checklist || {};
  const chkOk = Object.values(chk).filter(Boolean).length;

  main.querySelector('#rep-meta').textContent =
    `Generado ${new Date().toLocaleDateString('es-CL')} · UF ${ufv ? clp(ufv) : '—'} (${etiquetaOrigen(ufMeta)})`;

  const fila = (k, v) => `<tr><td class="rep-k">${k}</td><td>${v}</td></tr>`;

  const html = `
  <header class="rep-head">
    <div>
      <h2 class="rep-titulo">Expediente previsional — ${esc(cliente.nombre)}</h2>
      <p class="tiny muted">PreviSmart · normativa octubre 2026 · UF ${ufv ? clpDec(ufv) : '—'} ${ufMeta.fecha ? `(${fechaCorta(ufMeta.fecha)})` : ''}</p>
    </div>
    <span class="badge badge--neutral">${esc(cliente.id?.slice(0, 8) || '')}</span>
  </header>
  ${cliente.ingesta?.demostracion ? '<p><strong>DEMOSTRACIÓN — datos sintéticos. No usar para una decisión de pensión.</strong></p>' : ''}

  <section class="rep-sec">
    <h3>1. Datos personales y AFP</h3>
    <table class="rep-tabla"><tbody>
      ${fila('Nombre', esc(cliente.nombre))}
      ${fila('RUT', esc(p.rut || '—'))}
      ${fila('Contacto', [p.telefono, p.email, p.direccion].filter(Boolean).map(esc).join(' · ') || '—')}
      ${fila('Sexo / edad', `${p.sexo === 'F' ? 'Mujer' : p.sexo === 'M' ? 'Hombre' : '—'}${edad ? ` · ${edad.anios} años` : ''}`)}
      ${fila('Fecha nacimiento', f(p.fechaNacimiento))}
      ${fila('AFP / multifondo', `${f(p.afp)}${p.multifondo ? ` · fondo ${esc(p.multifondo)}` : ''}`)}
      ${fila('Estado civil', f(p.estadoCivil))}
      ${p.fechaMatrimonio ? fila('Matrimonio', esc(p.fechaMatrimonio)) : ''}
      ${fila('Tipo de pensión', f(p.rutaTipo) || 'vejez')}
      ${fila('Meses cotizados', f(p.mesesCotizados))}
      ${fila('Promedio remuneraciones', p.promedioRemuneraciones ? clp(p.promedioRemuneraciones) : '—')}
      ${fila('Salud declarada', p.saludTipo === 'isapre' ? `Isapre ${f(p.saludPlanUF)} UF` : p.saludTipo === 'fonasa' ? 'Fonasa 7% (revisar exenciones)' : 'No informada')}
    </tbody></table>
  </section>

  <section class="rep-sec">
    <h3>2. Composición del saldo</h3>
    <table class="rep-tabla"><tbody>
      ${fila('Capital obligatorio', s.obligatorio ? clp(s.obligatorio) : '—')}
      ${fila('APV', s.apv ? clp(s.apv) : '—')}
      ${fila('Depósitos convenidos', s.depositosConvenidos ? clp(s.depositosConvenidos) : '—')}
      ${fila('Cotizaciones voluntarias', s.cotizacionesVoluntarias ? clp(s.cotizacionesVoluntarias) : '—')}
      ${fila('Cuenta 2', s.cuenta2 ? clp(s.cuenta2) : '—')}
      ${fila('Bono de Reconocimiento', s.bonoReconocimiento?.monto ? `${clp(s.bonoReconocimiento.monto)} (${esc(s.bonoReconocimiento.estado || 'sin estado')})` : '—')}
      ${fila('Bono por Hijo', s.bonoPorHijo ? clp(s.bonoPorHijo) : '—')}
      ${fila('Otros bonos', s.otrosBonos ? clp(s.otrosBonos) : '—')}
      ${fila('Pensión estimada informada', pension.clp != null ? `${pension.uf != null ? uf(pension.uf) + ' · ' : ''}${clp(pension.clp)} · ${esc(pension.fuente)}` : 'No informada por las fuentes; no se deduce del saldo')}
    </tbody></table>
  </section>

  <section class="rep-sec">
    <h3>3. Beneficiarios</h3>
    ${(cliente.beneficiarios || []).length ? `<table class="rep-tabla"><thead><tr><th>Nombre</th><th>Tipo</th><th>Edad</th><th>% legal</th></tr></thead><tbody>
      ${cliente.beneficiarios.map((b) => {
        const e = b.fechaNacimiento ? edadExacta(b.fechaNacimiento) : null;
        const hayHijos = cliente.beneficiarios.some((x) => x.tipo === 'hijo' && pctSobrevivencia(x, false) > 0);
        return `<tr><td>${esc(b.nombre || '—')}</td><td>${esc(NOMBRES_TIPO[b.tipo] || b.tipo)}</td><td>${e ? e.anios + 'a' : '—'}</td><td>${Math.round(pctSobrevivencia(b, hayHijos) * 100)}%</td></tr>`;
      }).join('')}</tbody></table>`
    : '<p class="muted small">Sin beneficiarios declarados.</p>'}
  </section>

  <section class="rep-sec">
    <h3>4. Elegibilidad</h3>
    <ul class="rep-lista">${veredictos.map((v) => `<li><strong>${esc(v.titulo)}</strong> — ${esc(v.texto)}</li>`).join('')}</ul>
  </section>

  <section class="rep-sec">
    <h3>5. Beneficios estatales estimados</h3>
    <table class="rep-tabla"><tbody>
      ${fila('PGU', benef.pgu?.beneficio ? `${clp(benef.pgu.beneficio)}/mes (${benef.pgu.tipo})` : benef.pgu?.detalle || '—')}
      ${fila('BAC', benef.bac?.clp ? `${clp(benef.bac.clp)} (${benef.bac.uf.toFixed(2)} UF)` : benef.bac?.detalle || '—')}
      ${fila('CEV', benef.cev?.ufMax != null ? `${benef.cev.ufMin.toFixed(2)}–${benef.cev.ufMax.toFixed(2)} UF (${Math.round(benef.cev.pct * 100)}%)` : benef.cev?.detalle || '—')}
      ${fila('Total pensión estimada', benef.total.totalCLP != null ? clp(benef.total.totalCLP) + '/mes' : '—')}
    </tbody></table>
    <p class="tiny muted">Estimaciones con supuestos declarados en el módulo Beneficios. Valores oficiales: IPS/Seguro Social.</p>
  </section>

  ${ofertas.length ? `
  <section class="rep-sec">
    <h3>6. Ofertas SCOMP comparadas</h3>
    <table class="rep-tabla"><thead><tr><th>Aseguradora</th><th>Clasif.</th><th>Pensión</th><th>Prima</th><th>Tasa</th><th>P. garant.</th><th>Mort.</th></tr></thead><tbody>
      ${ofertas.map((o) => {
        const ev = evaluarOferta(o, ufv);
        return `<tr><td>${esc(o.aseguradora)}</td><td>${f(o.clasificacion)}</td><td>${uf(o.pensionUF)}</td><td>${uf(o.primaUF)}</td><td>${ev.tasaImplicitaPct ? ev.tasaImplicitaPct.toFixed(2) + '%' : '—'}</td><td>${o.periodoGarantizadoAnios ? esc(o.periodoGarantizadoAnios) + ' a' : '—'}</td><td>${o.cuotaMortuoriaUF ? esc(o.cuotaMortuoriaUF) + ' UF' : '—'}</td></tr>`;
      }).join('')}</tbody></table>
  </section>` : ''}

  ${sov.pensionUF ? `
  <section class="rep-sec">
    <h3>${ofertas.length ? '7' : '6'}. Sobrevivencia simulada</h3>
    <table class="rep-tabla"><thead><tr><th>Beneficiario</th><th>%</th><th>Pensión</th></tr></thead><tbody>
      ${escenarioSobrevivencia(sov, cliente.beneficiarios || [], ufv, pctSobrevivencia).items.map((b) =>
        `<tr><td>${esc(b.nombre || NOMBRES_TIPO[b.tipo])}</td><td>${Math.round(b.pctLegal * 100)}%${b.nota ? ' *' : ''}</td><td>${uf(b.pensionUF)}</td></tr>`).join('')}</tbody></table>
    <p class="tiny muted">Período garantizado ${sov.periodoGarantizadoAnios || 0} años · cuota mortuoria ${f(sov.cuotaMortuoriaUF)} UF</p>
  </section>` : ''}

  <section class="rep-sec">
    <h3>Avance del proceso</h3>
    <table class="rep-tabla"><tbody>
      ${fila('Etapa', `${etapa} de ${ETAPAS.length} completadas`)}
      ${fila('Checklist', `${chkOk} ítems marcados`)}
    </tbody></table>
  </section>

  <section class="rep-sec">
    <h3>Declaraciones y fuentes</h3>
    <p class="tiny muted">Este documento es una <strong>simulación informativa para uso del asesor previsional</strong>: no es una oferta, no constituye asesoría financiera personalizada ni reemplaza los documentos oficiales (Certificado de Saldo, Certificado de Ofertas). Los valores normativos corresponden a octubre 2026 (Ley 21.735, DL 3.500, tabla SII). La UF usada es ${ufv ? clp(ufv) + ' (' + etiquetaOrigen(ufMeta) + ')' : 'la ingresada'}.</p>
    <div class="rep-firmas">
      <div class="rep-firma"><span></span><small>Asesor previsional</small></div>
      <div class="rep-firma"><span></span><small>Cliente</small></div>
    </div>
  </section>`;

  main.querySelector('#rep-doc').innerHTML = html;
  main.querySelector('#rep-calculos').innerHTML = renderInformeCalculos(modeloInformeCalculos(cliente, ufMeta));
}
