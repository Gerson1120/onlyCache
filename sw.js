// ======================================================
// Service Worker - Only Cache Cocktails
// Estrategia: App Shell (Cache Only) + Network First con Fallback
// ======================================================

const CACHE_NAME = 'cocktail-pwa-v3';

// Archivos del App Shell (solo se sirven desde caché)
const APP_SHELL_ASSETS = [
  'https://gerson1120.github.io/onlyCache/',
  'https://gerson1120.github.io/onlyCache/index.html',
  'https://gerson1120.github.io/onlyCache/main.js',
  'https://gerson1120.github.io/onlyCache/styles/main.css',
  'https://gerson1120.github.io/onlyCache/scripts/app.js',
  'https://gerson1120.github.io/onlyCache/images/offline.jpg'
];

// ======================================================
// INSTALACIÓN
// ======================================================
self.addEventListener('install', event => {
  console.log('SW: Instalando y almacenando App Shell...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ======================================================
// ACTIVACIÓN
// ======================================================
self.addEventListener('activate', event => {
  console.log('SW: Activado');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ======================================================
// FETCH
// ======================================================
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1️⃣ Si es parte del App Shell → Cache Only
  if (APP_SHELL_ASSETS.includes(req.url)) {
    event.respondWith(caches.match(req));
    return;
  }

  // 2️⃣ Si es de la API de cócteles → Network First con fallback
  if (url.origin.includes('www.thecocktaildb.com')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3️⃣ Resto de peticiones → Cache First con fallback offline
  event.respondWith(cacheFirst(req));
});

// ======================================================
// Estrategias de caché
// ======================================================
async function cacheFirst(req) {
  const cacheResponse = await caches.match(req);
  return cacheResponse || fetch(req).catch(() => caches.match('https://gerson1120.github.io/onlyCache/images/offline.jpg'));
}

async function networkFirst(req) {
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await caches.match(req);
    return cached || caches.match('https://gerson1120.github.io/onlyCache/images/offline.jpg');
  }
}
