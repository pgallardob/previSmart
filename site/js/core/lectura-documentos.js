import { validarPDF } from './documentos.js';
import { extraerPaginasPDF } from './pdf.js';
import { esSCOMP, esCertificadoSaldo, parsearSCOMP } from './parse-scomp.js';
import { parsearCertSaldo } from './parse-certsaldo.js';
import { esAntecedenteAFP, parsearAntecedentes } from './parse-antecedentes.js';

/** One offline extraction pass per PDF, shared by upload and RPA download batches. */
export async function leerDocumento(archivo, tipoDoc) {
  await validarPDF(archivo);
  const paginas = await extraerPaginasPDF(archivo);
  const texto = paginas.map((ls) => ls.map((l) => l.partes.map((p) => p.s).join(' ')).join('\n')).join('\n');
  if (/\bSIMULACI[OÓ]N\b[\s\S]{0,100}(?:documento de prueba|no es un certificado oficial)|\bdocumento\s+simulado\b/i.test(texto)) {
    throw new Error('Documento de simulación: no se importa como información oficial en un expediente de producción.');
  }
  if (esSCOMP(texto)) return { tipo: 'scomp', tipoDoc: 'certificado-ofertas', ...parsearSCOMP(texto, paginas) };
  if (esAntecedenteAFP(texto)) return parsearAntecedentes(texto);
  if (esCertificadoSaldo(texto) || tipoDoc === 'cartola-resumen' || /cartola\s+(resumen|cuatrimestral)/i.test(texto)) {
    return { tipo: 'saldo', tipoDoc: esCertificadoSaldo(texto) ? 'certificado-saldo' : 'cartola-resumen', ...parsearCertSaldo(texto), esCartola: !esCertificadoSaldo(texto) };
  }
  return null;
}
