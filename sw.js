const CACHE_NAME = 'american-pos-v394-offline';

// Assets to cache immediately on install (App Shell)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './login.html',
    './manifest.json',
    './js/app.js',
    './js/auth.js',
    './js/api.js',
    './js/config.js',
    './js/pos.v4.js',
    './js/products.js',
    './js/debug.js',
    './js/modules/pos/CartManager.js',
    './js/modules/pos/SalesManager.js',
    './js/modules/pos/CustomerManager.js',
    './js/modules/pos/ProductManager.js',
    './js/modules/admin/UsersManager.js',
    // Add other critical modules here if needed
];

// Install Event - Pre-cache critical assets
self.addEventListener('install', (event) => {
    console.log(`[SW ${CACHE_NAME}] Installing...`);
    // Force this SW to become the active one for all clients
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(`[SW ${CACHE_NAME}] Caching app shell`);
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    console.log(`[SW ${CACHE_NAME}] Activating...`);
    event.waitUntil(
        Promise.all([
            self.clients.claim(), // Take control of all clients immediately
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log(`[SW ${CACHE_NAME}] Deleting old cache: ${cache}`);
                            return caches.delete(cache);
                        }
                    })
                );
            })
        ])
    );
});

// Fetch Event - The Brains of the Offline Operation
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // 1. API Requests: NETWORK ONLY
    // We never want to cache API responses (sales, users, products data)
    // because we need fresh data and consistency.
    if (requestUrl.pathname.startsWith('/api/') || requestUrl.href.includes('/api/')) {
        return; // Browser performs default network request
    }

    // 2. Images: CACHE FIRST, fallback to Network
    if (event.request.destination === 'image' || requestUrl.href.includes('/product_images/')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    // Cache the new image for next time
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fallback image if both fail
                    // You might want to return a placeholder SVG here
                    return new Response('<svg>...</svg>', { headers: { 'Content-Type': 'image/svg+xml' } });
                });
            })
        );
        return;
    }

    // 3. HTML and JS files: NETWORK FIRST! (Critical for updates!)
    // This ensures users always get the latest code when online.
    if (event.request.destination === 'document' || requestUrl.pathname.endsWith('.html') || requestUrl.pathname.endsWith('.js')) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                // Cache the new version for offline use
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Network failed, fallback to cache
                return caches.match(event.request);
            })
        );
        return;
    }

    // 4. Other Static Assets (CSS, fonts, etc.): STALE-WHILE-REVALIDATE
    // Serve from cache immediately, but update cache from network in background
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache with new version
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Network failed, nothing to do (we already have cachedResponse)
            });

            // Return cached response if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
