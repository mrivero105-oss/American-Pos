import { api } from '../../api.js';
import { formatBs, currencySettings } from '../../utils.js';
import { ui } from '../../ui.js';
import { getImageUrl } from '../../config.js';

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

    async loadProducts() {
        // Reset State
        this.apiPage = 1;
        this.apiLimit = 50;
        this.isLoading = false;
        this.hasMore = true;
        this.allLoadedProducts = [];
        this.pos.products = [];

        // Try to load from cache first for instant display
        const cachedProducts = localStorage.getItem('pos_products_cache');
        const cachedCategories = localStorage.getItem('pos_categories_cache');

        if (cachedProducts) {
            try {
                const cached = JSON.parse(cachedProducts);
                if (cached && cached.products && cached.products.length > 0) {
                    console.log('POS: Loading from cache first...');
                    this.allLoadedProducts = cached.products;
                    this.pos.products = cached.products;

                    // Load cached categories too
                    if (cachedCategories) {
                        const catCache = JSON.parse(cachedCategories);
                        this.categoryStats = catCache.counts || {};
                        this.categoryStatsTotal = catCache.total || 0;
                        this.renderCategories();
                    }

                    this.renderProducts(cached.products, false);
                    this.hasMore = false; // Disable infinite scroll for cache

                    // Refresh in background after short delay
                    setTimeout(() => this.refreshProductsInBackground(), 2000);
                    return;
                }
            } catch (e) {
                console.warn('Cache parse error, loading fresh:', e);
            }
        }

        // No cache - load normally with skeletons
        this.pos.dom.productGrid.innerHTML = '';
        this.renderSkeletons();

        await this.fetchProductsPage(this.apiPage);

        // Setup Infinite Scroll
        this.setupIntersectionObserver();
    }

    async refreshProductsInBackground() {
        console.log('POS: Background refresh starting...');
        try {
            // Fetch all products silently
            const response = await api.products.getAll(1, 500); // Get up to 500 in background
            let products = [];

            if (Array.isArray(response)) {
                products = response;
            } else if (response.products) {
                products = response.products;
            }

            if (products.length > 0) {
                // Update cache
                localStorage.setItem('pos_products_cache', JSON.stringify({
                    products: products,
                    timestamp: Date.now()
                }));

                // Fetch categories too
                const stats = await api.products.getCategories();
                localStorage.setItem('pos_categories_cache', JSON.stringify(stats));

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

    async fetchProductsPage(page) {
        if (this.isLoading) return;
        this.isLoading = true;
        this.showLoadingSentinel(true);

        try {
            console.log(`POS: Fetching products page ${page} (Category: ${this.activeCategory}, Search: ${this.activeQuery})`);

            // Pass filters to API
            const response = await api.products.getAll(
                page,
                this.apiLimit,
                this.activeCategory,
                this.activeQuery
            );

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
                    localStorage.setItem('pos_products_cache', JSON.stringify({
                        products: products,
                        timestamp: Date.now()
                    }));
                    const catStats = { counts: this.categoryStats, total: this.categoryStatsTotal };
                    localStorage.setItem('pos_categories_cache', JSON.stringify(catStats));
                } catch (cacheErr) {
                    console.warn('Failed to cache products:', cacheErr);
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

        if (!append) {
            this.renderedCount = 0;
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

        const html = this.currentFilteredProducts.map((product, index) => {
            // Calculate absolute index if appending
            let startIndex = 0;
            if (append) {
                startIndex = this.allLoadedProducts.length - this.currentFilteredProducts.length;
            }
            const absoluteIndex = startIndex + index;
            return this.generateProductCardHtml(product, absoluteIndex);
        }).join('');

        if (append) {
            // Detach sentinels temporarily
            if (this.scrollTrigger) this.scrollTrigger.remove();
            if (this.loadingSpinner) this.loadingSpinner.remove();

            this.pos.dom.productGrid.insertAdjacentHTML('beforeend', html);

            // Re-attach at bottom
            if (this.scrollTrigger) this.pos.dom.productGrid.appendChild(this.scrollTrigger);
            if (this.loadingSpinner) this.pos.dom.productGrid.appendChild(this.loadingSpinner);
        } else {
            this.pos.dom.productGrid.innerHTML = html;
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
    }


    generateProductCardHtml(product, absoluteIndex) {
        const imageUri = getImageUrl(product.imageUri);

        // Check if product is sold by weight
        const isWeighted = product.isSoldByWeight === 1 || product.isSoldByWeight === '1' || product.isSoldByWeight === true;

        // Use only 'stock' field for all products (stockQuantity has been removed)
        let stock, stockDisplay, isAvailable;
        stock = product.stock !== undefined ? parseFloat(product.stock) : 0;
        isAvailable = stock > 0;

        if (isWeighted) {
            // Check stockUnit: 'kg' means stock is already in kg, otherwise assume grams
            const stockUnit = product.stockUnit || 'kg';
            let stockInKg;
            if (stockUnit === 'kg') {
                stockInKg = stock.toFixed(2);
            } else {
                // Convert grams to kg
                stockInKg = (stock / 1000).toFixed(stock >= 1000 ? 2 : 3);
            }
            stockDisplay = `<span class="absolute top-1 left-1 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm">${stockInKg} kg</span>`;
        } else {
            stockDisplay = '';
        }

        const availabilityBadge = !isAvailable
            ? '<span class="absolute top-1 right-1 bg-red-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm">AGOTADO</span>'
            : '';

        const isHighlighted = this.highlightedIndex === absoluteIndex;
        const highlightClass = isHighlighted
            ? 'border-blue-600 dark:border-blue-400 bg-indigo-50/30 dark:bg-indigo-900/20 shadow-xl scale-[1.02] z-20'
            : 'border-transparent hover:scale-105';

        return `
            <div class="product-card group cursor-pointer relative transition-all rounded-2xl border-2 ${highlightClass}" 
                 onclick="pos.productManager.selectProduct('${product.id}')"
                 data-id="${product.id}" id="product-card-${absoluteIndex}">
                
                <div class="aspect-square overflow-hidden bg-white dark:bg-slate-800 relative rounded-2xl">
                    <img src="${imageUri}" alt="${product.name}" loading="lazy" class="w-full h-full object-contain p-1 transform-gpu transition-transform duration-300">
                    ${availabilityBadge}
                    ${stockDisplay}
                    <button class="add-to-cart-btn absolute bottom-2 right-2 w-8 h-8 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white transition-all flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-600 z-10 active:scale-95"
                        ${!isAvailable ? 'disabled' : ''} onclick="event.stopPropagation(); pos.productManager.selectProduct('${product.id}')">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </button>
                    <span class="absolute ${isWeighted ? 'bottom-1' : 'top-1'} left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm font-mono opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">#${product.id}</span>
                </div>

                <div class="p-1.5 flex flex-col gap-1">
                    <h3 class="font-bold text-slate-800 dark:text-slate-100 text-[clamp(11px,1.1vw,13px)] leading-tight line-clamp-2 min-h-[2.5rem]" title="${product.name}">${product.name}</h3>
                    <div class="flex items-baseline gap-1">
                        <span class="text-[clamp(13px,1.2vw,16px)] font-extrabold text-indigo-600 dark:text-indigo-400">${currencySettings.isUsdEnabled() ? '$' + parseFloat(product.price).toFixed(2) : formatBs(product.price * this.pos.exchangeRate)}${isWeighted ? '/kg' : ''}</span>
                    </div>
                </div>
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
            // grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
            const w = window.innerWidth;
            if (w >= 1280) columns = 5;      // xl
            else if (w >= 1024) columns = 4; // lg
            else if (w >= 640) columns = 3;  // sm & md
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
            this.changePage(pageOfIndex);
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
        const stock = product.stock !== undefined ? parseFloat(product.stock) : 0;

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

        categories.forEach(cat => {
            const count = cat === 'Todas' ? total : (stats[cat] || 0);
            const label = cat === 'Todas' ? 'Todas' : (cat.charAt(0).toUpperCase() + cat.slice(1));
            const icon = getCategoryIcon(cat);

            const btn = document.createElement('button');

            const baseClass = "category-btn group relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap flex items-center gap-2.5 shrink-0 overflow-hidden";
            const activeClass = "bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-lg shadow-indigo-500/20 scale-105 active-ring";
            const inactiveClass = "bg-white/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md";

            const isActive = (this.activeCategory === null && cat === 'Todas') || (this.activeCategory === cat);
            btn.className = `${baseClass} ${isActive ? activeClass : inactiveClass}`;
            btn.dataset.category = cat;

            btn.innerHTML = `
                <span class="relative z-10 opacity-70 group-hover:opacity-100 transition-opacity">${icon}</span>
                <span class="relative z-10">${label}</span>
                <span class="relative z-10 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} transition-colors">
                    ${count}
                </span>
                ${isActive ? '<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>' : ''}
            `;

            btn.addEventListener('click', () => {
                if (this.activeCategory === cat) return; // Skip if already active

                this.filterByCategory(cat);

                // Update classes for all buttons
                this.pos.dom.categoryFilters.querySelectorAll('.category-btn').forEach(b => {
                    const bCat = b.dataset.category;
                    const bIsActive = bCat === cat;
                    b.className = `${baseClass} ${bIsActive ? activeClass : inactiveClass}`;

                    // Update the badge colors inside
                    const badge = b.querySelector('span:last-child');
                    if (badge) {
                        badge.className = `relative z-10 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${bIsActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} transition-colors`;
                    }

                    // Remove shimmer if not active
                    const shimmer = b.querySelector('.animate-shimmer');
                    if (shimmer && !bIsActive) shimmer.remove();
                    // Add shimmer if active
                    if (bIsActive && !shimmer) {
                        const newShimmer = document.createElement('div');
                        newShimmer.className = 'absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer';
                        b.appendChild(newShimmer);
                    }
                });
            });

            this.pos.dom.categoryFilters.appendChild(btn);
        });

        this.pos.updateCartToggleState();
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
        await this.fetchProductsPage(this.apiPage);
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
