const CACHE_NAME = 'american-pos-v4.2.2-modular';

// Assets to cache immediately on install (App Shell)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './login.html',
    './manifest.json',
    './img/logo-monitor-new.png',
    './js/app-v421.js',
    './js/auth.js',
    './js/api.js',
    './js/db.js',
    './js/config.js',
    './js/pos.v4.js',
    './js/products.js',
    './js/dashboard.js',
    './js/sales.js',
    './js/settings.js',
    './js/customers.js',
    './js/debug.js',
    './js/utils.js',
    './js/ui.js',
    './js/sounds.js',
    './js/swipe-manager.js',
    './js/utils/boot.js',
    './js/utils/theme.js',
    './js/utils/ui-utils.js',
    './js/components/ComponentLoader.js',
    './components/AdminModals.html',
    './components/CheckoutModals.html',
    './components/CashModals.html',
    './components/UtilityModals.html',
    './js/modules/pos/CartManager.js',
    './js/modules/pos/SalesManager.js',
    './js/modules/pos/CustomerManager.js',
    './js/modules/pos/ProductManager.js',
    './js/modules/pos/CheckoutManager.js',
    './js/modules/pos/ReceiptManager.js',
    './js/modules/pos/WeightModal.js',
    './js/modules/pos/Scanner.js',
    './js/modules/pos/CashControlManager.js',
    './js/modules/pos/RefundManager.js',
    './js/modules/admin/UsersManager.js',
    './js/modules/dashboard/CustomersView.js',
    './js/modules/dashboard/SuppliersView.js',
    './js/modules/dashboard/PurchaseOrdersView.js',
    // Local Assets
    './css/main.css',
    './css/fonts.css',
    './css/toastify.min.css',
    './js/libs/chart.js',
    './js/libs/html5-qrcode.min.js',
    './js/libs/xlsx.full.min.js',
    './js/libs/toastify.js'
];

// Install Event - Pre-cache critical assets
self.addEventListener('install', (event) => {
    console.log(`[SW ${CACHE_NAME}] Installing...`);
    // Force this SW to become the active one for all clients
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log(`[SW ${CACHE_NAME}] Caching app shell`);
            // Cache files individually to avoid failing if one is missing
            const cachePromises = ASSETS_TO_CACHE.map(async (url) => {
                try {
                    await cache.add(url);
                    console.log(`[SW ${CACHE_NAME}] Cached: ${url}`);
                } catch (error) {
                    console.warn(`[SW ${CACHE_NAME}] Failed to cache ${url}:`, error);
                }
            });
            await Promise.allSettled(cachePromises);
            console.log(`[SW ${CACHE_NAME}] Cache complete`);
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

    // 0. Ignore non-http/https requests (chrome-extension, etc.)
    if (!requestUrl.protocol.startsWith('http')) {
        return; // Let browser handle these normally
    }

    // 1. API Requests: NETWORK ONLY
    // We never want to cache API responses (sales, users, products data)
    // because we need fresh data and consistency.
    // Also exclude root-level API routes common in this app
    const apiPaths = ['/api/', '/products', '/sales', '/users', '/dashboard', '/suppliers', '/purchase-orders', '/cash', '/reports', '/sync'];
    const isApi = apiPaths.some(path => requestUrl.pathname.startsWith(path));

    if (isApi) {
        return; // Browser performs default network request
    }



    // 1.6. Ignore non-GET requests (POST, PUT, DELETE, etc.)
    // Cache API only supports GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // 2. Images: CACHE FIRST, fallback to Network
    if (event.request.destination === 'image' || requestUrl.href.includes('/product_images/')) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    // Cache the new image for next time
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache).catch(e => console.warn('Cache error', e));
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

    // 3. HTML and JS files: STALE-WHILE-REVALIDATE (Optimized for Mobile Speed)
    // Serve from cache immediately, update in background.
    if (event.request.destination === 'document' || requestUrl.pathname.endsWith('.html') || requestUrl.pathname.endsWith('.js')) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
                const fetchPromise = fetch(event.request, { redirect: 'follow' }).then((networkResponse) => {
                    // Don't cache redirected responses or opaque responses
                    if (networkResponse && networkResponse.status === 200 &&
                        networkResponse.type === 'basic' && !networkResponse.redirected) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache).catch(e => console.warn('Cache error', e));
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fail silently, we have cachedResponse
                    return cachedResponse;
                });

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 4. Other Static Assets (CSS, fonts, etc.): STALE-WHILE-REVALIDATE
    // Serve from cache immediately, but update cache from network in background
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache with new version
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache).catch(e => console.warn('Cache error', e));
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
