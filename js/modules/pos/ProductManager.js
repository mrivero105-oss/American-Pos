import { api } from '../../api.js?v=debug3';
import { formatBs, currencySettings } from '../../utils.js';
import { ui } from '../../ui.js';
import { getImageUrl } from '../../config.js';

console.log('!!! ProductManager.js MODULE LOADED !!!');

// Module-level variable to enforce singleton listener
let globalKeyDownHandler = null;

export class ProductManager {
    constructor(pos) {
        this.pos = pos;
        this.currentPage = 1;
        this.itemsPerPage = 48;
        this.apiLimit = 48; // API Pagination Limit
        this.currentFilteredProducts = [];
        this.highlightedIndex = -1;
        this.fetchRequestId = 0;
        this.bindEvents();
    }

    bindEvents() {
        // Remove existing listener if any (handles re-instantiation or hot-reload)
        if (globalKeyDownHandler) {
            document.removeEventListener('keydown', globalKeyDownHandler);
        }

        // Define the handler
        globalKeyDownHandler = (e) => {
            // Ignore if user is typing in an input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

            // Ignore if NOT in POS view
            const posView = document.getElementById('view-pos');
            if (!posView || posView.classList.contains('hidden')) return;

            if (e.key && e.key.startsWith('Arrow')) {
                e.preventDefault();
                e.stopPropagation(); // Stop bubbling
                this.moveHighlight(e.key);
            } else if (e.key === 'Enter') {
                if (this.highlightedIndex !== -1) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectHighlightedProduct();
                }
            } else if (e.key === 'Escape') {
                this.highlightedIndex = -1;
                this.renderProducts(this.currentFilteredProducts);
            } else if (['+', '=', 'NumpadAdd'].includes(e.key)) { // + or Shift+=
                // Increase Quantity
                if (this.highlightedIndex !== -1) {
                    e.preventDefault();
                    // Just call selectHighlightedProduct which handles adding and visual feedback.
                    // Previously we were calling addToCart AND selectHighlightedProduct, causing duplication.
                    this.selectHighlightedProduct();
                }
            } else if (['-', '_', 'NumpadSubtract'].includes(e.key)) { // - or Shift+_
                // Decrease Quantity
                if (this.highlightedIndex !== -1) {
                    e.preventDefault();
                    const product = this.currentFilteredProducts[this.highlightedIndex];
                    if (product) {
                        const existingItem = this.pos.cart.find(item => item.id === product.id);
                        if (existingItem) {
                            if (existingItem.quantity > 1) {
                                existingItem.quantity--;
                                this.pos.cartManager.renderCart();
                            } else {
                                // Remove if quantity is 1
                                this.pos.cart = this.pos.cart.filter(item => item.id !== product.id);
                                this.pos.cartManager.renderCart();
                            }
                            // Visual feedback
                            const el = document.getElementById(`product-card-${this.highlightedIndex}`);
                            if (el) {
                                el.classList.add('ring-red-500', 'scale-95');
                                setTimeout(() => el && el.classList.remove('ring-red-500', 'scale-95'), 200);
                            }
                        }
                    }
                }
            }
        };

        // Add the new listener
        document.addEventListener('keydown', globalKeyDownHandler);
    }

    async loadProductsV2() {
        if (this.isInitializing) {
            console.log('POS: ProductManager already initializing, skipping...');
            return;
        }
        this.isInitializing = true;
        console.log('APP: ProductManager.loadProductsV2() CALLED - CACHE BUSTED');

        // Reset State
        this.apiPage = 1;
        this.apiLimit = 50;
        this.isLoading = false;
        this.hasMore = true;
        this.allLoadedProducts = [];
        this.pos.products = [];

        // CACHE DISABLED FOR DEBUGGING
        /*
        // Try to load from cache first for instant display
        const cachedProducts = localStorage.getItem('pos_products_cache');
        const cachedCategories = localStorage.getItem('pos_categories_cache');
        
        if (cachedProducts) { ... } 
        */

        // No cache - load normally with skeletons
        console.log('APP: Accessing Product Grid for Skeletons:', this.pos.dom.productGrid);
        // FORCE CLEAR CACHE for this debug session to ensure fresh start
        localStorage.removeItem('pos_products_cache');
        console.log('APP: Cache cleared for debug.');

        if (this.pos.dom.productGrid) {
            console.log('APP: Grid classes:', this.pos.dom.productGrid.className);
            this.pos.dom.productGrid.innerHTML = '';
            this.renderSkeletons();
        } else {
            console.error('POS: productGrid invalid in loadProducts');
        }

        try {
            await this.fetchProductsPage(this.apiPage);
            // Setup Infinite Scroll
            this.setupIntersectionObserver();
        } finally {
            this.isInitializing = false;
        }

        // Initialize Quick Favorites (Non-blocking)
        this.loadQuickFavorites();
    }

    async refreshProductsInBackground() {
        console.log('POS: Background refresh starting...');
        try {
            // Fetch all products silently
            const response = await api.products.getAll(1, 0); // Get all products (0 = unlimited)
            let products = [];

            if (Array.isArray(response)) {
                products = response;
            } else if (response.products) {
                products = response.products;
            }

            if (products.length > 0) {
                // Update cache safely
                // CACHE DISABLED COMPLETELY TO PREVENT CRASHES
                /*
                try {
                    localStorage.setItem('pos_products_cache', JSON.stringify({
                        products: products,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn('LocalStorage Quota Exceeded. Clearing old cache and retrying.', e);
                    try {
                        // Clear potentially large items
                        localStorage.removeItem('pos_products_cache');
                        localStorage.removeItem('pos_categories_cache');
                        // Maybe try setting again or just skip caching for this session
                    } catch (clearErr) {
                        console.error('Failed to clear cache:', clearErr);
                    }
                }
                */

                // Fetch categories too
                const stats = await api.products.getCategories();
                try {
                    localStorage.setItem('pos_categories_cache', JSON.stringify(stats));
                } catch (e) {
                    console.warn('Failed to cache categories:', e);
                }

                // Update local state
                this.allLoadedProducts = products;
                this.pos.products = products;
                this.categoryStats = stats.counts || {};
                this.categoryStatsTotal = stats.total || 0;

                // Re-render if no filter active
                if (!this.activeQuery && !this.activeCategory) {
                    this.renderProducts(products, false);
                }
                this.renderCategories();

                console.log('POS: Background refresh complete');
            }
        } catch (e) {
            console.warn('Background refresh failed:', e);
        }
    }

    renderSkeletons() {
        const skeletonCount = 12; // Show enough to fill the initial view
        const skeletons = Array(skeletonCount).fill(0).map((_, index) => `
            <div class="product-card rounded-xl border-2 border-transparent bg-white dark:bg-slate-800 p-0 animate-pulse">
                <div class="aspect-square bg-slate-200 dark:bg-slate-700 rounded-xl m-1"></div>
                <div class="p-2 flex flex-col gap-2">
                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                </div>
            </div>
        `).join('');
        this.pos.dom.productGrid.innerHTML = skeletons;
    }

    async fetchProductsPage(page, force = false) {
        if (this.isLoading && !force) {
            console.log(`POS: fetchProductsPage(${page}) blocked - already loading`);
            return;
        }

        const currentRequestId = ++this.fetchRequestId;
        this.isLoading = true;
        this.showLoadingSentinel(true);

        try {
            console.log(`APP: [DEBUG] Fetching products page ${page} (Category: ${this.activeCategory}, Search: ${this.activeQuery})`);

            // Pass filters to API
            const response = await api.products.getAll(
                page,
                this.apiLimit,
                this.activeCategory,
                this.activeQuery
            );

            console.log('APP: [DEBUG] API Response received:', response);
            console.log('APP: [DEBUG] Type of response:', typeof response);
            console.log('APP: [DEBUG] Is Array?', Array.isArray(response));

            // Race Condition Check: If a newer request started, abort this one
            if (currentRequestId !== this.fetchRequestId) {
                console.log(`POS: Request ${currentRequestId} aborted by newer request ${this.fetchRequestId}`);
                return;
            }

            // Handle new response structure OR legacy array
            let products = [];
            let totalPages = 1;

            if (Array.isArray(response)) {
                // Legacy / All mode
                products = response;
                this.hasMore = false; // Loaded everything
            } else {
                // New Pagination Mode
                products = response.products || [];
                totalPages = response.totalPages || 1;
                this.hasMore = page < totalPages;
            }

            if (page === 1) {
                // Fetch correct category stats from backend once
                try {
                    const stats = await api.products.getCategories();
                    this.categoryStats = stats.counts || {};
                    this.categoryStatsTotal = stats.total || 0;
                    this.renderCategories();
                } catch (e) {
                    console.error('Error fetching categories stats:', e);
                }

                this.allLoadedProducts = products;
                this.pos.products = this.allLoadedProducts;
                this.renderProducts(products, false); // Replace
                console.log('POS: Loaded initial products');

                // Save to cache for instant next load
                try {
                    // Create a lighter version of products for caching (exclude large images)
                    const productsSafe = products.map(p => {
                        const { imageUri, ...rest } = p;
                        // Only keep imageUri if it's a short URL, not a base64 string
                        const isBase64 = imageUri && typeof imageUri === 'string' && imageUri.length > 500;
                        return isBase64 ? rest : p;
                    });

                    localStorage.setItem('pos_products_cache', JSON.stringify({
                        products: productsSafe,
                        timestamp: Date.now()
                    }));
                    const catStats = { counts: this.categoryStats, total: this.categoryStatsTotal };
                    localStorage.setItem('pos_categories_cache', JSON.stringify(catStats));
                } catch (cacheErr) {
                    console.warn('Failed to cache products:', cacheErr);
                    // If quota exceeded, try clearing other keys or just ignore
                    if (cacheErr.name === 'QuotaExceededError') {
                        console.log('Clearing old cache to free space...');
                        localStorage.removeItem('pos_products_cache');
                        localStorage.removeItem('cached_products'); // Legacy key
                    }
                }
            } else {
                this.allLoadedProducts.push(...products);
                this.renderProducts(products, true); // Append
                console.log(`POS: Appended ${products.length} products`);
            }

            // Sync with POS global (accumulated)
            this.pos.products = this.allLoadedProducts;

            // Update search buffer only if we are not currently filtering
            // If user is filtering, we shouldn't overwrite the view?
            // Actually, lazy loading happens on the main list. 
            // If filter is active, we rely on client-side search of what's loaded.
            if (!this.pos.dom.searchInput.value.trim()) {
                this.currentFilteredProducts = this.allLoadedProducts;
            }

        } catch (error) {
            console.error('Error loading products:', error);
            ui.showNotification('Error cargando productos', 'error');
        } finally {
            this.isLoading = false;
            this.showLoadingSentinel(false);
        }
    }

    loadMoreProducts() {
        if (this.isLoading || !this.hasMore) return;
        this.apiPage++;
        this.fetchProductsPage(this.apiPage);
    }

    setupIntersectionObserver() {
        if (this.observer) this.observer.disconnect();

        const options = {
            root: null,
            rootMargin: '200px',
            threshold: 0.1
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading && this.hasMore) {
                    if (!this.pos.dom.searchInput.value.trim()) {
                        this.loadMoreProducts();
                    }
                }
            });
        }, options);

        // AGGRESSIVE CLEANUP: Remove any existing pointers to avoid duplicates
        // Also remove old 'loading-spinner' from previous versions
        const oldElements = this.pos.dom.productGrid.querySelectorAll('#infinite-scroll-trigger, #loading-spinner, #loading-spinner-v2, #product-loader-sentinel');
        oldElements.forEach(el => el.remove());

        // Create container if needed or just append to grid
        // Create container if needed or just append to grid
        let trigger = document.createElement('div');
        trigger.id = 'infinite-scroll-trigger';
        trigger.className = 'col-span-full h-4 w-full opacity-0 pointer-events-none';
        this.pos.dom.productGrid.appendChild(trigger);

        let spinner = document.createElement('div');
        spinner.id = 'loading-spinner';
        // Ensure it starts HIDDEN using style
        // Reverted to blue (primary-600)
        spinner.className = 'col-span-full h-16 w-full flex justify-center items-center py-4';
        spinner.style.display = 'none';
        spinner.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>';
        this.pos.dom.productGrid.appendChild(spinner);

        this.observer.observe(trigger);
        this.scrollTrigger = trigger;
        this.loadingSpinner = spinner;
    }

    showLoadingSentinel(show) {
        if (this.loadingSpinner) {
            console.log(`POS: showLoadingSentinel state=${show}`);

            // Clear any existing safety timeout when hiding
            if (!show && this.spinnerSafetyTimeout) {
                clearTimeout(this.spinnerSafetyTimeout);
                this.spinnerSafetyTimeout = null;
            }

            // Use direct property setting with priority
            this.loadingSpinner.style.setProperty('display', show ? 'flex' : 'none', 'important');

            if (show) {
                // Ensure they are at the bottom
                this.pos.dom.productGrid.appendChild(this.scrollTrigger);
                this.pos.dom.productGrid.appendChild(this.loadingSpinner);

                // SAFETY VALVE: Force hide after 15 seconds to prevent eternal spinner
                if (!this.spinnerSafetyTimeout) {
                    this.spinnerSafetyTimeout = setTimeout(() => {
                        console.warn('POS: Spinner safety timeout triggered. Forcing hide.');
                        this.isLoading = false;
                        this.showLoadingSentinel(false);
                    }, 15000);
                }
            } else {
                // Keep trigger at bottom even when hiding spinner
                this.pos.dom.productGrid.appendChild(this.scrollTrigger);
            }
        }
    }

    // Old renderCategories/filterByCategory removed


    renderProducts(productsToRender = null, append = false) {
        // Prepare list
        this.currentFilteredProducts = productsToRender || this.pos.products;
        console.log(`APP: renderProducts called. Count: ${this.currentFilteredProducts.length}, Append: ${append}`);
        console.log('APP: Grid element before:', this.pos.dom.productGrid);
        if (this.pos.dom.productGrid) {
            console.log('APP: Grid offsetHeight:', this.pos.dom.productGrid.offsetHeight);
            console.log('APP: Grid visibility:', window.getComputedStyle(this.pos.dom.productGrid).visibility);
            console.log('APP: Grid display:', window.getComputedStyle(this.pos.dom.productGrid).display);
        }

        if (!append) {
            this.renderedCount = 0;
            if (!this.pos.dom.productGrid) {
                console.error('POS: Critical Error - productGrid DOM element is missing in renderProducts');
                return;
            }
            this.pos.dom.productGrid.innerHTML = '';

            if (this.currentFilteredProducts.length === 0) {
                this.pos.dom.productGrid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center text-slate-400 py-10">
                    <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <p class="text-lg">No se encontraron productos</p>
                </div>
            `;
                return;
            }
        }

        console.log(`APP: Starting map loop for ${this.currentFilteredProducts.length} products`);
        let html = this.currentFilteredProducts.map((product, index) => {
            try {
                // Calculate absolute index if appending
                let startIndex = 0;
                if (append) {
                    startIndex = this.allLoadedProducts.length - this.currentFilteredProducts.length;
                }
                const absoluteIndex = startIndex + index;
                if (index % 100 === 0) console.log(`APP: Rendering products ${index}...`);
                return this.generateProductCardHtml(product, absoluteIndex);
            } catch (err) {
                console.error(`APP: Error generating HTML for product at index ${index}:`, product, err);
                return ''; // Skip this product
            }
        }).join('');

        // Prepend "Varios" card if not appending and showing main list (no search, no specific category)
        if (!append && !this.activeQuery && (!this.activeCategory || this.activeCategory === 'Todas')) {
            html = this.generateVariosCardHtml() + html;
        }

        console.log('APP: Map loop finished. HTML length:', html.length);

        if (append) {
            // Detach sentinels temporarily
            if (this.scrollTrigger) this.scrollTrigger.remove();
            if (this.loadingSpinner) this.loadingSpinner.remove();

            this.pos.dom.productGrid.insertAdjacentHTML('beforeend', html);

            // Re-attach at bottom
            if (this.scrollTrigger) this.pos.dom.productGrid.appendChild(this.scrollTrigger);
            if (this.loadingSpinner) this.pos.dom.productGrid.appendChild(this.loadingSpinner);
        } else {
            console.log('APP: Replacing productGrid.innerHTML...');
            console.log('APP: First 100 chars of HTML:', html.substring(0, 100));
            this.pos.dom.productGrid.innerHTML = html;
            console.log('APP: productGrid.innerHTML replaced. Current length:', this.pos.dom.productGrid.innerHTML.length);
            console.log('APP: Grid child count:', this.pos.dom.productGrid.children.length);
            // Restore sentinels if needed
            if (this.scrollTrigger) this.pos.dom.productGrid.appendChild(this.scrollTrigger);

            if (this.loadingSpinner) {
                // FIX: Only show spinner if still loading AND there are more products to load
                // If hasMore is false, never show the spinner
                const shouldShow = this.isLoading && this.hasMore;
                this.loadingSpinner.style.setProperty('display', shouldShow ? 'flex' : 'none', 'important');
                this.pos.dom.productGrid.appendChild(this.loadingSpinner);
            }
        }

        // --- Finished Rendering ---
        console.log('APP: renderProducts FINISHED.');
    }


    generateProductCardHtml(product, absoluteIndex) {
        const imageUri = getImageUrl(product.imageUri);
        const isWeighted = product.isSoldByWeight === 1 || product.isSoldByWeight === '1' || product.isSoldByWeight === true;
        // DEFENSIVE: Try stockQuantity first, then stock, then 0.
        let stock = 0;
        if (product.stockQuantity !== undefined && product.stockQuantity !== null) {
            stock = parseFloat(product.stockQuantity);
        } else if (product.stock !== undefined && product.stock !== null) {
            stock = parseFloat(product.stock);
        }
        const isAvailable = stock > 0;

        let stockDisplay = '';
        if (isWeighted) {
            const stockUnit = product.stockUnit || 'kg';
            const stockInKg = stockUnit === 'kg' ? stock.toFixed(2) : (stock / 1000).toFixed(stock >= 1000 ? 2 : 3);
            stockDisplay = `<span class="absolute top-2 left-2 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-md shadow-sm z-10">${stockInKg} kg</span>`;
        }

        const availabilityBadge = !isAvailable
            ? '<div class="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-20 rounded-2xl"><span class="bg-white text-slate-900 text-xs font-black px-3 py-1 rounded-full shadow-lg">AGOTADO</span></div>'
            : '';

        const isHighlighted = this.highlightedIndex === absoluteIndex;
        const highlightClass = isHighlighted
            ? 'ring-2 ring-blue-500 shadow-2xl scale-[1.02] z-30'
            : 'hover:shadow-xl hover:scale-[1.03]';

        return `
            <div class="product-card group cursor-pointer relative transition-all duration-300 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 shadow-cloud hover:shadow-cloud-lg hover:-translate-y-1 ${highlightClass}" 
                 onclick="pos.productManager.selectProduct('${product.id}')"
                 data-id="${product.id}" id="product-card-${absoluteIndex}">
                
                <div class="aspect-square overflow-hidden relative rounded-t-2xl bg-slate-50 dark:bg-slate-950/50">
                    <img src="${imageUri}" alt="${product.name}" loading="lazy" 
                        class="w-full h-full object-cover transform-gpu transition-transform duration-500 group-hover:scale-110">
                    ${availabilityBadge}
                    ${stockDisplay}
                    
<!-- Add to cart button removed -->
                    
                    <span class="absolute top-2 right-2 bg-slate-900/50 text-white text-[9px] px-1.5 py-0.5 rounded-lg backdrop-blur-sm font-mono opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">#${product.id}</span>
                </div>

                <div class="p-3 flex flex-col gap-1.5">
                    <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight font-display" title="${product.name}">
                        ${product.name}
                    </h3>
                    <div class="flex items-center justify-between mt-auto">
                        <span class="text-lg font-black text-blue-600 dark:text-blue-400 font-display">
                            ${currencySettings.isUsdEnabled() ? '$' + parseFloat(product.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : formatBs(product.price * this.pos.exchangeRate)}
                            ${isWeighted ? '<span class="text-[10px] font-medium text-slate-400">/kg</span>' : ''}
                        </span>
                    </div>
                </div>
                
                <div class="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-blue-500/20 transition-colors pointer-events-none"></div>
            </div>
        `;
    }


    focusProductGrid() {
        // Focus first card if none highlighted
        if (this.highlightedIndex === -1 && this.currentFilteredProducts.length > 0) {
            this.highlightedIndex = 0;
            this.renderProducts(this.currentFilteredProducts, false); // Re-render to show highlight
        }
    }

    selectHighlightedProduct() {
        if (this.highlightedIndex !== -1 && this.currentFilteredProducts[this.highlightedIndex]) {
            this.selectProduct(this.currentFilteredProducts[this.highlightedIndex].id);
        }
    }

    // Stub for selectProduct if it was missing in my view? 
    // It is probably defined further down or I should ensure logic exists. 
    // The previous view ended at line 439 without changePage.
    // I need to make sure I don't delete methods I didn't see. 
    // I replaced from line 87 (loadProducts) down to 250+.
    // Wait, the ReplacementContent is HUGE. 
    // I need to be careful not to overwrite `bindEvents` or `constructor` which are above line 87.
    // And `selectProduct` which is likely below.
    // My previous view showed `loadProducts` starts at line 87.
    // I will replace from 87 to... where? 
    // The previous file view ended at 250. 
    // I don't see `selectProduct` in 1-250.
    // I should probably View the rest of the file first to be safe!

    // STOP. I will view the file to find where `selectProduct` is and ensuring I replace correct block.



    moveHighlight(direction) {
        if (this.currentFilteredProducts.length === 0) return;

        let columns = 2;
        try {
            // Match Tailwind grid-cols classes from index.html
            // grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6
            const w = window.innerWidth;
            if (w >= 1536) columns = 6;      // 2xl
            else if (w >= 1280) columns = 4; // xl
            else if (w >= 1024) columns = 3; // lg
            else if (w >= 640) columns = 3;  // sm
            else columns = 2;                // default
        } catch (e) { console.error('Error calcing columns', e); }

        const totalItems = this.currentFilteredProducts.length;
        let oldIndex = this.highlightedIndex;

        if (this.highlightedIndex === -1) {
            this.highlightedIndex = (this.currentPage - 1) * this.itemsPerPage;
            if (this.highlightedIndex < 0) this.highlightedIndex = 0;
            if (this.highlightedIndex >= totalItems) this.highlightedIndex = totalItems - 1;
        } else {
            let newIndex = this.highlightedIndex;
            switch (direction) {
                case 'ArrowRight': newIndex++; break;
                case 'ArrowLeft': newIndex--; break;
                case 'ArrowUp': newIndex -= columns; break;
                case 'ArrowDown': newIndex += columns; break;
            }

            if (newIndex < 0) newIndex = 0;
            if (newIndex >= totalItems) newIndex = totalItems - 1;

            this.highlightedIndex = newIndex;
        }

        const pageOfIndex = Math.floor(this.highlightedIndex / this.itemsPerPage) + 1;
        if (pageOfIndex !== this.currentPage) {
            // Update page and re-render
            this.currentPage = pageOfIndex;
            this.renderProducts(this.currentFilteredProducts, false);
        } else {
            // Optimize: Toggle classes directly
            const highlightClasses = ['border-blue-600', 'dark:border-blue-400', 'bg-indigo-50/30', 'dark:bg-indigo-900/20', 'shadow-xl', 'scale-[1.02]', 'z-20'];
            const normalClasses = ['border-transparent', 'hover:scale-105'];

            if (oldIndex !== -1 && oldIndex !== this.highlightedIndex) {
                const oldEl = document.getElementById(`product-card-${oldIndex}`);
                if (oldEl) {
                    oldEl.classList.remove(...highlightClasses);
                    oldEl.classList.add(...normalClasses);
                }
            }

            const newEl = document.getElementById(`product-card-${this.highlightedIndex}`);
            if (newEl) {
                newEl.classList.remove(...normalClasses);
                newEl.classList.add(...highlightClasses);
                newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    focusProductGrid() {
        if (this.currentFilteredProducts.length === 0) return;

        // Reset or set to first item
        this.highlightedIndex = 0;

        // Ensure page 1 if not already
        if (this.currentPage !== 1) {
            this.changePage(1);
        } else {
            // Apply highlight visually, preserving filter
            this.renderProducts(this.currentFilteredProducts);
        }

        // Scroll top
        if (this.pos.dom.productGrid) {
            this.pos.dom.productGrid.parentElement.scrollTop = 0;
            // Ensure first item is visible
            setTimeout(() => {
                const el = document.getElementById(`product-card-0`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    }

    selectHighlightedProduct() {
        if (this.highlightedIndex !== -1 && this.currentFilteredProducts[this.highlightedIndex]) {
            this.selectProduct(this.currentFilteredProducts[this.highlightedIndex].id);
        }
    }

    selectProduct(id) {
        // Find product in currently loaded list (or global list)
        const product = this.pos.products.find(p => String(p.id) === String(id));

        if (!product) {
            console.error('Product not found:', id);
            return;
        }

        // Check if product is sold by weight
        const isWeighted = product.isSoldByWeight === 1 || product.isSoldByWeight === '1' || product.isSoldByWeight === true;

        // Use only 'stock' field for all products (stockQuantity has been removed)
        const stock = product.stockQuantity !== undefined ? parseFloat(product.stockQuantity) : 0;

        if (stock > 0) {
            this.pos.cartManager.addToCart(product);

            // Visual feedback
            const el = document.getElementById(`product-card-${this.pos.products.indexOf(product)}`); // Approximate index finding
            // Better: find element by data-id if index matches? 
            // Since we lazily load, indexOf in pos.products might match the rendered card if not filtered.
            // But let's simplify: just addToCart is enough, CartManager handles animation usually? 
            // CartManager usually rebuilds cart. 
            // Let's add the ring effect if we can find the card.
            const card = document.querySelector(`.product-card[data-id="${id}"]`);
            if (card) {
                card.classList.add('ring-green-500', 'scale-95');
                setTimeout(() => card.classList.remove('ring-green-500', 'scale-95'), 150);
            }

        } else {
            ui.showNotification('Producto agotado', 'warning');
        }
    }
    // Custom Varios Product
    generateVariosCardHtml() {
        return `
            <div class="product-card group cursor-pointer relative transition-all duration-300 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1 hover:scale-[1.02] border border-white/10" 
                 onclick="pos.productManager.openCustomSaleModal()">
                
                <div class="aspect-square flex flex-col items-center justify-center p-4">
                    <div class="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-md shadow-inner">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                    </div>
                    <h3 class="font-bold text-lg text-center leading-tight">Varios</h3>
                    <p class="text-[10px] text-white/70 text-center mt-1 uppercase tracking-wider font-bold">Monto Libre</p>
                </div>
            </div>
        `;
    }

    closeCustomSaleModal() {
        const modal = document.getElementById('custom-sale-modal');
        if (!modal) return;

        // Properly hide the modal
        modal.classList.remove('flex');
        modal.classList.add('hidden');

        // Remove global Esc listener
        if (this._customSaleEscHandler) {
            document.removeEventListener('keydown', this._customSaleEscHandler);
            this._customSaleEscHandler = null;
        }

        // Reset fields
        const input = document.getElementById('custom-sale-amount');
        const descInput = document.getElementById('custom-sale-desc');
        const preview = document.getElementById('conversion-preview');

        if (input) input.value = '';
        if (descInput) descInput.value = 'Varios';
        if (preview) preview.textContent = '';

        // Optionally remove the modal completely after animation
        setTimeout(() => {
            if (modal && modal.parentElement) {
                modal.remove();
            }
        }, 300);
    }

    openCustomSaleModal() {
        // Force remove existing modal to ensure clean state and fresh event listeners
        const existingModal = document.getElementById('custom-sale-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'custom-sale-modal';
        modal.className = 'fixed inset-0 z-[60] hidden items-center justify-center font-sans';
        modal.innerHTML = `
            <div id="custom-sale-modal-backdrop" class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"></div>
            <div id="custom-sale-modal-content" class="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 animate-scale-in mx-4 border border-slate-200 dark:border-slate-700">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <span class="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </span>
                        Venta Personalizada
                    </h3>
                    <button id="custom-sale-modal-close-btn" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700/50 rounded-xl transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                    
                    <div class="space-y-5">
                        <div class="space-y-2">
                            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descripción del Producto</label>
                            <input type="text" id="custom-sale-desc" class="w-full rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 p-4 text-slate-700 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-slate-400" placeholder="Ej. Servicio Técnico" value="Varios">
                        </div>
                        
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Monto</label>
                                <div class="flex bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1">
                                    <button id="currency-usd" class="px-3 py-1 rounded-md text-xs font-bold transition-all bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm">USD</button>
                                    <button id="currency-ves" class="px-3 py-1 rounded-md text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-700">Bs</button>
                                </div>
                            </div>
                            <div class="relative group">
                                <span id="currency-symbol" class="absolute left-4 top-3.5 text-slate-400 font-bold group-focus-within:text-emerald-500 transition-colors">$</span>
                                <input type="number" id="custom-sale-amount" class="w-full rounded-xl border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 pl-8 p-3.5 text-2xl font-black text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder-slate-300" placeholder="0.00" step="0.01">
                            </div>
                            <p id="conversion-preview" class="text-right text-xs text-slate-400 font-medium h-4"></p>
                        </div>

                        <div class="pt-2">
                            <button id="confirm-custom-sale" class="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                Agregar al Carrito
                            </button>
                        </div>
                    </div>
                </div>
            `;
        document.body.appendChild(modal);

        // Bind click events for closing - IMPROVED
        // Close when clicking on the modal container itself (outside the content)
        modal.addEventListener('click', (e) => {
            const modalContent = document.getElementById('custom-sale-modal-content');
            if (modalContent && !modalContent.contains(e.target)) {
                this.closeCustomSaleModal();
            }
        });



        // Close button handler
        modal.querySelector('#custom-sale-modal-close-btn').onclick = (e) => {
            e.stopPropagation();
            this.closeCustomSaleModal();
        };

        // Logic vars
        let currentCurrency = 'USD';
        const rate = this.pos.exchangeRate || 1;

        // Elements
        const input = modal.querySelector('#custom-sale-amount');
        const descInput = modal.querySelector('#custom-sale-desc');
        const btnUsd = modal.querySelector('#currency-usd');
        const btnVes = modal.querySelector('#currency-ves');
        const symbol = modal.querySelector('#currency-symbol');
        const preview = modal.querySelector('#conversion-preview');

        // Toggle Logic
        const setCurrency = (curr) => {
            currentCurrency = curr;
            if (curr === 'USD') {
                btnUsd.className = "px-3 py-1 rounded-md text-xs font-bold transition-all bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm";
                btnVes.className = "px-3 py-1 rounded-md text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-700";
                symbol.textContent = '$';
                updatePreview();
            } else {
                btnVes.className = "px-3 py-1 rounded-md text-xs font-bold transition-all bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm";
                btnUsd.className = "px-3 py-1 rounded-md text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-700";
                symbol.textContent = 'Bs';
                updatePreview();
            }
            input.focus();
        };

        const updatePreview = () => {
            const val = parseFloat(input.value) || 0;
            if (val <= 0) {
                preview.textContent = '';
                return;
            }
            if (currentCurrency === 'USD') {
                preview.textContent = `Aprox. Bs ${(val * rate).toFixed(2)}`;
            } else {
                preview.textContent = `Aprox. $${(val / rate).toFixed(2)}`;
            }
        };

        btnUsd.onclick = () => setCurrency('USD');
        btnVes.onclick = () => setCurrency('VES');
        input.addEventListener('input', updatePreview);

        // Bind enter key on amount input

        // Global Escape key handler
        this._customSaleEscHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeCustomSaleModal();
            }
        };
        document.addEventListener('keydown', this._customSaleEscHandler);

        // Local Enter key handler for inputs
        const handleEnter = (e) => {
            if (e.key === 'Enter') modal.querySelector('#confirm-custom-sale').click();
        };

        input.addEventListener('keydown', handleEnter);
        descInput.addEventListener('keydown', handleEnter);

        modal.querySelector('#confirm-custom-sale').onclick = () => {
            const desc = document.getElementById('custom-sale-desc').value.trim() || 'Varios';
            let amount = parseFloat(input.value);

            if (!amount || amount <= 0) {
                // Shake animation or toast
                const inputEl = document.getElementById('custom-sale-amount');
                inputEl.parentElement.classList.add('animate-shake');
                setTimeout(() => inputEl.parentElement.classList.remove('animate-shake'), 500);
                inputEl.focus();
                return;
            }

            // Convert to USD if needed
            if (currentCurrency === 'VES') {
                const currentRate = this.pos.exchangeRate || 1;
                amount = amount / currentRate;
            }

            // Create Custom Product
            const customProduct = {
                id: 'custom-' + Date.now().toString().slice(-6),
                name: desc,
                price: amount,
                stock: 999999, // Infinite stock (for CartManager compatibility)
                stockQuantity: 999999, // Infinite stock
                isSoldByWeight: false,
                imageUri: '', // Use logic in cart to show generic icon for custom items
                isCustom: true, // Flag for cart rendering if needed
                track_inventory: false // Don't track inventory for custom products
            };

            this.pos.cartManager.addToCart(customProduct);
            this.closeCustomSaleModal();

            // Reset local currency state for next open if needed
            setCurrency('USD');
        };

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Auto focus amount
        setTimeout(() => {
            const amountInput = document.getElementById('custom-sale-amount');
            amountInput.focus();
            amountInput.select();
        }, 100);
    }

    renderCategories() {
        if (!this.pos.dom.categoryFilters) return;

        // Clear existing
        this.pos.dom.categoryFilters.innerHTML = '';

        const stats = this.categoryStats || {};
        const total = this.categoryStatsTotal || this.pos.products.length;

        // Get categories from stats OR local (fallback)
        let uniqueCategories = [];
        if (this.categoryStats && Object.keys(this.categoryStats).length > 0) {
            uniqueCategories = Object.keys(stats).sort();
        } else {
            const rawCategories = this.pos.products.map(p => p.category || 'General');
            uniqueCategories = [...new Set(rawCategories)].sort();
        }

        const categories = ['Todas', ...uniqueCategories];

        // Icon Mapping Helper
        const getCategoryIcon = (cat) => {
            const lower = cat.toLowerCase();
            if (lower === 'todas') return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>';
            if (lower.includes('alimento')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.703 2.703 0 00-3 0 2.703 2.703 0 01-3 0 2.703 2.703 0 00-3 0 2.703 2.703 0 01-3 0 2.701 2.701 0 01-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18z"></path></svg>';
            if (lower.includes('bebi')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path></svg>';
            if (lower.includes('farma')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.023.547l-1.3 1.3L12 21l8.673-4.273-1.3-1.3zM12 9V4m0 5h5m-5 0H7m5 0v5m0-5a2 2 0 110-4 2 2 0 010 4z"></path></svg>';
            if (lower.includes('higiene') || lower.includes('personal')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            if (lower.includes('charcu')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.268 0 2.39.234 3.411.656m-1.306 1.45L13 5m2.95 3.47a10.002 10.002 0 012.318 3.522M15 11l1-2"></path></svg>';
            if (lower.includes('recar')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>';
            return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>';
        };

        // Color Palette Definition (Hex values for inline styles to bypass Tailwind build)
        const palette = [
            { name: 'blue', primary: '#2563eb', border: '#3b82f6', text: '#60a5fa', softBg: 'rgba(37, 99, 235, 0.2)', shadow: 'rgba(37, 99, 235, 0.5)' },
            { name: 'emerald', primary: '#059669', border: '#10b981', text: '#34d399', softBg: 'rgba(5, 150, 105, 0.2)', shadow: 'rgba(5, 150, 105, 0.5)' },
            { name: 'violet', primary: '#7c3aed', border: '#8b5cf6', text: '#a78bfa', softBg: 'rgba(124, 58, 237, 0.2)', shadow: 'rgba(124, 58, 237, 0.5)' },
            { name: 'rose', primary: '#e11d48', border: '#f43f5e', text: '#fb7185', softBg: 'rgba(225, 29, 72, 0.2)', shadow: 'rgba(225, 29, 72, 0.5)' },
            { name: 'amber', primary: '#d97706', border: '#f59e0b', text: '#fbbf24', softBg: 'rgba(217, 119, 6, 0.2)', shadow: 'rgba(217, 119, 6, 0.5)' },
            { name: 'cyan', primary: '#0891b2', border: '#06b6d4', text: '#22d3ee', softBg: 'rgba(8, 145, 178, 0.2)', shadow: 'rgba(8, 145, 178, 0.5)' },
            { name: 'fuchsia', primary: '#c026d3', border: '#d946ef', text: '#e879f9', softBg: 'rgba(192, 38, 211, 0.2)', shadow: 'rgba(192, 38, 211, 0.5)' },
            { name: 'indigo', primary: '#4f46e5', border: '#6366f1', text: '#818cf8', softBg: 'rgba(79, 70, 229, 0.2)', shadow: 'rgba(79, 70, 229, 0.5)' },
        ];

        categories.forEach((cat, index) => {
            const count = cat === 'Todas' ? total : (stats[cat] || 0);
            const label = cat === 'Todas' ? 'Todas' : (cat.charAt(0).toUpperCase() + cat.slice(1));
            const icon = getCategoryIcon(cat);

            // Assign color based on index or specific category logic
            let colorIndex = index % palette.length;
            // Always make 'Todas' the first color (Blue)
            if (cat === 'Todas') colorIndex = 0;

            const color = palette[colorIndex];

            const btn = document.createElement('button');

            const isActive = (this.activeCategory === null && cat === 'Todas') || (this.activeCategory === cat);

            // Use base classes for structure, inline styles for color
            const baseClass = "category-btn group relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap flex items-center gap-2 shrink-0 overflow-hidden border";

            // Set styles directly
            if (isActive) {
                btn.style.backgroundColor = color.primary;
                btn.style.borderColor = color.border;
                btn.style.color = 'white';
                btn.style.boxShadow = `0 0 20px ${color.shadow}`;
                btn.style.transform = 'scale(1.05)';
                btn.style.zIndex = '10';
            } else {
                btn.style.backgroundColor = 'rgba(15, 23, 42, 0.4)'; // slate-900/40
                btn.style.borderColor = 'rgba(255, 255, 255, 0.05)'; // white/5
                btn.style.color = color.text; // Use the palette text color
                btn.style.backdropFilter = 'blur(12px)';
                // Hover styles handled via JS events for inline? No, keep hover classes for generic, update colors via style
                // but hover color needs specific css or event.
                // Let's rely on standard hover classes for scale/shadow, but text color is forced, so we might lose hover text color change.
                // We'll add mouseover/leave
            }

            btn.className = `${baseClass} snap-center`;
            btn.dataset.category = cat;
            btn.dataset.colorIndex = colorIndex;

            btn.innerHTML = `
                <!-- Background Glow for Active (Inline) -->
                ${isActive ? `<div class="absolute inset-0" style="background: linear-gradient(135deg, ${color.softBg}, transparent); opacity: 0.5;"></div>` : ''}
                
                <span class="relative z-10 flex items-center justify-center filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:scale-110 ${isActive ? 'opacity-100 scale-110' : 'opacity-80 group-hover:opacity-100'}">
                    ${icon}
                </span>
                
                <span class="relative z-10 tracking-wide">${label}</span>
                
                <span class="relative z-10 px-2 py-0.5 rounded-lg text-[10px] font-black transition-all duration-300 border"
                      style="${isActive ? 'background-color: rgba(255,255,255,0.2); color: white; border-color: rgba(255,255,255,0.1);' : `background-color: rgba(255,255,255,0.05); color: ${color.text}; border-color: rgba(255,255,255,0.05);`}">
                    ${count}
                </span>
                
                ${isActive ? '<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>' : ''}
                
                <!-- Inner decorative line -->
                <div class="absolute bottom-0 left-0 w-full h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style="background: linear-gradient(to right, transparent, ${color.text}, transparent);"></div>
            `;

            // mouseover/leave for inactive hover effects specific to color
            if (!isActive) {
                btn.onmouseover = () => {
                    if (this.activeCategory !== cat) {
                        btn.style.borderColor = color.border;
                        btn.style.boxShadow = `0 10px 15px -3px ${color.softBg}`;
                        btn.style.color = 'white'; // text-white on hover
                    }
                };
                btn.onmouseout = () => {
                    if (this.activeCategory !== cat) {
                        btn.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        btn.style.boxShadow = 'none';
                        btn.style.color = color.text;
                    }
                };
            }


            btn.addEventListener('click', () => {
                if (this.activeCategory === cat) return;
                this.filterByCategory(cat);
                this.renderCategories(); // Re-render everything to update styles cleaner
            });

            this.pos.dom.categoryFilters.appendChild(btn);
        });
    }

    async loadQuickFavorites() {
        try {
            const favorites = await api.products.getTop();
            if (favorites && favorites.length > 0) {
                this.renderQuickFavorites(favorites);
            }
        } catch (error) {
            console.error('POS: Error loading quick favorites:', error);
        }
    }

    renderQuickFavorites(products) {
        if (!this.pos.dom.productGrid) return;

        let container = document.getElementById('quick-favorites-container');
        if (!container) {
            // Create container if it doesn't exist
            container = document.createElement('div');
            container.id = 'quick-favorites-container';
            // Added negative margins to counteract main-content-area padding
            container.className = 'mb-4 -mt-2 md:-mt-4 pt-2 md:pt-4 animate-fade-in-up';
            // Insert before product grid
            this.pos.dom.productGrid.parentElement.insertBefore(container, this.pos.dom.productGrid);
        }

        container.innerHTML = `
            <div class="flex items-center gap-2 mb-3 px-1">
                <svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <h3 class="font-bold text-slate-700 dark:text-slate-200 text-lg">Favoritos Rápidos</h3>
            </div>
            <div class="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x px-1">
                ${products.map(p => this.renderQuickFavoriteCard(p)).join('')}
            </div>
        `;
    }

    renderQuickFavoriteCard(product) {
        const imageUri = getImageUrl(product.imageUri);
        const isWeighted = product.isSoldByWeight === 1 || product.isSoldByWeight === '1' || product.isSoldByWeight === true;
        const priceDisplay = currencySettings.isUsdEnabled() ? '$' + parseFloat(product.price).toLocaleString('en-US', { minimumFractionDigits: 2 })
            : formatBs(product.price * this.pos.exchangeRate);

        return `
            <div class="flex-none w-28 snap-start group cursor-pointer bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500/50 transition-all active:scale-95"
                 onclick="pos.productManager.selectProduct('${product.id}')">
                <div class="h-14 w-full relative rounded-t-xl overflow-hidden bg-slate-100 dark:bg-slate-900">
                    <img src="${imageUri}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <div class="absolute top-1 right-1 bg-amber-400 text-white text-[8px] font-bold px-1 rounded-full shadow-sm">
                        TOP
                    </div>
                </div>
                <div class="p-2">
                    <h4 class="font-bold text-slate-700 dark:text-slate-200 text-[10px] leading-tight mb-0.5 line-clamp-2 min-h-[2.2em]" title="${product.name}">${product.name}</h4>
                    <div class="text-emerald-600 dark:text-emerald-400 font-black text-xs">
                        ${priceDisplay}
                    </div>
                </div>
            </div>
        `;
    }

    async filterByCategory(category) {
        // DEBUG: Alert to confirm function call and value
        // alert(`DEBUG: Filtrando por categoría: ${category}`); 
        console.log(`DEBUG: Filter clicked: ${category}`);

        // Set Active Filter
        this.activeCategory = (category === 'Todas') ? null : category;

        // Reset Search if switching category? Usually no, but to keep it simple:
        // Let's allow combined filtering logic in fetchProductsPage, but here we update category.
        // For simplicity: Clear search when changing filters to avoid confusion, 
        // OR keep both. Let's keep search if user typed it. 
        // But the common UX is buttons clear search or vice-versa. 
        // Let's clear search query if category is clicked, to show full category.
        this.activeQuery = null;
        if (this.pos.dom.searchInput) this.pos.dom.searchInput.value = '';

        // Reset Page
        this.apiPage = 1;
        this.hasMore = true;
        this.allLoadedProducts = [];
        this.pos.products = []; // Sync global

        // Update UI
        this.pos.dom.productGrid.innerHTML = '';
        this.renderSkeletons();

        // Re-setup Observer FIRST (before fetch) so spinner reference is correct
        this.setupIntersectionObserver();

        // Fetch
        await this.fetchProductsPage(this.apiPage);
    }

    async filterProducts(query) {
        const q = query.trim();
        this.activeQuery = q ? q : null;

        // Reset Page
        this.apiPage = 1;
        this.hasMore = true;
        this.allLoadedProducts = [];
        this.pos.products = [];

        // Update UI
        this.pos.dom.productGrid.innerHTML = '';
        this.renderSkeletons(); // Maybe use lighter loading for search? Skeletons are fine.

        // Re-setup Observer FIRST (before fetch) so spinner reference is correct
        this.setupIntersectionObserver();

        // Fetch (Debounce is handled by caller usually, but here we call API directly)
        // Force load to bypass isLoading lock from previous search keystrokes
        await this.fetchProductsPage(this.apiPage, true);
    }

    handleGridClick(e) {
        console.log('POS: ProductManager.handleGridClick called');
        const card = e.target.closest('.product-card');
        if (!card) {
            console.log('POS: Clicked outside card', e.target);
            return;
        }

        const id = card.dataset.id;
        console.log('POS: Card ID:', id);

        const product = this.pos.products.find(p => String(p.id) === String(id));
        console.log('POS: Product Found:', product);

        if (product) {
            console.log('POS: Product Stock:', product.stock);
            if (product.stock > 0) {
                console.log('POS: Calling addToCart');
                this.pos.cartManager.addToCart(product);
            } else {
                console.warn('POS: Stock is 0 or undefined');
            }
        } else {
            console.error('POS: Product find failed for ID:', id);
        }
    }
}
