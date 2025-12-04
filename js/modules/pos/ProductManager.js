import { api } from '../../api.js';
import { formatBs } from '../../utils.js';
import { ui } from '../../ui.js';

export class ProductManager {
    constructor(pos) {
        this.pos = pos;
        this.currentPage = 1;
        this.itemsPerPage = 48;
        this.currentFilteredProducts = [];
    }

    async loadProducts() {
        // 1. Try to load from cache first
        const cachedProducts = localStorage.getItem('cached_products');
        if (cachedProducts) {
            try {
                this.pos.products = JSON.parse(cachedProducts);
                this.renderCategories();
                this.renderProducts();
                console.log('POS: Loaded products from cache');
            } catch (e) {
                console.error('Error parsing cached products', e);
            }
        }

        // 2. Fetch fresh data in background (Stale-While-Revalidate)
        try {
            const freshProducts = await api.products.getAll();
            this.pos.products = freshProducts;
            localStorage.setItem('cached_products', JSON.stringify(freshProducts));
            this.renderCategories();
            this.renderProducts();
            console.log('POS: Updated products from API');
        } catch (error) {
            console.error('Error loading products', error);
            if (!this.pos.products.length) {
                ui.showNotification('Error al cargar productos', 'error');
            }
        }
    }

    renderProducts(products = null) {
        this.currentFilteredProducts = products || this.pos.products;

        const totalPages = Math.ceil(this.currentFilteredProducts.length / this.itemsPerPage);

        if (this.currentPage > totalPages) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const productsToShow = this.currentFilteredProducts.slice(startIndex, endIndex);

        if (!this.pos.dom.productGrid) {
            console.error('CRITICAL ERROR: product-grid element not found!');
            return;
        }

        // Reset styles
        this.pos.dom.productGrid.style.display = '';
        this.pos.dom.productGrid.style.minHeight = '';
        this.pos.dom.productGrid.style.border = '';
        this.pos.dom.productGrid.style.opacity = '';
        this.pos.dom.productGrid.style.visibility = '';

        // Render Products
        this.pos.dom.productGrid.innerHTML = productsToShow.map(product => {
            const stock = parseInt(product.stock || 0);
            const isAvailable = stock > 0;
            const imageUri = product.imageUri || 'https://via.placeholder.com/150?text=No+Image';

            let availabilityBadge = '';
            if (!isAvailable) {
                availabilityBadge = '<div class="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center"><span class="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">AGOTADO</span></div>';
            }

            let dispBadge = '';
            if (isAvailable) {
                dispBadge = '<span class="absolute top-1 right-1 bg-green-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm">DISP</span>';
            }

            return `
                <div class="product-card bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer relative" data-id="${product.id}">
                    
                    <!-- Image Container with Floating Actions -->
                    <div class="aspect-square overflow-hidden bg-gray-50 dark:bg-slate-700 relative">
                        <img src="${imageUri}" alt="${product.name}" loading="lazy" class="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500">
                        
                        ${availabilityBadge}

                        <!-- Floating Add Button (Bottom Right of Image) -->
                        <button class="add-to-cart-btn absolute bottom-2 right-2 w-8 h-8 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white transition-all flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-600 z-10 active:scale-90"
                            ${!isAvailable ? 'disabled' : ''}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>
                            </svg>
                        </button>

                        <!-- ID Badge (Top Left) -->
                        <span class="absolute top-1 left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm font-mono opacity-0 group-hover:opacity-100 transition-opacity">#${product.id}</span>
                        
                        <!-- Disp Badge (Top Right) -->
                         ${dispBadge}
                    </div>

                    <!-- Minimal Content Area -->
                    <div class="p-2 flex flex-col gap-0.5">
                        <h3 class="font-bold text-slate-800 dark:text-slate-100 text-[11px] leading-tight line-clamp-2 h-7" title="${product.name}">${product.name}</h3>
                        <div class="flex items-baseline gap-1">
                            <span class="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">${formatBs(product.price * this.pos.exchangeRate)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Render Pagination Controls
        if (totalPages > 1) {
            const paginationHtml = `
                <div class="col-span-full flex justify-center items-center gap-4 mt-6 py-4">
                    <button id="prev-page-btn" class="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" ${this.currentPage === 1 ? 'disabled' : ''}>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                    </button>
                    <span class="text-slate-600 dark:text-slate-300 font-medium">
                        Página ${this.currentPage} de ${totalPages}
                    </span>
                    <button id="next-page-btn" class="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" ${this.currentPage === totalPages ? 'disabled' : ''}>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>
            `;
            this.pos.dom.productGrid.insertAdjacentHTML('beforeend', paginationHtml);

            // Bind Pagination Events
            const prevBtn = document.getElementById('prev-page-btn');
            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent grid click
                    this.changePage(this.currentPage - 1);
                });
            }
            const nextBtn = document.getElementById('next-page-btn');
            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent grid click
                    this.changePage(this.currentPage + 1);
                });
            }
        }
    }

    changePage(newPage) {
        this.currentPage = newPage;
        this.renderProducts(); // Re-render with current filtered list
        // Scroll to top of grid
        this.pos.dom.productGrid.parentElement.scrollTop = 0;
    }

    renderCategories() {
        if (!this.pos.dom.categoryFilters) return;

        // Clear existing
        this.pos.dom.categoryFilters.innerHTML = '';

        // Get unique categories and sort them
        const rawCategories = this.pos.products.map(p => p.category || 'Sin Categoría');
        const uniqueCategories = [...new Set(rawCategories)].sort();
        const categories = ['Todas', ...uniqueCategories];

        // Helper to get count
        const getCount = (cat) => cat === 'Todas' ? this.pos.products.length : this.pos.products.filter(p => (p.category || 'Sin Categoría') === cat).length;

        categories.forEach(cat => {
            const count = getCount(cat);
            const label = cat === 'Todas' ? 'Todas' : (cat.charAt(0).toUpperCase() + cat.slice(1));

            const btn = document.createElement('button');

            // Initial class
            const baseClass = "category-btn px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0";
            const activeClass = "bg-slate-900 text-white dark:bg-blue-600";
            const inactiveClass = "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";

            btn.className = `${baseClass} ${cat === 'Todas' ? activeClass : inactiveClass}`;
            btn.dataset.category = cat;

            btn.innerHTML = `
                <span>${label}</span>
                <span class="bg-white/20 px-1.5 py-0.5 rounded-full text-xs opacity-80">${count}</span>
            `;

            btn.addEventListener('click', () => {
                this.filterByCategory(cat);

                // Update classes
                this.pos.dom.categoryFilters.querySelectorAll('.category-btn').forEach(b => {
                    const bCat = b.dataset.category;
                    b.className = `${baseClass} ${bCat === cat ? activeClass : inactiveClass}`;
                });
            });

            this.pos.dom.categoryFilters.appendChild(btn);
        });

        // Ensure toggle button state is correct on load
        this.pos.updateCartToggleState();
    }


    filterByCategory(category) {
        if (category === 'Todas') {
            this.renderProducts(this.pos.products);
        } else {
            const filtered = this.pos.products.filter(p => (p.category || 'Sin Categoría') === category);
            this.renderProducts(filtered);
        }
    }

    filterProducts(query) {
        const filtered = this.pos.products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
        );
        this.renderProducts(filtered);
    }

    handleGridClick(e) {
        const card = e.target.closest('.product-card');
        if (!card) return;

        const id = card.dataset.id;
        const product = this.pos.products.find(p => String(p.id) === String(id));

        if (product && product.stock > 0) {
            this.pos.cartManager.addToCart(product);
        }
    }
}
