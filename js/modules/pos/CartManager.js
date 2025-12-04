import { ui } from '../../ui.js';
import { formatBs } from '../../utils.js';

export class CartManager {
    constructor(pos) {
        this.pos = pos;
    }

    addToCart(productOrId, quantity = 1) {
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
        // isSoldByWeight comes from DB (0 or 1)
        const isWeighted = product.isSoldByWeight === 1 || product.isSoldByWeight === true;

        // If it's weighted and no specific quantity was passed (meaning it came from a click), open modal
        if (isWeighted && quantity === 1 && arguments.length === 1) {
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
            this.pos.cart.push({ ...product, quantity: quantity, isWeighted: isWeighted });
        }
        this.renderCart();
    }

    renderCart() {
        // Calculate Totals
        const total = this.pos.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalBs = total * this.pos.exchangeRate;
        const itemCount = this.pos.cart.reduce((sum, item) => sum + item.quantity, 0);

        // Update UI Totals
        if (this.pos.dom.cartTotal) this.pos.dom.cartTotal.textContent = formatBs(totalBs);
        if (this.pos.dom.cartTotalBs) this.pos.dom.cartTotalBs.textContent = `$${total.toFixed(2)}`; // Show USD as secondary
        if (this.pos.dom.mobileCartCount) this.pos.dom.mobileCartCount.textContent = itemCount;

        // Render Desktop Cart
        if (this.pos.dom.cartItems) {
            if (this.pos.cart.length === 0) {
                this.pos.dom.cartItems.innerHTML = '<div class="text-center text-slate-400 py-8">Carrito vacío</div>';
            } else {
                this.pos.dom.cartItems.innerHTML = this.pos.cart.map(item => this.renderCartItem(item)).join('');
            }
        }

        // Render Mobile Cart
        if (this.pos.dom.mobileCartItems) {
            if (this.pos.cart.length === 0) {
                this.pos.dom.mobileCartItems.innerHTML = '<div class="text-center text-slate-400 py-8">Carrito vacío</div>';
            } else {
                this.pos.dom.mobileCartItems.innerHTML = this.pos.cart.map(item => this.renderCartItem(item)).join('');
            }
        } else {
            // Try to find it again dynamically
            const mobileContainer = document.getElementById('mobile-cart-items-container');
            if (mobileContainer) {
                this.pos.dom.mobileCartItems = mobileContainer;
                this.pos.dom.mobileCartItems.innerHTML = this.pos.cart.map(item => this.renderCartItem(item)).join('');
            }
        }

        // Update Button States
        const isCartEmpty = this.pos.cart.length === 0;
        if (this.pos.dom.checkoutBtn) {
            this.pos.dom.checkoutBtn.disabled = isCartEmpty;
            if (isCartEmpty) {
                this.pos.dom.checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                this.pos.dom.checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
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
        const imageUri = item.imageUri || 'https://via.placeholder.com/150?text=No+Image';
        const priceBs = (item.price * this.pos.exchangeRate).toFixed(2);
        const totalBs = (item.price * item.quantity * this.pos.exchangeRate).toFixed(2);

        return `
        <div class="cart-item flex flex-col p-3 mb-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 transition-colors" data-id="${item.id}">
            <!-- Name Row -->
            <div class="w-full mb-2 border-b border-slate-200 dark:border-slate-600 pb-2">
                 <h4 class="font-medium text-slate-900 dark:text-white text-base break-words">${item.name} ${weightTag}</h4>
            </div>
            
            <!-- Content Row -->
            <div class="flex justify-between items-center w-full">
                <div class="flex items-center gap-3 flex-1">
                    <img src="${imageUri}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md border border-slate-200 dark:border-slate-600">
                    <div class="flex-1">
                        <div class="text-base text-slate-500 dark:text-slate-400 flex flex-col gap-1">
                            <span class="flex items-center">
                                <span class="font-bold text-slate-700 dark:text-slate-200 text-lg">Bs ${priceBs}</span>
                                <span class="mx-2">x</span>
                                <input type="number" class="qty-input w-16 px-1 py-1 text-center border rounded bg-white dark:bg-slate-600 dark:text-white text-lg font-medium" 
                                    value="${quantityDisplay}" step="${step}" min="${step}">
                            </span>
                            <span class="text-blue-600 dark:text-blue-400 font-bold text-sm">$${parseFloat(item.price).toFixed(2)} c/u</span>
                        </div>
                    </div>
                </div>
                <div class="text-right pl-2">
                    <p class="font-bold text-slate-900 dark:text-white text-xl">Bs ${totalBs}</p>
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
