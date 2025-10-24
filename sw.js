// ======================================================
// CONFIGURACIÓN
// ======================================================
const CACHE_NAME = 'cocktail-pwa-v4';
const DYNAMIC_CACHE = 'cocktail-dynamic-v2';

console.log('PWA: Service Worker iniciado.');

// App Shell (recursos precache)
const appShellAssets = [
  './',
  './index.html',
  './main.js',
  './styles/main.css',
  './scripts/app.js'
];

// JSON de fallback para API cuando no hay red
const OFFLINE_COCKTAIL_JSON = {
  drinks: [{
    idDrink: "00000",
    strDrink: "¡Sin Conexión!",
    strTags: "FALLBACK",
    strCategory: "Desconectado",
    strInstructions: "No pudimos obtener resultados. Intenta conectarte de nuevo.",
    strDrinkThumb: "https://via.placeholder.com/200x300?text=OFFLINE",
    strIngredient1: "Service Worker",
    strIngredient2: "Fallback JSON"
  }]
};

// ======================================================
// INSTALL & ACTIVATE
// ======================================================
self.addEventListener('install', event => {
  console.log('[SW] Instalando y precacheando App Shell...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(appShellAssets))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activado. Limpiando caches viejos...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ======================================================
// FETCH
// ======================================================
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  console.log('[SW] Interceptando:', requestUrl.href);

  // --- 1️⃣ App Shell: Cache Only ---
  const isAppShellRequest = appShellAssets.some(asset =>
    requestUrl.pathname === asset || requestUrl.pathname === asset.substring(1)
  );

  if (isAppShellRequest) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          console.log('[SW] App Shell desde cache:', requestUrl.pathname);
          return response || new Response('App Shell Missing', { status: 500 });
        })
    );
    return;
  }

  // --- 2️⃣ API de cócteles: usar proxy + fallback ---
  if (requestUrl.host.includes('thecocktaildb.com')) {
    // Usar proxy CORS para permitir cache en GitHub Pages
    const proxyURL = `https://corsproxy.io/?${encodeURIComponent(requestUrl.href)}`;
    const proxiedRequest = new Request(proxyURL);

    event.respondWith(
      fetch(proxiedRequest)
        .then(response => {
          if (!response || (!response.ok && response.type !== 'opaque')) {
            throw new Error('Respuesta inválida o CORS bloqueado');
          }
          const clonedResp = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clonedResp));
          console.log('[SW] Respuesta de API guardada en caché.');
          return response;
        })
        .catch(err => {
          console.warn('[SW] Error o sin conexión:', err);
          return caches.match(event.request)
            .then(cachedResp => cachedResp || new Response(JSON.stringify(OFFLINE_COCKTAIL_JSON), {
              headers: { 'Content-Type': 'application/json' }
            }));
        })
    );
    return;
  }

  // --- 3️⃣ Otros requests: Cache First con fallback a red ---
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('[SW] Cache hit para:', requestUrl.href);
          return response;
        }
        console.log('[SW] Fetch desde red:', requestUrl.href);
        return fetch(event.request)
          .then(networkResp => {
            if (networkResp.ok) {
              const cloned = networkResp.clone();
              caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, cloned));
            }
            return networkResp;
          })
          .catch(() => {
            console.warn('[SW] No se pudo obtener ni de red ni de cache.');
            return new Response('Recurso no disponible offline', { status: 404 });
          });
      })
  );
});
