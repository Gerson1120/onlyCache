// --- Nuevas constantes de configuración ---
const REPO_NAME = 'onlyCache'; 
const BASE_PATH = `/${REPO_NAME}`; 
// ------------------------------------------


self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    console.log('[SW] Interceptando:', requestUrl.href);

    // --- Lógica para normalizar la ruta del App Shell (manejo de /onlyCache/) ---

    let normalizedPath = requestUrl.pathname;
    
    // 1. Eliminar el prefijo del repositorio de la ruta solicitada
    if (normalizedPath.startsWith(BASE_PATH)) {
        normalizedPath = normalizedPath.substring(BASE_PATH.length);
    }
    
    // 2. Normalizar la ruta raíz
    if (normalizedPath === '/' || normalizedPath === '') {
        normalizedPath = './';
    } else if (normalizedPath.startsWith('/')) {
        // Eliminar el '/' inicial (ej: '/index.html' -> 'index.html')
        normalizedPath = normalizedPath.substring(1);
    }
    
    // 3. Comparar con los assets precacheados
    const isAppShellRequest = appShellAssets.some(asset => {
        // Normalizar el asset precacheado (ej: './index.html' -> 'index.html', o si es la raíz, './')
        const assetForComparison = (asset === './') ? asset : asset.startsWith('./') ? asset.substring(2) : asset;
        
        return normalizedPath === assetForComparison;
    });

    // -------------------------------------------------------------------------
    
    // 1. Manejo del App Shell (Cache Only)
    if (isAppShellRequest) {
        event.respondWith(
            // Intentamos hacer match con la Request URL original (que contiene /onlyCache/), 
            // que es lo que el navegador pasa al Service Worker.
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        console.log('[SW] App Shell desde cache:', requestUrl.pathname);
                        return response;
                    }
                    
                    // Si falla el match con la URL completa, el problema puede ser cómo se precacheó.
                    // En ese caso, se necesita un nuevo precacheo con las URLs correctas.
                    // Por ahora, devolvemos un error para indicar que el activo precacheado falló.
                    console.error('[SW] FALLO: No se encontró App Shell en cache para:', requestUrl.pathname);
                    return new Response('App Shell Missing', { status: 500 });
                })
        );
        return;
    }

    // 2. Manejo de la API (Network, luego Cache, con Fallback JSON) - SIN CAMBIOS AQUÍ
    if (requestUrl.host.includes('thecocktaildb.com') && requestUrl.pathname.includes('/search.php')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    
                    if (!response || (!response.ok && response.type !== 'opaque')) {
                        throw new Error('Respuesta inválida o CORS bloqueado');
                    }

                    const clonedResp = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clonedResp));

                    console.log('[SW] Respuesta API guardada en cache dinámica.');
                    return response;
                })
                .catch(err => {
                    console.warn('[SW] Error de red o sin conexión:', err);
                    return caches.match(event.request) 
                        .then(cachedResp => {
                            if (cachedResp) {
                                console.log('[SW] Devolviendo respuesta cacheada de la API.');
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
    
    // 3. Manejo de otros assets (Cache, luego Network con Cache Dinámica) - SIN CAMBIOS AQUÍ
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