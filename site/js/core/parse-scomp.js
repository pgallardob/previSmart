/* PreviSmart · parse-scomp.js — parser del Certificado de Ofertas SCOMP.
   Función pura sobre el texto extraído del PDF (core/pdf.js): lee la
   estructura de certificados oficiales y devuelve las secciones del
   expediente PreviSmart. Solo captura lo que el documento afirma; los
   montos en CLP de las ofertas NO se guardan: la app los recalcula con
   la UF vigente (fuente única de verdad). */

import { parseLocal } from './dates.js';

const MES_ANIO = (meses) => (Number(meses) || 0) / 12;
const numCL = (s) => Number(String(s || '').replace(/\./g, '').replace(',', '.')) || 0;
const numCLP = (s) => Number(String(s || '').replace(/[^\d-]/g, '')) || 0;
const fechaISO = (dmy) => {
  const m = String(dmy || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  return parseLocal(iso) ? iso : null;
};
const PALABRAS_NUM = { una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const AFPS = ['PROVIDA', 'CUPRUM', 'HABITAT', 'CAPITAL', 'PLANVITAL', 'MODELO', 'UNO'];

/** Texto listo para regex: los PDF usan acentos descompuestos (NFD) y
   espacios no-separables (NBSP) — se normaliza todo a NFC + espacio
   normal, o los patrones con tildes/espacios no muerden. */
const NFC = (t) => String(t).normalize('NFC').replace(/ /g, ' ');

/** ¿El texto parece un Certificado de Ofertas SCOMP? */
export function esSCOMP(texto) {
  const t = NFC(texto);
  return /CERTIFICADO DE OFERTAS/i.test(t) && /Código\s*Consulta/i.test(t);
}

/** ¿Parece un Certificado Electrónico de Saldo de AFP? */
export function esCertificadoSaldo(texto) {
  return /CERTIFICADO\s+(ELECTRÓNICO\s+)?DE\s+SALDO/i.test(NFC(texto)) && !esSCOMP(texto);
}

/**
 * Parsea el texto completo del Certificado de Ofertas.
 * @param {string} texto texto reconstruido (extraerTextoPDF)
 * @param {Array} [paginas] estructura posicional (extraerPaginasPDF) —
 *   necesaria para la tabla de clasificación, que empareja
 *   aseguradora↔letra por coordenada Y (la prosa se cuela en el medio).
 * @returns {{scomp:object, perfil:object, saldo:object, beneficiarios:array, ofertas:array, meta:object}}
 */
export function parsearSCOMP(texto, paginas = null) {
  const lineas = NFC(texto).split('\n');
  const plano = lineas.join(' ');

  return {
    scomp: extraerScomp(plano),
    perfil: extraerPerfil(plano),
    saldo: extraerSaldo(plano, lineas),
    beneficiarios: extraerBeneficiarios(lineas),
    ofertas: extraerOfertas(lineas, paginas),
    meta: extraerMeta(plano)
  };
}

/* ---------------- Metadatos SCOMP ---------------- */
function extraerScomp(plano) {
  const out = {};
  const cod = plano.match(/Código\s*Consulta\s*:\s*(\d+)/i);
  if (cod) out.codigoConsulta = cod[1];
  const emi = plano.match(/Fecha de emisión\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (emi) out.fechaEmision = fechaISO(emi[1]);
  const vig = plano.match(/aceptarse entre el (\d{2}\/\d{2}\/\d{4}) y\s*el (\d{2}\/\d{2}\/\d{4})/i);
  if (vig) { out.vigenciaDesde = fechaISO(vig[1]); out.vigenciaHasta = fechaISO(vig[2]); }
  const max = plano.match(/máximo de\s+(\w+)\s+solicitudes/i);
  if (max) {
    const n = PALABRAS_NUM[max[1].toLowerCase()] ?? Number(max[1]);
    if (Number.isFinite(n) && n > 0) out.maxConsultas = n;
  }
  return out;
}

/* ---------------- Afiliado ---------------- */
function extraerPerfil(plano) {
  const p = {};
  const nom = plano.match(/Nombres:\s*([A-ZÁÉÍÓÚÑ ]+?)\s+RUT\s*:?\s*([\d.]+-[\dkK])/i);
  if (nom) { p.nombre = nom[1].trim(); p.rut = nom[2]; }
  const ap = plano.match(/Apellido Paterno:\s*([A-ZÁÉÍÓÚÑ]+)/i);
  if (ap) p.apellidoPaterno = ap[1];
  const am = plano.match(/Apellido Materno:\s*([A-ZÁÉÍÓÚÑ]+)/i);
  if (am) p.apellidoMaterno = am[1];
  const nac = plano.match(/Fecha de nacimiento:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (nac) p.fechaNacimiento = fechaISO(nac[1]);
  const sexo = plano.match(/Sexo:\s*(MASCULINO|FEMENINO)/i);
  if (sexo) p.sexo = /^F/i.test(sexo[1]) ? 'F' : 'M';
  const civil = plano.match(/Estado Civil:\s*(SOLTERO|CASADO|VIUDO|DIVORCIADO|CONVIVIENTE)/i);
  if (civil) p.estadoCivil = civil[1].toLowerCase();
  const afp = plano.match(new RegExp(`AFP\\s+(${AFPS.join('|')})`, 'i'));
  if (afp) p.afp = afp[1][0].toUpperCase() + afp[1].slice(1).toLowerCase();
  return p;
}

/* ---------------- Saldo destinado a pensión + retiro programado ---------------- */
function extraerSaldo(plano, lineas) {
  const s = {};
  const saldo = plano.match(/SALDO DESTINADO A PENSIÓN ES\s*:?\s*UF\s*([\d.,]+)\s*\(\s*\$\s*([\d.]+)/i);
  if (saldo) { s.saldoDestinadoUF = numCL(saldo[1]); s.obligatorio = numCLP(saldo[2]); }
  const ufEmi = plano.match(/Valor UF a fecha emisión\s*:?\s*\$\s*([\d.,]+)/i);
  if (ufEmi) s.ufEmisionCLP = numCL(ufEmi[1]);
  const certEmi = plano.match(/Fecha Emisión:\s*(\d{2}\/\d{2}\/\d{4})\s*Fecha Vencimiento:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (certEmi) { s.certSaldoEmitido = fechaISO(certEmi[1]); s.certSaldoVence = fechaISO(certEmi[2]); }

  /* Retiro programado: la tabla "Pensión mensual (UF)" lista las 7 AFP;
     la pensión del primer año en la AFP del afiliado alimenta
     pensionEstimadaUF del expediente. La etiqueta y los valores pueden
     quedar en la misma línea según el extractor, así que se barren las
     líneas siguientes hasta hallar la fila de valores UF y la de $. */
  const iRP = lineas.findIndex((l) => /Pensión mensual \(UF\)/i.test(l));
  const iHead = lineas.findIndex((l, i) => i < iRP && AFPS.filter((a) => l.includes(a)).length >= 3);
  if (iRP >= 0 && iHead >= 0) {
    const afps = [...lineas[iHead].matchAll(new RegExp(AFPS.join('|'), 'g'))].map((m) => m[0]);
    let filaUF = '', filaCLP = '';
    for (let i = iRP; i < Math.min(iRP + 8, lineas.length); i++) {
      if (!filaUF && (lineas[i].match(/\d+,\d{2}/g) || []).length >= 3) filaUF = lineas[i];
      else if (filaUF && (lineas[i].match(/\d{1,3}(?:\.\d{3})+/g) || []).length >= 3) { filaCLP = lineas[i]; break; }
    }
    const afpAfiliado = (plano.match(new RegExp(`AFP\\s+(${AFPS.join('|')})`, 'i')) || [])[1]?.toUpperCase();
    const idx = afps.indexOf(afpAfiliado);
    if (idx >= 0 && filaUF) {
      const ufs = filaUF.match(/\d+,\d{2}/g) || [];
      const clps = filaCLP.match(/\d{1,3}(?:\.\d{3})+/g) || [];
      if (ufs[idx]) {
        s.pensionEstimadaUF = numCL(ufs[idx]);
        s.pensionEstimadaCLP = numCLP(clps[idx]) || null;
        s.pensionEstimadaFuente = `SCOMP · retiro programado ${afpAfiliado} (primer año)`;
      }
    }
  }
  return s;
}

/* ---------------- Beneficiarios ----------------
   La tabla tiene layout de columnas que se mezclan al extraer:
   "<fecha> <n°> APELLIDOS RUT NOMBRES <rut> Cónyuge ..." — se captura
   nombre (nombres + apellidos), RUT, parentesco y fecha. Mejor esfuerzo:
   la revisión antes de importar permite corregir. */
function extraerBeneficiarios(lineas) {
  const lista = [];
  const re = /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]+?)\s+RUT\s*:?\s*([A-ZÁÉÍÓÚÑ .]*?)\s*([\d.]+-[\dkK])\s+(Cónyuge|Conviviente|Hijo|Hija|Padre|Madre|Designado)/gi;
  for (const l of lineas) {
    let m;
    while ((m = re.exec(l))) {
      const apellidos = m[1].replace(/\s+/g, ' ').trim();
      const nombres = (m[2] || '').replace(/\s+/g, ' ').trim();
      const fecha = l.match(/(\d{2}\/\d{2}\/\d{4})/);
      const parentesco = m[4].toLowerCase().normalize('NFD').replace(/́/g, '');
      lista.push({
        tipo: parentesco === 'conyuge' ? 'conyuge'
          : parentesco === 'conviviente' ? 'conviviente'
          : parentesco.startsWith('hij') ? 'hijo'
          : parentesco === 'designado' ? 'designado' : 'padre_causante',
        nombre: `${nombres} ${apellidos}`.trim(),
        rut: m[3],
        fechaNacimiento: fecha ? fechaISO(fecha[1]) : null,
        estudiante: false, invalidez: null
      });
    }
  }
  return lista;
}

/* ---------------- Ofertas ----------------
   Secciones: RVI simple (sin cláusulas) y variantes con cláusula de
   aumento temporal + período garantizado. Cada fila:
   "<codigo9> <ASEGURADORA> <UF 0,00> <$ 000.000> <diferencia anual>" */
const RE_FILA = /^\s*(\d{9})\s+([0-9A-ZÁÉÍÓÚÑ][0-9A-ZÁÉÍÓÚÑ .]*?)\s+(\d+,\d{1,2})\s+(\d{1,3}(?:\.\d{3})*)\s+(-?[\d.]+)\s*$/;

function extraerOfertas(lineas, paginas = null) {
  const ofertas = [];
  let clausula = null; // {aumentoTemporalPct, aumentoTemporalMeses, periodoGarantizadoAnios}
  let enSeccionRVI = false;

  for (const l of lineas) {
    const T = l.trim();

    if (/RENTA VITALICIA INMEDIATA SIMPLE/i.test(T)) { enSeccionRVI = true; clausula = null; continue; }
    if (/CON CLÁUSULA DE AUMENTO/i.test(T) || /GARANTIZADA DURANTE/i.test(T)) {
      const g = T.match(/GARANTIZADA DURANTE\s+(\d+)\s+MESES/i);
      const a = T.match(/PENSIÓN DEL\s+(\d+)\s*%\s*POR\s+(\d+)\s+MESES/i);
      enSeccionRVI = true;
      clausula = {
        periodoGarantizadoAnios: g ? MES_ANIO(g[1]) : 0,
        aumentoTemporalPct: a ? Number(a[1]) : null,
        aumentoTemporalMeses: a ? Number(a[2]) : null
      };
      continue;
    }
    /* Fin de sección solo por cambio de bloque semántico — NUNCA por
       mobiliario de página ('Página: n de m', 'Código consulta', código
       de barras): las tablas de ofertas continúan tras el salto. */
    if (/RENTA TEMPORAL|RENTA VITALICIA DIFERIDA|Tasa de Descuento|Clasificación de Riesgo|EXCEDENTE DE LIBRE/i.test(T)) {
      enSeccionRVI = false; clausula = null; continue;
    }
    if (/^(Página:|Código consulta|\(ORIGINAL\)|\d{20,})/i.test(T)) continue;

    const f = T.match(RE_FILA);
    if (f && enSeccionRVI) {
      ofertas.push({
        aseguradora: f[2].trim(),
        codigoOferta: f[1],
        pensionUF: numCL(f[3]),
        pensionCLPdocumento: numCLP(f[4]),          // referencia: CLP del certificado
        diferenciaAnualCLPdocumento: numCLP(f[5]),  // referencia: dif. anual del certificado
        ...(clausula || {}),
        notas: clausula
          ? `Garantizada ${clausula.periodoGarantizadoAnios * 12} meses` +
            (clausula.aumentoTemporalPct ? ` + aumento temporal ${clausula.aumentoTemporalPct}% por ${clausula.aumentoTemporalMeses} meses` : '')
          : ''
      });
    }
  }

  aplicarTasasYClasificacion(lineas, ofertas, paginas);
  return ofertas;
}

function aplicarTasasYClasificacion(lineas, ofertas, paginas) {
  const nombres = new Set(ofertas.map((o) => o.aseguradora));
  const tasas = {};
  const iTasa = lineas.findIndex((l) => /Tasa de Descuento del Periodo Garantizado/i.test(l));
  if (iTasa >= 0) {
    for (const l of lineas.slice(iTasa, iTasa + 40)) {
      const m = l.trim().match(/^([0-9A-ZÁÉÍÓÚÑ][0-9A-ZÁÉÍÓÚÑ ]+?)\s+(\d+,\d{1,2})\s*$/);
      if (m && nombres.has(m[1].trim())) tasas[m[1].trim()] = numCL(m[2]);
    }
  }
  for (const o of ofertas) {
    if (tasas[o.aseguradora] != null) o.tasaDescuentoPct = tasas[o.aseguradora];
  }
  /* Clasificación de riesgo: la tabla tiene dos columnas (nombre x≈80,
     letra x≈210) con la prosa del cuerpo metida en medio. Con la
     estructura posicional se empareja por coordenada Y de fila; sin
     ella, por orden de aparición de los bloques nombre/letra. */
  const mapa = paginas
    ? clasificacionPorGeometria(paginas, nombres)
    : clasificacionPorBloques(lineas, nombres);
  for (const o of ofertas) {
    if (mapa[o.aseguradora]) o.clasificacion = mapa[o.aseguradora];
  }
}

/* Empareja nombre↔letra por cercanía de Y en la página del título. */
function clasificacionPorGeometria(paginas, nombres) {
  const mapa = {};
  const RE_LETRA = /^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?)$/;
  for (const lineas of paginas) {
    const iTitulo = lineas.findIndex((l) =>
      /^Clasificación de Riesgo de las Compañías/i.test(l.partes.map((p) => p.s).join(' ').trim()));
    if (iTitulo < 0) continue;
    const noms = [], letras = [];
    for (const l of lineas.slice(iTitulo + 1)) {
      for (const p of l.partes) {
        const t = NFC(p.s).trim();
        if (nombres.has(t) && p.x < 160) noms.push({ n: t, y: l.y });
        else if (RE_LETRA.test(t) && p.x >= 150 && p.x < 240) letras.push({ l: t, y: l.y });
      }
    }
    for (const { n, y } of noms) {
      const letra = letras.find((L) => Math.abs(L.y - y) <= 8);
      if (letra && !mapa[n]) mapa[n] = letra.l;
    }
    if (Object.keys(mapa).length) break;
  }
  return mapa;
}

/* Respaldo sin posiciones: empareja bloques nombre/letra por índice. */
function clasificacionPorBloques(lineas, nombres) {
  const mapa = {};
  const iClas = lineas.findIndex((l) => /^Clasificación de Riesgo de las Compañías/i.test(l.trim()));
  if (iClas < 0) return mapa;
  const bloque = lineas.slice(iClas, iClas + 80).map((l) => l.trim());
  const noms = bloque.filter((l) => nombres.has(l));
  const letras = bloque.filter((l) => /^(AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?)$/.test(l));
  noms.forEach((n, i) => { if (letras[i]) mapa[n] = letras[i]; });
  return mapa;
}

/* ---------------- Datos sueltos útiles ---------------- */
function extraerMeta(plano) {
  const m = {};
  const pgu = plano.match(/PGU\)\s*hasta\s*(\d{2}\/\d{2}\/\d{4}):\s*\$\s*([\d.]+)/i);
  if (pgu) { m.pguVigenciaHasta = fechaISO(pgu[1]); m.pguMontoCLP = numCLP(pgu[2]); }
  const asesorRV = plano.match(/pago máximo promedio al asesor de UF\s*([\d.,]+)/i);
  if (asesorRV) m.pagoAsesorMaxUF = numCL(asesorRV[1]);
  return m;
}
