/* PreviSmart · pdf.js — extracción de texto de PDFs oficiales.
   Los documentos que emite la AFP/SCOMP son PDF digitales (no
   escaneados): el texto se extrae con pdf.js vendored, sin OCR ni
   servicios externos. Todo corre en el dispositivo (offline OK).

   extraerPaginasPDF devuelve la estructura con posiciones (y, x por
   fragmento): algunas tablas del SCOMP (p.ej. clasificación de riesgo)
   emparejan columnas por coordenada Y, y el texto plano no basta.
   extraerTextoPDF consume la misma estructura para el parser general. */

let pdfjsPromise = null;
let ocrWorkerPromise = null;

/* Rutas a vendor resueltas desde el propio módulo (import.meta.url):
   funcionan igual sirviendo la app desde raíz, subcarpeta o harness de
   prueba, sin depender de la URL de la página que lo invoca. */
const urlVendor = (rel) => new URL(rel, import.meta.url).href;

function cargarPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../../vendor/pdfjs/pdf.min.js').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = urlVendor('../../vendor/pdfjs/pdf.worker.min.js');
      return pdfjs;
    }).catch((error) => { pdfjsPromise = null; throw error; });
  }
  return pdfjsPromise;
}

/* OCR local (Tesseract.js vendored, sin servicios externos) para PDFs
   escaneados: páginas que son imagen no entregan texto a pdf.js. El
   worker se crea una sola vez y queda vivo durante la sesión. */
function cargarOCR() {
  if (!ocrWorkerPromise) {
    // tesseract.min.js es UMD: expone self.Tesseract al importarse.
    ocrWorkerPromise = import('../../vendor/tesseract/tesseract.min.js')
      .then((mod) => globalThis.Tesseract || mod.default || mod)
      .then((T) => T.createWorker('spa', 1, {
        workerPath: urlVendor('../../vendor/tesseract/worker.min.js'),
        langPath: urlVendor('../../vendor/tesseract'),
        corePath: urlVendor('../../vendor/tesseract'),
        gzip: false,
        logger: (m) => console.debug('[ocr]', m.status, m.progress)
       })).catch((error) => { ocrWorkerPromise = null; throw error; });
  }
  return ocrWorkerPromise;
}

/** Renderiza la página en canvas y la pasa por OCR → líneas visuales. */
async function lineasOCR(pagina) {
  const original = pagina.getViewport({ scale: 2 });
  const factor = Math.min(1, 4096 / Math.max(original.width, original.height), Math.sqrt(8000000 / (original.width * original.height)));
  const viewport = pagina.getViewport({ scale: 2 * factor });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  let data;
  try {
    await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const worker = await cargarOCR();
    let timer;
    try {
      ({ data } = await Promise.race([
        worker.recognize(canvas, {}, { blocks: true }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('OCR excedió 120 segundos por página.')), 120000); })
      ]));
    } catch (error) {
      ocrWorkerPromise = null;
      await worker.terminate().catch(() => {});
      throw error;
    } finally { clearTimeout(timer); }
  } finally { canvas.width = 0; canvas.height = 0; }
  const lineas = data.lines || (data.blocks || []).flatMap((block) =>
    (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []));
  return lineas
    .filter((l) => l.text && l.text.trim())
    .map((l) => ({ y: -Math.round(l.bbox.y0), partes: [{ x: l.bbox.x0, s: l.text.trim() }] }))
    .sort((a, b) => b.y - a.y);
}

/**
 * Páginas del PDF como líneas visuales con partes posicionadas.
 * Si una página no trae texto embebido (escaneada), cae a OCR local.
 * @returns {Promise<Array<Array<{y:number, partes:Array<{x:number, s:string}>}>>>}
 */
export async function extraerPaginasPDF(archivo, { ocr = true, maxPaginas = 200 } = {}) {
  if (!archivo || archivo.size <= 0 || archivo.size > 25 * 1024 * 1024) throw new Error('El PDF está vacío o supera 25 MB.');
  if (!Number.isInteger(maxPaginas) || maxPaginas < 1 || maxPaginas > 200) throw new Error('Límite de páginas inválido.');
  const pdfjs = await cargarPdfjs();
  const datos = await archivo.arrayBuffer();
  const loading = pdfjs.getDocument({ data: datos, isEvalSupported: false, maxImageSize: 16000000, canvasMaxAreaInBytes: 64000000 });
  const paginas = [];
  try {
    const doc = await loading.promise;
    if (doc.numPages > maxPaginas) throw new Error(`El PDF supera ${maxPaginas} páginas; divídelo antes de importar.`);
    let escaneadas = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i);
      const contenido = await pagina.getTextContent();
      const lineas = lineasDePagina(contenido.items);
      const caracteres = lineas.reduce((n, l) => n + l.partes.reduce((m, p) => m + p.s.length, 0), 0);
      if (caracteres < 15 && ocr && ++escaneadas > 30) throw new Error('El PDF supera 30 páginas escaneadas; divídelo antes de importar.');
      paginas.push(caracteres < 15 && ocr ? await lineasOCR(pagina) : lineas);
      pagina.cleanup();
    }
  } finally { await loading.destroy(); }
  return paginas;
}

/**
 * Extrae el texto reconstruyendo líneas visuales (agrupa por Y, ordena por X).
 * @returns {Promise<string>}
 */
export async function extraerTextoPDF(archivo) {
  const paginas = await extraerPaginasPDF(archivo);
  return paginas.map((lineas) =>
    lineas.map((l) => l.partes.map((p) => p.s).join(' ')).join('\n')
  ).join('\n');
}

/** items de pdf.js → líneas visuales {y, partes:[{x,s}]} (Y crece hacia arriba). */
function lineasDePagina(items) {
  const lineas = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    let linea = lineas.find((l) => Math.abs(l.y - y) <= 2);
    if (!linea) { linea = { y, partes: [] }; lineas.push(linea); }
    linea.partes.push({ x: it.transform[4], s: it.str });
  }
  lineas.sort((a, b) => b.y - a.y);
  for (const l of lineas) l.partes.sort((a, b) => a.x - b.x);
  return lineas;
}
