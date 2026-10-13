let carga;

function cargarPDFLib() {
  if (globalThis.PDFLib) return Promise.resolve(globalThis.PDFLib);
  if (!carga) carga = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../../vendor/pdf-lib/pdf-lib.min.js', import.meta.url).href;
    script.onload = () => globalThis.PDFLib ? resolve(globalThis.PDFLib) : reject(new Error('No se pudo iniciar el generador PDF.'));
    script.onerror = () => { carga = null; script.remove(); reject(new Error('No se pudo cargar el generador PDF local.')); };
    document.head.append(script);
  });
  return carga;
}

/** Local-only, paginated PDF from the same whitelisted model used for screen preview. */
export async function crearPDFInforme(modelo) {
  const { PDFDocument, StandardFonts, rgb } = await cargarPDFLib();
  const pdf = await PDFDocument.create();
  pdf.setTitle(modelo.titulo); pdf.setCreator('PreviSmart'); pdf.setProducer('PreviSmart');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const seguro = (text) => {
    const value = String(text).normalize('NFC').replace(/[\r\n\t]+/g, ' ');
    try { normal.encodeText(value); }
    catch { throw new Error('Hay caracteres que la fuente PDF no puede representar sin alterar los datos. Usa Imprimir / PDF del navegador.'); }
    return value;
  };
  const width = 595.28, height = 841.89, margin = 42, maxWidth = width - margin * 2;
  let page, y;
  const nueva = () => {
    page = pdf.addPage([width, height]); y = height - 62;
    page.drawText('PREVISMART - DOCUMENTO (simulación)', { x: margin, y: height - 35, size: 11, font: bold, color: rgb(0.04, 0.35, 0.33) });
    page.drawText('Simulación NO OFICIAL. Sin validez para aceptar ofertas. No es SCOMP.', { x: margin, y: 30, size: 8, font: normal });
  };
  const envolver = (text, font, size, availableWidth) => {
    const words = seguro(text).split(/\s+/);
    const lines = []; let line = '';
    for (const word of words) {
      if (font.widthOfTextAtSize(word, size) > availableWidth) {
        if (line) { lines.push(line); line = ''; }
        let part = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(part + char, size) > availableWidth) { lines.push(part); part = ''; }
          part += char;
        }
        line = part;
      } else if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) > availableWidth) {
        lines.push(line); line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines;
  };
  const escribir = (text, heading = false, size = heading ? 12 : 10) => {
    const font = heading ? bold : normal, leading = Math.max(15, size * 1.25);
    const lines = envolver(text, font, size, maxWidth);
    for (const l of lines) { if (y < 64 + leading) nueva(); page.drawText(l, { x: margin, y, size, font }); y -= leading; }
    y -= heading ? 6 : 3;
  };
  const padding = 7, rowLineHeight = 13;
  const tablaFila = (values, headers, weights, header = false) => {
    const widths = weights.map((w) => maxWidth * w), size = values.length > 3 ? 9.5 : 9;
    const lines = values.map((value, i) => envolver(value, header || i === 0 ? bold : normal, size, widths[i] - 2 * padding));
    const needed = Math.max(...lines.map((ls) => ls.length));
    if (!header && needed * rowLineHeight + 2 * padding <= height - 160
        && y - (needed * rowLineHeight + 2 * padding) < 65) {
      nueva(); tablaFila(headers, headers, weights, true);
    }
    let offset = 0;
    while (offset < needed) {
      const capacity = Math.floor((y - 65 - 2 * padding) / rowLineHeight);
      if (capacity < 1) { nueva(); tablaFila(headers, headers, weights, true); continue; }
      const count = Math.min(capacity, needed - offset);
      const rowHeight = count * rowLineHeight + 2 * padding;
      page.drawRectangle({ x: margin, y: y - rowHeight, width: maxWidth, height: rowHeight,
        color: header ? rgb(0.90, 0.93, 0.93) : rgb(1, 1, 1), borderColor: rgb(0.60, 0.65, 0.65), borderWidth: 0.5 });
      let x = margin;
      for (let col = 0; col < lines.length; col++) {
        if (col > 0) page.drawLine({ start: { x, y }, end: { x, y: y - rowHeight }, color: rgb(0.60, 0.65, 0.65), thickness: 0.5 });
        for (let i = 0; i < count; i++) if (lines[col][offset + i]) page.drawText(lines[col][offset + i], {
          x: x + padding, y: y - padding - size - i * rowLineHeight, size, font: header || col === 0 ? bold : normal });
        x += widths[col];
      }
      y -= rowHeight; offset += count;
    }
  };
  const fila = (left, right, header = false) => tablaFila([left, right], ['Información', 'Detalle y cálculo'], [158 / maxWidth, 1 - 158 / maxWidth], header);
  const iniciarTabla = (titulo, headers, weights, firstRow) => {
    const size = headers.length > 3 ? 9.5 : 9;
    const rowHeight = (values, header) => 14 + 13 * Math.max(...values.map((v, i) => envolver(v, header || i === 0 ? bold : normal, size, maxWidth * weights[i] - 14).length));
    const required = 65 + envolver(titulo, bold, 12, maxWidth).length * 15 + 6 + rowHeight(headers, true)
      + (firstRow ? rowHeight(firstRow, false) : 0);
    if (y < required) nueva();
    escribir(titulo, true); tablaFila(headers, headers, weights, true);
  };
  const grafico = (section) => {
    const required = section.barras.length * 34 + 35 + envolver(section.nota, normal, 9, maxWidth).length * 15;
    if (y < required + 65) nueva();
    escribir(section.titulo, true);
    const max = Math.max(1, ...section.barras.map((b) => b.valor));
    for (const bar of section.barras) {
      const color = bar.tipo === 'oferta' ? rgb(.09, .47, .44) : bar.tipo === 'presencial' ? rgb(.45, .32, .65) : rgb(.17, .46, .55);
      page.drawText(seguro(bar.etiqueta), { x: margin, y: y - 11, size: 9, font: normal });
      page.drawRectangle({ x: margin + 104, y: y - 18, width: 280, height: 18, color: rgb(.92, .94, .94) });
      page.drawRectangle({ x: margin + 104, y: y - 18, width: 280 * bar.valor / max, height: 18, color });
      const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(bar.valor);
      const moneySize = Math.min(9, 110 * 9 / bold.widthOfTextAtSize(seguro(money), 9));
      page.drawText(seguro(money), { x: margin + 396, y: y - 11, size: moneySize, font: bold });
      y -= 34;
    }
    escribir(section.nota, false, 9); y -= 10;
  };
  const indicadores = (items) => {
    const gap = 10, cardWidth = (maxWidth - gap * (items.length - 1)) / items.length;
    const cards = items.map((item) => ({ label: envolver(item.etiqueta, bold, 8.5, cardWidth - 18),
      value: envolver(item.valor, bold, 16, cardWidth - 18), detail: envolver(item.detalle, normal, 8, cardWidth - 18) }));
    const cardHeight = Math.max(...cards.map((c) => 24 + c.label.length * 11 + c.value.length * 20 + c.detail.length * 10));
    if (y < cardHeight + 80) nueva();
    cards.forEach((c, i) => {
      const x = margin + i * (cardWidth + gap);
      page.drawRectangle({ x, y: y - cardHeight, width: cardWidth, height: cardHeight, color: rgb(.94, .97, .96), borderColor: rgb(.75, .83, .81), borderWidth: .5 });
      let cy = y - 17;
      for (const line of c.label) { page.drawText(line, { x: x + 9, y: cy, size: 8.5, font: bold }); cy -= 11; }
      cy -= 8;
      for (const line of c.value) { page.drawText(line, { x: x + 9, y: cy, size: 16, font: bold, color: rgb(.04, .35, .33) }); cy -= 20; }
      cy -= 4;
      for (const line of c.detail) { page.drawText(line, { x: x + 9, y: cy, size: 8, font: normal }); cy -= 10; }
    });
    y -= cardHeight + 14;
  };
  nueva();
  if (modelo.lecturaCliente) {
    const client = modelo.lecturaCliente;
    escribir('RESUMEN PARA DECIDIR', true, 10); escribir(client.titulo, true, 20);
    escribir(`${client.cliente} · ${client.fecha}`); escribir(client.ufReferencia, false, 9);
    indicadores(client.indicadores);
    if (client.advertencias.length) { escribir('Antes de interpretar los números', true); client.advertencias.forEach((a) => escribir(a, false, 9)); }
    escribir(`Siguiente paso con su asesor: ${client.siguientePaso}`, false, 9); y -= 10;
    for (const section of client.secciones) {
      if (section.tipo === 'grafico') { grafico(section); continue; }
      const weights = section.columnas.length === 5 ? [.28, .14, .14, .14, .30] : section.columnas.length === 4 ? [.28, .25, .25, .22]
        : section.columnas.length === 3 ? [.34, .33, .33] : [.34, .66];
      iniciarTabla(section.titulo, section.columnas, weights, section.filas[0]);
      section.filas.forEach((row) => tablaFila(row, section.columnas, weights));
      y -= 10; escribir(section.nota, false, 9); y -= 10;
    }
    nueva(); escribir('ANEXO TÉCNICO', true, 18); escribir('Cálculos, supuestos y fuentes para revisión del asesor');
  } else escribir(modelo.subtitulo || modelo.titulo, true);
  escribir(modelo.referencia); escribir(modelo.aviso, false, 9);
  for (const section of modelo.secciones) {
    iniciarTabla(section.titulo, ['Información', 'Detalle y cálculo'], [158 / maxWidth, 1 - 158 / maxWidth], section.filas[0]);
    for (const [label, value] of section.filas) fila(label, value);
    y -= 14;
  }
  escribir('© 2026 Todos los derechos reservados · Desarrollado por P. Gallardo');
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`${i + 1} / ${pages.length}`, { x: width - 78, y: 30, size: 8, font: normal }));
  return pdf.save();
}
