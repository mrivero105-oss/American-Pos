const CACHE_NAME = 'american-pos-v218';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './js/app.js',
    './js/api.js',
    './js/pos.v4.js',
    './js/products.js',
    './js/ui.js',
    './js/utils.js',
    './assets/logo.jpg',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/html5-qrcode'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force immediate activation
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Take control of all clients immediately
        })
    );
});

self.addEventListener('fetch', (event) => {
    // For API requests, try network first, falling back to nothing (or handle offline gracefully)
    if (event.request.url.includes('/api/') || event.request.url.includes('american-pos-backend.pages.dev')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response;

            // Use event.request.url to avoid "redirected response" error on navigation
            return fetch(event.request.url).then(networkResponse => {
                // Check if we received a redirected response
                if (networkResponse.redirected) {
                    // Create a new response to "clean" the redirected status
                    const cleanResponse = new Response(networkResponse.body, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: networkResponse.headers
                    });
                    return cleanResponse;
                }
                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // Take control of all clients immediately
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            return caches.delete(cache);
                        }
                    })
                );
            })
        ])
    );
});
