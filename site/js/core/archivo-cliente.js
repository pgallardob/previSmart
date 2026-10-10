export function carpetaCliente(cliente) {
  if (!cliente || typeof cliente.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(cliente.id)) throw new Error('Identificador de cliente inválido.');
  const name = String(cliente.nombre || 'Cliente').normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 72).trim() || 'Cliente';
  return `Cliente-${name}-${cliente.id}`;
}
export function nombreArchivoCliente(cliente) { return `${carpetaCliente(cliente)}.prevismart.json`; }

export async function guardarArchivoCliente(carpeta, cliente, json, confirmar = async () => false, vigente = () => true) {
  const comprobar = () => { if (!vigente()) throw new Error('Guardado cancelado: no se completó la escritura del archivo.'); };
  comprobar();
  const env = JSON.parse(json);
  const b64 = (v) => typeof v === 'string' && v.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(v);
  if (env?.tipo !== 'prevismart-cliente-cifrado' || env.version !== 1 || env.algoritmo !== 'AES-256-GCM' || env.kdf !== 'PBKDF2-SHA256' || env.iterations !== 600000
      || !b64(env.salt) || atob(env.salt).length !== 16 || !b64(env.iv) || atob(env.iv).length !== 12 || !b64(env.ciphertext) || env.ciphertext.length < 24
      || Object.keys(env).some((k) => !['tipo', 'version', 'algoritmo', 'kdf', 'iterations', 'salt', 'iv', 'ciphertext'].includes(k))) throw new Error('Solo se guardan archivos de cliente cifrados.');
  const raiz = await carpeta.getDirectoryHandle('respaldos', { create: true });
  const nombre = carpetaCliente(cliente);
  const destino = await raiz.getDirectoryHandle(nombre, { create: true });
  comprobar();
  let anterior;
  try { anterior = await destino.getFileHandle('expediente.prevismart.json'); }
  catch (error) { if (error.name !== 'NotFoundError') throw error; }
  if (anterior && !(await confirmar())) throw new Error('Guardado cancelado: el archivo anterior se conserva.');
  comprobar();
  const archivo = anterior || await destino.getFileHandle('expediente.prevismart.json', { create: true });
  const writer = await archivo.createWritable();
  try { comprobar(); await writer.write(json); comprobar(); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
  if (await (await archivo.getFile()).text() !== json) throw new Error('No se pudo verificar el archivo cifrado guardado.');
  return `respaldos/${nombre}/expediente.prevismart.json`;
}
