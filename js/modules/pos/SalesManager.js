import { ui } from '../../ui.js';

export class SalesManager {
    constructor(pos) {
        this.pos = pos;
        this.processingHold = false;
    }

    checkHeldSale() {
        this.updateHeldSalesCount();
    }

    updateHeldSalesCount() {
        const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
        const count = heldSales.length;

        if (this.pos.dom.heldCountBadge) {
            this.pos.dom.heldCountBadge.textContent = count;
            if (count > 0) {
                this.pos.dom.heldCountBadge.classList.remove('hidden');
            } else {
                this.pos.dom.heldCountBadge.classList.add('hidden');
            }
        }
    }

    initiateHoldSale() {
        if (this.pos.cart.length === 0) {
            ui.showNotification('El carrito está vacío', 'warning');
            return;
        }

        // Always prompt for customer as requested
        this.pos.showConfirmationModal(
            '¿Asignar Cliente?',
            '¿Desea asignar un cliente a esta venta en espera? Si selecciona "No", se guardará como anónima.',
            () => {
                this.pos.pendingHold = true;
                this.pos.showCustomerSelection();
            },
            'Sí, Asignar',
            () => {
                this.holdSale();
            },
            'No, Guardar Anónima'
        );
    }

    holdSale() {
        if (this.pos.cart.length === 0) {
            ui.showNotification('El carrito está vacío', 'warning');
            return;
        }

        if (this.processingHold) return;
        this.processingHold = true;

        console.log('DEBUG: holdSale called');

        const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
        let existingSaleIndex = -1;

        // If we have a customer, check if they already have a held sale
        if (this.pos.selectedCustomer) {
            existingSaleIndex = heldSales.findIndex(s => s.customer && s.customer.id === this.pos.selectedCustomer.id);
        }

        if (existingSaleIndex !== -1) {
            // Merge with existing sale
            const existingSale = heldSales[existingSaleIndex];

            this.pos.cart.forEach(cartItem => {
                const existingItem = existingSale.items.find(i => i.id === cartItem.id);
                if (existingItem) {
                    existingItem.quantity += cartItem.quantity;
                } else {
                    existingSale.items.push(cartItem);
                }
            });

            // Recalculate total
            existingSale.total = existingSale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            ui.showNotification(`Venta actualizada para ${this.pos.selectedCustomer.name} `, 'success');
        } else {
            // Create new held sale
            // Helper to save sale
            const saveSale = (customer) => {
                const sale = {
                    id: Date.now().toString(),
                    items: [...this.pos.cart],
                    customer: customer,
                    total: this.pos.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    timestamp: new Date().toISOString()
                };
                heldSales.push(sale);
                localStorage.setItem('held_sales', JSON.stringify(heldSales));
                this.pos.cart = [];
                this.pos.selectedCustomer = null;
                this.pos.renderCart(); // Call renderCart on POS (which delegates to CartManager)
                this.updateHeldSalesCount();
                this.closeHeldSalesDrawer();
            }

            if (!this.pos.selectedCustomer) {
                const customer = { id: 'ref-' + Date.now(), name: 'Cliente Casual', email: '', phone: '' };
                saveSale(customer);
            } else {
                saveSale(this.pos.selectedCustomer);
            }
        }

        setTimeout(() => { this.processingHold = false; }, 1000);
    }

    showHeldSales() {
        const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
        this.renderHeldSalesList(heldSales);
        if (this.pos.dom.heldSalesDrawer) {
            this.pos.dom.heldSalesDrawer.style.display = 'flex';
            // Small delay to allow display:flex to apply before transition
            requestAnimationFrame(() => {
                this.pos.dom.heldSalesDrawer.classList.remove('translate-x-full');
                this.pos.dom.heldSalesDrawer.style.transform = '';
                if (this.pos.dom.mobileOverlay) {
                    this.pos.dom.mobileOverlay.classList.remove('hidden');
                    this.pos.dom.mobileOverlay.style.display = 'block';
                }
            });
        }
    }


    closeHeldSalesDrawer() {
        if (this.pos.dom.heldSalesDrawer) {
            this.pos.dom.heldSalesDrawer.classList.add('translate-x-full');
            if (this.pos.dom.mobileOverlay) {
                this.pos.dom.mobileOverlay.classList.add('hidden');
                this.pos.dom.mobileOverlay.style.display = 'none';
            }
            setTimeout(() => {
                this.pos.dom.heldSalesDrawer.style.display = 'none';
            }, 300);
        }
    }

    renderHeldSalesList(heldSales) {
        if (!this.pos.dom.heldSalesList) return;

        if (heldSales.length === 0) {
            this.pos.dom.heldSalesList.innerHTML = '<p class="text-center text-slate-400 py-8">No hay ventas en espera</p>';
            return;
        }

        this.pos.dom.heldSalesList.innerHTML = heldSales.map(sale => {
            const date = new Date(sale.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString();
            const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);
            const customerName = sale.customer
                ? `<div class="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    ${sale.customer.name}
                   </div>`
                : `<div class="text-sm font-medium text-slate-400 dark:text-slate-500 mb-1 italic">Sin cliente asignado</div>`;

            return `
                <div class="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-yellow-400 dark:hover:border-yellow-500/50 transition-colors group mb-3">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            ${customerName}
                            <p class="font-bold text-slate-800 dark:text-white text-lg">$${sale.total.toFixed(2)}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400">${dateStr} - ${timeStr}</p>
                        </div>
                        <span class="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded-lg font-medium">
                            ${itemCount} items
                        </span>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button class="restore-held-btn flex-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50 py-2 px-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1" data-id="${sale.id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            Recuperar
                        </button>
                        <button class="delete-held-btn bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 p-2 rounded-lg transition-all group/delete" data-id="${sale.id}" title="Eliminar">
                            <svg class="w-5 h-5 overflow-visible" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path class="origin-bottom transition-transform duration-300 group-hover/delete:-rotate-12 group-hover/delete:-translate-y-1" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6"></path>
                                <path class="origin-center transition-transform duration-300 group-hover/delete:-translate-y-2 group-hover/delete:rotate-12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    restoreSale(id) {
        const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
        const saleIndex = heldSales.findIndex(s => s.id === id);

        if (saleIndex === -1) return;

        const sale = heldSales[saleIndex];

        const doRestore = () => {
            this.pos.cart = sale.items;
            this.pos.selectedCustomer = sale.customer;

            // Remove from held sales
            heldSales.splice(saleIndex, 1);
            localStorage.setItem('held_sales', JSON.stringify(heldSales));

            this.pos.renderCart();
            this.updateHeldSalesCount();
            this.closeHeldSalesDrawer();
            ui.showNotification('Venta recuperada', 'success');
        };

        // Confirm if cart is not empty
        if (this.pos.cart.length > 0) {
            this.pos.showConfirmationModal(
                '¿Reemplazar carrito?',
                'Hay productos en el carrito actual. ¿Desea reemplazarlos por la venta en espera?',
                () => doRestore(),
                'Sí, Reemplazar'
            );
        } else {
            doRestore();
        }
    }

    deleteHeldSale(id) {
        console.log('POS: deleteHeldSale called for id', id);
        this.pos.showConfirmationModal(
            '¿Eliminar venta en espera?',
            '¿Está seguro de eliminar esta venta en espera? Esta acción no se puede deshacer.',
            () => {
                const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
                const newHeldSales = heldSales.filter(s => s.id !== id);

                localStorage.setItem('held_sales', JSON.stringify(newHeldSales));

                this.renderHeldSalesList(newHeldSales);
                this.updateHeldSalesCount();
                ui.showNotification('Venta eliminada', 'success');
            },
            'Sí, Eliminar'
        );
    }
}
