import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export function verificarRelease(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'release-manifest.json'), 'utf8'));
  if (manifest.tipo !== 'prevismart-release' || !Array.isArray(manifest.archivos)) throw new Error('Manifest de distribución inválido.');
  const expected = new Set();
  for (const entry of manifest.archivos) {
    if (typeof entry.path !== 'string' || entry.path.split(/[\\/]/).some((p) => p === '..') || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Ruta o hash inválidos en manifest.');
    const path = resolve(root, entry.path);
    if (relative(root, path).startsWith('..') || isAbsolute(relative(root, path)) || !existsSync(path) || lstatSync(path).isSymbolicLink()) throw new Error(`Archivo inválido: ${entry.path}`);
    if (createHash('sha256').update(readFileSync(path)).digest('hex') !== entry.sha256) throw new Error(`Archivo alterado: ${entry.path}`);
    expected.add(entry.path.replace(/\\/g, '/'));
  }
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name), rel = relative(root, path).replace(/\\/g, '/');
      if (entry.isSymbolicLink()) throw new Error(`Enlace inesperado: ${rel}`);
      if (entry.isDirectory()) walk(path);
      else if (rel !== 'release-manifest.json' && !expected.has(rel)) throw new Error(`Archivo no previsto: ${rel}`);
    }
  };
  walk(root);
  if (existsSync(join(root, 'rpa', '.env')) || existsSync(join(root, 'rpa', 'test')) || existsSync(join(root, 'rpa', 'descargas'))) throw new Error('La distribución incluye datos o herramientas no permitidas.');
  return { version: manifest.version, runtime: manifest.runtime, archivos: expected.size, integridad: 'verificada' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'PreviSmart');
  console.log(JSON.stringify(verificarRelease(root), null, 2));
}
