const CACHE_NAME = 'cocktail-pwa-v3';
const DYNAMIC_CACHE = 'cocktail-dynamic-v1';

console.log('PWA: Service Worker iniciado.');

const appShellAssets = [
    './',
    './index.html',
    './main.js',
    './styles/main.css',
    './scripts/app.js'
];

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

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    console.log('[SW] Interceptando:', requestUrl.href);

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

    if (requestUrl.host.includes('thecocktaildb.com') && requestUrl.pathname.includes('/search.php')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    
                    if (!response || (!response.ok && response.type !== 'opaque')) {
                        throw new Error('Respuesta inválida o CORS bloqueado');
                    }

                    
                    const clonedResp = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clonedResp));

                    console.log('[SW] Respuesta guardada en cache dinámica.');
                    return response;
                })
                .catch(err => {
                    console.warn('[SW] Error de red o sin conexión:', err);
                    return caches.match(event.request)
                        .then(cachedResp => {
                            if (cachedResp) {
                                console.log('[SW] Devolviendo respuesta cacheada.');
                                return cachedResp;
                            } else {
                                console.log('[SW] Devolviendo JSON de fallback.');
                                return new Response(JSON.stringify(OFFLINE_COCKTAIL_JSON), {
                                    headers: { 'Content-Type': 'application/json' }
                                });
                            }
                        });
                })
        );
        return;
    }

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
