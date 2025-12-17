import { ui } from '../../ui.js';
import { formatBs, roundBsUp, currencySettings } from '../../utils.js';
import { getImageUrl } from '../../config.js';

export class CartManager {
    constructor(pos) {
        this.pos = pos;
    }

    addToCart(productOrId, quantity = 1, options = {}) {
        console.log('POS: CartManager.addToCart called', { productOrId, quantity });
        let product = productOrId;
        if (typeof productOrId === 'string' || typeof productOrId === 'number') {
            product = this.pos.products.find(p => String(p.id) === String(productOrId));
        }

        if (!product) {
            console.error('Product not found for cart addition:', productOrId);
            ui.showNotification('Error: Producto no encontrado para agregar al carrito', 'error');
            return;
        }

        // Check for weighted product
        // isSoldByWeight comes from DB (0 or 1, or string '1')
        const isWeighted = product.isSoldByWeight === 1 || product.isSoldByWeight === '1' || product.isSoldByWeight === true || product.isSoldByWeight === 'true';

        // If it's weighted and no specific quantity was passed (meaning it came from a click), open modal
        // Note: We check quantity === 1 because the POS wrapper usually defaults to 1.
        // We also check options.skipModal to allow explicit addition of 1kg from the modal itself.
        if (isWeighted && quantity === 1 && !options.skipWeightedModal) {
            this.pos.openWeightModal(product);
            return;
        }

        const existingItem = this.pos.cart.find(item => item.id === product.id);
        if (existingItem) {
            const newQty = existingItem.quantity + quantity;
            // For weighted items, we might want to allow more precision or just check stock
            if (newQty <= product.stock) {
                existingItem.quantity = newQty;
            } else {
                ui.showNotification(`Stock máximo alcanzado(${product.stock})`, 'warning');
            }
        } else {
            // Validate stock for new items
            const availableStock = parseFloat(product.stock) || 0;
            if (quantity > availableStock && availableStock > 0) {
                ui.showNotification(`Solo hay ${availableStock} unidades disponibles`, 'warning');
                return;
            }
            if (availableStock <= 0 && product.track_inventory !== false) {
                ui.showNotification(`${product.name} sin stock`, 'warning');
                return;
            }

            const newItem = { ...product, quantity: quantity, isWeighted: isWeighted };
            console.log('POS: Pushing new item to cart:', newItem);
            this.pos.cart.push(newItem);
        }
        console.log('POS: Cart content before save:', this.pos.cart);
        this.saveCart();
        this.renderCart();
    }

    clearCart() {
        if (this.pos.cart.length === 0) return;

        this.pos.showConfirmationModal(
            '¿Vaciar Carrito?',
            '¿Estás seguro de que deseas eliminar todos los productos del carrito?',
            () => {
                this.pos.cart = [];
                this.saveCart();
                this.renderCart();
                ui.showNotification('Carrito vaciado', 'success');
            },
            'Sí, Vaciar'
        );
    }

    saveCart() {
        localStorage.setItem('pos_current_cart', JSON.stringify(this.pos.cart));
        if (this.pos.selectedCustomer) {
            localStorage.setItem('pos_current_customer', JSON.stringify(this.pos.selectedCustomer));
        } else {
            localStorage.removeItem('pos_current_customer');
        }
    }

    loadCart() {
        const savedCart = localStorage.getItem('pos_current_cart');
        if (savedCart) {
            try {
                this.pos.cart = JSON.parse(savedCart);
            } catch (e) {
                console.error('Error loading cart', e);
                this.pos.cart = [];
            }
        }

        const savedCustomer = localStorage.getItem('pos_current_customer');
        if (savedCustomer) {
            try {
                this.pos.selectCustomer(JSON.parse(savedCustomer));
            } catch (e) {
                console.error('Error loading customer', e);
            }
        }

        this.renderCart();
    }

    renderCart() {
        this.saveCart(); // Auto-save on render

        // Check currency settings
        const showBs = currencySettings.isBsEnabled();
        const showUsd = currencySettings.isUsdEnabled();

        // Calculate Totals
        const total = this.pos.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        // Round UP to nearest whole Bs
        const totalBs = roundBsUp(total * this.pos.exchangeRate);
        const itemCount = this.pos.cart.reduce((sum, item) => sum + item.quantity, 0);

        // Update UI Totals
        if (this.pos.dom.cartTotal) this.pos.dom.cartTotal.textContent = `$${total.toFixed(2)}`;
        if (this.pos.dom.cartTotalBs) {
            if (showBs) {
                this.pos.dom.cartTotalBs.textContent = formatBs(totalBs);
            }
        }
        // Show/hide entire Total BS row in desktop cart
        const cartTotalBsRow = document.getElementById('cart-total-bs-row');
        if (cartTotalBsRow) {
            if (showBs) {
                cartTotalBsRow.classList.remove('hidden');
            } else {
                cartTotalBsRow.classList.add('hidden');
            }
        }
        // Show/hide entire Total USD row in desktop cart
        const cartTotalUsdRow = document.getElementById('cart-total-usd-row');
        if (cartTotalUsdRow) {
            if (showUsd) {
                cartTotalUsdRow.classList.remove('hidden');
            } else {
                cartTotalUsdRow.classList.add('hidden');
            }
        }
        if (this.pos.dom.mobileCartCount) this.pos.dom.mobileCartCount.textContent = itemCount;

        // FIXED: Update Mobile Specific Totals (Robust Version)
        try {
            // Find ALL elements with this ID to check for duplicates
            const totalEls = document.querySelectorAll('#mobile-cart-total');
            if (totalEls.length > 1) console.warn('POS: WARNING - Multiple #mobile-cart-total elements found!', totalEls.length);

            const mobileTotalEl = document.getElementById('mobile-cart-total');
            const mobileTotalUsdRow = document.getElementById('mobile-cart-total-usd-row');
            if (mobileTotalEl) {
                const formatted = `$${(total || 0).toFixed(2)}`;
                console.log('POS: Updating mobile total USD. Element:', mobileTotalEl, 'Value:', formatted);
                mobileTotalEl.textContent = formatted;
            }
            // Show/hide mobile USD row
            if (mobileTotalUsdRow) {
                if (showUsd) {
                    mobileTotalUsdRow.classList.remove('hidden');
                } else {
                    mobileTotalUsdRow.classList.add('hidden');
                }
            }

            const mobileTotalBsEl = document.getElementById('mobile-cart-total-bs');
            const mobileTotalBsRow = document.getElementById('mobile-cart-total-bs-row');
            if (mobileTotalBsEl && mobileTotalBsRow) {
                if (showBs) {
                    const SafeRate = this.pos.exchangeRate || 0;
                    // Round UP to nearest whole Bs
                    const safeTotalBs = roundBsUp((total || 0) * SafeRate);
                    const formattedBs = formatBs(safeTotalBs);
                    console.log('POS: Updating mobile total BS. Element:', mobileTotalBsEl, 'Value:', formattedBs);
                    mobileTotalBsEl.textContent = formattedBs;
                    mobileTotalBsRow.classList.remove('hidden');
                } else {
                    mobileTotalBsRow.classList.add('hidden');
                }
            } else {
                console.warn('POS: Mobile Total BS Element #mobile-cart-total-bs NOT found');
            }
        } catch (e) {
            console.error('POS: Error updating mobile totals:', e);
        }

        // Render Desktop Cart
        // REVERSE ORDER: Newest items first (LIFO)
        // Note: reversedCart was defined below for mobile, but let's hoist it or redefine it.
        // Actually, I inserted it in the mobile block (lines 151+).
        // Since I can't easily see the variable scope from previous replace without context, I will define it again securely or hoist it.
        // But wait, the previous replace put 'const reversedCart = ...' INSIDE the renderCart method, before 'if (this.pos.dom.mobileCartItems)'.
        // So it IS available here if I put it before both blocks.
        // However, in the file view, line 151 was "Render Mobile Cart".
        // My previous replace targeted line 151.
        // This block (142-149) is BEFORE line 151.
        // So I need to define it here first.

        const reversedCartDesktop = this.pos.cart.slice(0).reverse();

        if (this.pos.dom.cartItems) {
            if (this.pos.cart.length === 0) {
                this.pos.dom.cartItems.innerHTML = '<div class="text-center text-slate-400 py-8">Carrito vacío</div>';
            } else {
                this.pos.dom.cartItems.innerHTML = reversedCartDesktop.map(item => this.renderCartItem(item)).join('');
            }
        }

        // Render Mobile Cart
        // REVERSE ORDER: Newest items first (LIFO)
        const reversedCart = this.pos.cart.slice(0).reverse();

        if (this.pos.dom.mobileCartItems) {
            if (this.pos.cart.length === 0) {
                this.pos.dom.mobileCartItems.innerHTML = '<div class="text-center text-slate-400 py-8">Carrito vacío</div>';
            } else {
                this.pos.dom.mobileCartItems.innerHTML = reversedCart.map(item => this.renderCartItem(item)).join('');
            }
        } else {
            // Try to find it again dynamically
            const mobileContainer = document.getElementById('mobile-cart-items-container');
            if (mobileContainer) {
                this.pos.dom.mobileCartItems = mobileContainer;
                this.pos.dom.mobileCartItems.innerHTML = reversedCart.map(item => this.renderCartItem(item)).join('');
            }
        }

        // Update Button States
        const isCartEmpty = this.pos.cart.length === 0;
        if (this.pos.dom.checkoutBtn) {
            this.pos.dom.checkoutBtn.disabled = isCartEmpty;
            if (isCartEmpty) {
                this.pos.dom.checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
                this.pos.dom.checkoutBtn.setAttribute('disabled', 'disabled');
            } else {
                this.pos.dom.checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                this.pos.dom.checkoutBtn.removeAttribute('disabled'); // Force remove HTML attribute
            }
        }
        if (this.pos.dom.clearCartBtn) {
            this.pos.dom.clearCartBtn.disabled = isCartEmpty;
            if (isCartEmpty) {
                this.pos.dom.clearCartBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                this.pos.dom.clearCartBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        // FIXED: Update Mobile Button States (Robust Version)
        try {
            const mobileCheckoutBtn = document.getElementById('mobile-checkout-btn-final');
            const mobileClearBtn = document.getElementById('mobile-clear-cart-btn');
            const mobileHoldBtn = document.getElementById('mobile-hold-sale-btn');

            const updateMobileBtn = (btn) => {
                if (btn) {
                    btn.disabled = isCartEmpty;
                    if (isCartEmpty) {
                        btn.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                        btn.removeAttribute('disabled'); // Force remove attribute
                    }
                }
            };

            updateMobileBtn(mobileCheckoutBtn);
            updateMobileBtn(mobileClearBtn);
            updateMobileBtn(mobileHoldBtn);

            // Extra force for checkout button
            if (mobileCheckoutBtn && !isCartEmpty) {
                mobileCheckoutBtn.style.opacity = '1';
                mobileCheckoutBtn.style.cursor = 'pointer';
            }

        } catch (e) {
            console.error('Error updating mobile buttons:', e);
        }

        const mobileClearBtn = document.getElementById('mobile-clear-cart-btn');
        if (mobileClearBtn) {
            mobileClearBtn.disabled = isCartEmpty;
            if (isCartEmpty) {
                mobileClearBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                mobileClearBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        const mobileHoldBtn = document.getElementById('mobile-hold-sale-btn');
        if (mobileHoldBtn) {
            mobileHoldBtn.disabled = isCartEmpty;
            if (isCartEmpty) {
                mobileHoldBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                mobileHoldBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        // Update Mobile Cart Button Badge visibility
        if (this.pos.dom.mobileCartCount) {
            if (itemCount > 0) {
                this.pos.dom.mobileCartCount.classList.remove('hidden');
            } else {
                this.pos.dom.mobileCartCount.classList.add('hidden');
            }
        }
    }

    renderCartItem(item) {
        const isWeighted = item.isWeighted || item.measurement === 'kg';
        const step = isWeighted ? '0.001' : '1';
        const quantityDisplay = isWeighted ? parseFloat(item.quantity).toFixed(3) : item.quantity;
        const weightTag = isWeighted ? '<span class="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold ml-2"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>Peso</span>' : '';
        const imageUri = getImageUrl(item.imageUri);

        // Currency-aware pricing
        const showBs = currencySettings.isBsEnabled();
        const priceDisplay = showBs
            ? formatBs(item.price * this.pos.exchangeRate)
            : `$${parseFloat(item.price).toFixed(2)}`;
        const totalDisplay = showBs
            ? formatBs(item.price * item.quantity * this.pos.exchangeRate)
            : `$${(parseFloat(item.price) * item.quantity).toFixed(2)}`;

        // Secondary price (show USD below Bs)
        const secondaryPrice = showBs
            ? `<span class="text-[10px] text-blue-500 dark:text-blue-400 font-medium">$${parseFloat(item.price).toFixed(2)}/u</span>`
            : '';

        return `
        <div class="cart-item group relative bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden mb-3" data-id="${item.id}">
            <!-- Hover gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/5 transition-all duration-300 pointer-events-none"></div>
            
            <div class="relative p-3">
                <!-- Header: Name + Image -->
                <div class="flex items-start gap-3 mb-3">
                    <div class="relative flex-shrink-0">
                        <img src="${imageUri}" alt="${item.name}" 
                            class="w-16 h-16 object-cover rounded-xl border-2 border-slate-200 dark:border-slate-600 group-hover:border-blue-400 dark:group-hover:border-blue-500 shadow-sm transition-all">
                        <div class="absolute -top-1 -right-1 bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">${quantityDisplay}</div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-slate-900 dark:text-white text-sm leading-tight mb-1 line-clamp-2">${item.name}${weightTag}</h4>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                                ${priceDisplay}
                                ${secondaryPrice ? `<span class="text-slate-400 dark:text-slate-500">•</span>` : ''}
                                ${secondaryPrice}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Footer: Quantity Controls + Total -->
                <div class="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <!-- Quantity Pills -->
                    <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-full p-1">
                        <button class="decrease-qty w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-gradient-to-br hover:from-red-500 hover:to-orange-500 hover:text-white transition-all shadow-sm hover:shadow-md">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4"/></svg>
                        </button>
                        <input type="number" class="qty-input w-14 px-2 py-1 text-center bg-transparent text-sm font-bold text-slate-900 dark:text-white border-0 focus:outline-none focus:ring-0" 
                            value="${quantityDisplay}" step="${step}" min="${step}">
                        <button class="increase-qty w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-gradient-to-br hover:from-emerald-500 hover:to-teal-500 hover:text-white transition-all shadow-sm hover:shadow-md">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/></svg>
                        </button>
                    </div>

                    <!-- Total + Delete -->
                    <div class="flex items-center gap-2">
                        <p class="font-black text-lg text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">${totalDisplay}</p>
                        <button class="remove-item w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-gradient-to-br hover:from-red-500 hover:to-red-600 hover:text-white transition-all hover:shadow-lg">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    handleCartClick(e) {
        const btn = e.target.closest('.increase-qty, .decrease-qty, .remove-item');
        if (!btn) return;

        const cartItem = btn.closest('.cart-item');
        if (!cartItem) return;

        const id = cartItem.dataset.id;
        const item = this.pos.cart.find(i => String(i.id) === String(id));
        if (!item) return;

        if (btn.classList.contains('increase-qty')) {
            if (item.quantity < item.stock) {
                item.quantity++;
            } else {
                ui.showNotification(`Stock máximo alcanzado(${item.stock})`, 'warning');
            }
        } else if (btn.classList.contains('decrease-qty')) {
            if (item.quantity > 1) {
                item.quantity--;
            } else {
                this.pos.cart = this.pos.cart.filter(i => String(i.id) !== String(id));
            }
        } else if (btn.classList.contains('remove-item')) {
            this.pos.cart = this.pos.cart.filter(i => String(i.id) !== String(id));
        }

        this.renderCart();
    }

    handleCartInput(e) {
        if (!e.target.classList.contains('qty-input')) return;

        const cartItem = e.target.closest('.cart-item');
        if (!cartItem) return;

        const id = cartItem.dataset.id;
        const item = this.pos.cart.find(i => String(i.id) === String(id));
        if (!item) return;

        let newQty = parseFloat(e.target.value);

        if (isNaN(newQty) || newQty < 1) {
            newQty = 1;
        }

        if (newQty > item.stock) {
            newQty = item.stock;
            ui.showNotification(`Stock máximo alcanzado(${item.stock})`, 'warning');
        }

        item.quantity = newQty;
        this.renderCart();
    }
}
