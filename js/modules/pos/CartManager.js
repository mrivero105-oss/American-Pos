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
                this.pos.dom.cartTotalBs.style.display = '';
            } else {
                this.pos.dom.cartTotalBs.style.display = 'none';
            }
        }
        if (this.pos.dom.mobileCartCount) this.pos.dom.mobileCartCount.textContent = itemCount;

        // FIXED: Update Mobile Specific Totals (Robust Version)
        try {
            // Find ALL elements with this ID to check for duplicates
            const totalEls = document.querySelectorAll('#mobile-cart-total');
            if (totalEls.length > 1) console.warn('POS: WARNING - Multiple #mobile-cart-total elements found!', totalEls.length);

            const mobileTotalEl = document.getElementById('mobile-cart-total');
            if (mobileTotalEl) {
                const formatted = `$${(total || 0).toFixed(2)}`;
                console.log('POS: Updating mobile total USD. Element:', mobileTotalEl, 'Value:', formatted);
                mobileTotalEl.textContent = formatted;
                // Force visibility just in case
                mobileTotalEl.style.display = 'block';
            } else {
                console.warn('POS: Mobile Total Element #mobile-cart-total NOT found in DOM during renderCart');
            }

            const mobileTotalBsEl = document.getElementById('mobile-cart-total-bs');
            if (mobileTotalBsEl) {
                if (showBs) {
                    const SafeRate = this.pos.exchangeRate || 0;
                    // Round UP to nearest whole Bs
                    const safeTotalBs = roundBsUp((total || 0) * SafeRate);
                    const formattedBs = formatBs(safeTotalBs);
                    console.log('POS: Updating mobile total BS. Element:', mobileTotalBsEl, 'Value:', formattedBs);
                    mobileTotalBsEl.textContent = formattedBs;
                    mobileTotalBsEl.style.display = '';
                } else {
                    mobileTotalBsEl.style.display = 'none';
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
        const weightTag = isWeighted ? '<span class="text-xs bg-blue-100 text-blue-800 px-1 rounded ml-1">Peso</span>' : '';
        const imageUri = getImageUrl(item.imageUri);
        const priceBs = formatBs(item.price * this.pos.exchangeRate);
        const totalBs = formatBs(item.price * item.quantity * this.pos.exchangeRate);

        // Adaptive Font Sizing (Length checks on formatted string)
        let priceBsClass = 'text-base tracking-tight';
        if (priceBs.length > 14) priceBsClass = 'text-[0.65rem] tracking-tighter'; // Extra small for huge numbers
        else if (priceBs.length > 11) priceBsClass = 'text-xs tracking-tight';
        else if (priceBs.length > 9) priceBsClass = 'text-sm tracking-tight';

        let totalBsClass = 'text-lg tracking-tight';
        if (totalBs.length > 15) totalBsClass = 'text-xs tracking-tighter';
        else if (totalBs.length > 12) totalBsClass = 'text-sm tracking-tight';
        else if (totalBs.length > 10) totalBsClass = 'text-base tracking-tight';

        return `
        <div class="cart-item flex flex-col p-3 mb-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors" data-id="${item.id}">
            <!-- Name Row -->
            <div class="w-full mb-2 border-b border-slate-200 dark:border-slate-600 pb-2">
                 <h4 class="font-bold text-slate-900 dark:text-white text-sm md:text-base break-words leading-tight">${item.name} ${weightTag}</h4>
            </div>
            
            <!-- Content Row -->
            <div class="flex justify-between items-center w-full">
                <div class="flex items-center gap-2 md:gap-3 flex-1">
                    <img src="${imageUri}" alt="${item.name}" class="w-12 h-12 md:w-16 md:h-16 object-cover rounded-md border border-slate-200 dark:border-slate-600">
                    <div class="flex-1 min-w-0">
                        <div class="text-sm md:text-base text-slate-500 dark:text-slate-400 flex flex-col gap-0.5 md:gap-1">
                            <span class="flex items-center flex-wrap">
                                <span class="font-bold text-slate-700 dark:text-slate-200 text-xs md:text-base tracking-tight truncate max-w-[80px] md:max-w-none">${priceBs}</span>
                                <span class="mx-1 md:mx-2 text-xs md:text-base">x</span>
                                <input type="number" class="qty-input w-12 md:w-16 px-1 py-1 text-center border rounded bg-white dark:bg-slate-600 dark:text-white text-sm md:text-lg font-medium" 
                                    value="${quantityDisplay}" step="${step}" min="${step}">
                            </span>
                            <span class="text-blue-600 dark:text-blue-400 font-bold text-xs md:text-sm">$${parseFloat(item.price).toFixed(2)} c/u</span>
                        </div>
                    </div>
                </div>
                <div class="text-right pl-1 md:pl-2">
                    <p class="font-bold text-slate-900 dark:text-white text-sm md:text-lg tracking-tight">${totalBs}</p>
                    <div class="flex items-center justify-end gap-1 mt-2">
                        <button class="decrease-qty p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                        </button>
                        <button class="increase-qty p-1.5 text-slate-400 hover:text-green-500 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        </button>
                        <button class="remove-item p-1.5 text-slate-400 hover:text-red-500 transition-colors ml-1">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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
