/* PreviSmart â€” Service Worker
   Estrategia: precache del app shell; network-first con timeout para la API de UF;
   cache-first para el resto de recursos propios. */

const VERSION = 'prevismart-1.3.59-2026.10.13-informe-cliente-sin-anexo-tecnico';
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `rt-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/vendor/pico.min.css',
  './css/tokens.css',
  './css/pico.overrides.css',
  './css/base.css',
  './css/components.css',
  './css/print.css',
  './js/app.js',
  './js/core/format.js',
  './js/core/uf.js',
  './js/data/uf-referencia.js',
  './js/core/dates.js',
  './js/core/parametros-normativos.js',
  './js/features/parametros-normativos.js',
  './js/core/store.js',
  './js/core/actividad.js',
  './js/core/operacion.js',
  './js/core/propuesta.js',
  './js/core/autorizacion.js',
  './js/core/retencion.js',
  './js/core/asesor.js',
  './js/core/archivo-cliente.js',
  './js/features/archivo-cliente.js',
  './js/core/privacidad.js',
  './js/features/privacidad.js',
  './js/features/autorizacion.js',
  './js/data/portales-afp.js',
  './js/core/elegibilidad.js',
  './js/core/beneficios.js',
  './js/core/ofertas.js',
  './js/core/liquida.js',
  './js/core/calculos.js',
  './js/core/consolidacion-scomp.js',
  './js/features/consolidacion-scomp.js',
  './js/core/cnu.js',
  './js/core/cnu-familia.js',
  './js/core/simulacion-rp.js',
  './js/core/simulacion-sobrevivencia-rp.js',
  './js/features/sobrevivencia-rp.js',
  './js/core/proyeccion-rp.js',
  './js/features/proyeccion-rp.js',
  './js/data/tm2020.js',
  './js/core/informe-calculos.js',
  './js/core/informe-cliente.js',
  './js/core/preparacion-aseguradoras.js',
  './js/data/perfiles-aseguradoras.js',
  './js/features/preparacion-aseguradoras.js',
  './js/core/informe-pdf.js',
  './js/features/informe-calculos.js',
  './vendor/pdf-lib/pdf-lib.min.js',
  './js/core/router.js',
  './js/core/respaldo.js',
  './js/core/respaldo-integral.js',
  './js/data/modulos.js',
  './js/data/semilla.js',
  './js/core/integracion.js',
  './js/core/ingesta.js',
  './js/core/lectura-documentos.js',
  './js/core/aseguradoras.js',
  './js/data/aseguradoras.js',
  './js/core/documentos.js',
  './js/core/pdf.js',
  './js/core/parse-scomp.js',
  './js/core/parse-certsaldo.js',
  './js/core/parse-antecedentes.js',
  './js/core/version.js',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  /* OCR local (Tesseract.js) — el worker elige el core simd-lstm en
     navegadores modernos; las otras variantes quedan en cache runtime. */
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/spa.traineddata',
  './vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/tesseract-core-simd-lstm.wasm',
  './views/captura.html',
  './js/data/feriados.js',
  './js/data/normativa-2026.js',
  './js/data/ruta.js',
  './js/data/checklist.js',
  './js/data/glosario.js',
  './js/ui/dialog.js',
  './js/ui/toast.js',
  './js/features/panel.js',
  './js/features/captura.js',
  './js/features/perfil.js',
  './js/features/elegibilidad.js',
  './js/features/beneficios.js',
  './js/features/modalidades.js',
  './js/features/ofertas.js',
  './js/features/liquida.js',
  './js/features/sobrevivencia.js',
  './js/features/ruta.js',
  './js/features/checklist.js',
  './js/features/reporte.js',
  './js/features/glosario.js',
  './js/features/ajustes.js',
  './views/panel.html',
  './views/perfil.html',
  './views/elegibilidad.html',
  './views/beneficios.html',
  './views/modalidades.html',
  './views/ofertas.html',
  './views/liquida.html',
  './views/sobrevivencia.html',
  './views/ruta.html',
  './views/checklist.html',
  './views/reporte.html',
  './views/glosario.html',
  './views/ajustes.html',
  './views/guia-estilos.html',
  './assets/fonts/inter-latin-wght-normal.woff2',
  './assets/fonts/fraunces-latin-full-normal.woff2',
  './assets/icons/sprite.svg',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png'
];

const UF_API_HOST = 'mindicador.cl';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => (k.startsWith('shell-prevismart-') || k.startsWith('rt-prevismart-')) && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.tipo === 'APLICAR_ACTUALIZACION') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.endsWith('/__prevismart/health') || /prevismart-(cartera|expedientes)/i.test(url.pathname)) return;

  /* El documento (index.html) va red-primero: asÃ­ una versiÃ³n nueva del
     SW sirve la pÃ¡gina fresca en la PRIMERA recarga, sin la doble recarga
     de la transiciÃ³n. */
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // Indicadores econÃ³micos: red primero. El timeout de 12s es solo un
  // respaldo: quien gobierna la espera es el abort de la pÃ¡gina (6s).
  // Un corte mÃ¡s corto aquÃ­ mataba conexiones lentas-reales (TLS frÃ­o,
  // antivirus, VPN) y declaraba "sin conexiÃ³n" un dato que sÃ­ llegaba.
  if (url.hostname === UF_API_HOST) {
    event.respondWith(networkFirstConTimeout(request, 12000));
    return;
  }

  // Resto: solo recursos propios.
  if (url.origin !== self.location.origin) return;
  event.respondWith(cacheFirst(request));
});

async function networkFirstDocument(request) {
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, respuesta.clone());
    }
    return respuesta;
  } catch {
    const enCache = await caches.match(request, { ignoreSearch: true });
    return enCache || new Response('Sin conexiÃ³n', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function networkFirstConTimeout(request, ms) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const respuesta = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
    if (respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const guardada = await cache.match(request);
    if (guardada) {
      const headers = new Headers(guardada.headers);
      headers.set('X-PreviSmart-Cache', 'stale');
      return new Response(guardada.body, { status: guardada.status, headers });
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirst(request) {
  const enCache = await caches.match(request, { ignoreSearch: request.destination === 'document' });
  if (enCache) return enCache;
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok && !/no-store/i.test(respuesta.headers.get('Cache-Control') || '')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, respuesta.clone());
    }
    return respuesta;
  } catch {
    if (request.mode === 'navigate') {
      const inicio = await caches.match('./index.html');
      if (inicio) return inicio;
    }
    return Response.error();
  }
}
