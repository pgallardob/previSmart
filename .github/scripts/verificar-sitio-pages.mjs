import { verificarRelease } from './verificar-release.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export function verificarSitioPages(root) {
  const result = verificarRelease(root);
  const manifest = JSON.parse(readFileSync(resolve(root, 'release-manifest.json'), 'utf8'));
  const top = new Set(['index.html', 'service-worker.js', 'manifest.webmanifest', 'THIRD_PARTY_NOTICES.md']);
  for (const entry of manifest.archivos) {
    const parts = entry.path.split(/[\\/]/);
    if (parts.some((p) => p.startsWith('.') || /^prevismart-(cartera|cliente|expedientes|autorizacion|gestion)/i.test(p)
      || ['rpa', 'descargas', 'respaldo', 'respaldos', 'node_modules'].includes(p) || p.endsWith('.prevismart.json') || p.endsWith('.log') || /\.(pdf|exe|pfx|p12|pem|key)$/i.test(p))) throw new Error('El sitio contiene un archivo privado o no publicable.');
    const allowed = parts.length === 1 ? top.has(parts[0]) : ['assets', 'css', 'js', 'views', 'vendor'].includes(parts[0]) || ['docs/INSTALACION_INDIVIDUAL.md', 'docs/GITHUB_PAGES.md', 'docs/PROCEDIMIENTO_PRIVACIDAD.md', 'docs/ESTADO_ENTREGA.md', 'docs/PARAMETROS_CALCULO.md',
      'docs/SIMULACION_RP.md', 'docs/CNU_FAMILIAS.md', 'docs/SOBREVIVENCIA_RP.md', 'docs/PROYECCION_HIPOTETICA.md', 'docs/ASEGURADORAS_PREPARACION.md', 'docs/CONSOLIDACION_SCOMP.md', 'docs/DOCUMENTO_CLIENTE.md'].includes(entry.path);
    if (!allowed) throw new Error('El sitio contiene contenido fuera de la distribución estática permitida.');
  }
  for (const required of ['index.html', 'manifest.webmanifest', 'service-worker.js']) if (!manifest.archivos.some((entry) => entry.path === required)) throw new Error('Distribución PWA incompleta.');
  if (result.runtime !== 'navegador') throw new Error('Solo se admite la distribución web, no el ejecutable Windows.');
  return { ...result, contieneDatosClientes: false, publicadoEnInternet: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verificarSitioPages(resolve(process.argv[2] || 'site')), null, 2));
