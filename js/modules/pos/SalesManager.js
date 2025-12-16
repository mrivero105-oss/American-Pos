import { ui } from '../../ui.js';

export class SalesManager {
    constructor(pos) {
        console.log('SalesManager vDEBUG-CLICK-FIX loaded');
        this.pos = pos;
        this.processingHold = false;
    }

    checkHeldSale() {
        this.updateHeldSalesCount();
    }

    updateHeldSalesCount() {
        const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
        const count = heldSales.length;

        // Desktop Badge
        if (this.pos.dom.heldCountBadge) {
            this.pos.dom.heldCountBadge.textContent = count;
            if (count > 0) this.pos.dom.heldCountBadge.classList.remove('hidden');
            else this.pos.dom.heldCountBadge.classList.add('hidden');
        }

        // Mobile Badge (Added v322)
        const mobileBadge = document.getElementById('mobile-held-count-badge');
        if (mobileBadge) {
            mobileBadge.textContent = count;
            if (count > 0) mobileBadge.classList.remove('hidden');
            else mobileBadge.classList.add('hidden');
        }
    }

    initiateHoldSale() {
        if (this.pos.cart.length === 0) {
            ui.showNotification('El carrito está vacío', 'warning');
            return;
        }

        // Direct hold sale without confirmation modal as requested
        this.holdSale();
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
            existingSale.timestamp = new Date().toISOString(); // Update timestamp

            // CRITICAL FIX: Save the updated array to localStorage
            localStorage.setItem('held_sales', JSON.stringify(heldSales));

            // Clear cart and reset customer
            this.pos.cart = [];
            this.pos.selectedCustomer = null;
            this.pos.renderCart();
            this.updateHeldSalesCount();

            ui.showNotification(`Venta actualizada para ${existingSale.customer.name}`, 'success');
            this.closeHeldSalesDrawer();
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
                ui.showNotification('Venta puesta en espera', 'success');
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
        console.log('POS: SalesManager.showHeldSales called');
        const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
        this.renderHeldSalesList(heldSales);

        if (this.pos.dom.heldSalesDrawer) {
            console.log('POS: Opening Held Sales Drawer');

            // V348: Set Ghost Click Protection (500ms)
            this.pos.ignoreOverlayUntil = Date.now() + 500;

            // Force Close Mobile Cart First to avoid stacking issues - ROBUST FIX v349
            if (this.pos.dom.mobileCartSidebar) {
                this.pos.dom.mobileCartSidebar.style.setProperty('transform', '', 'important');
                this.pos.dom.mobileCartSidebar.classList.add('translate-x-full');
            }

            // Fix Stacking Context: Move to Body
            if (this.pos.dom.heldSalesDrawer.parentNode !== document.body) {
                document.body.appendChild(this.pos.dom.heldSalesDrawer);
            }

            this.pos.dom.heldSalesDrawer.style.zIndex = '2147483647';
            // AGGRESSIVE VISIBILITY FIX
            this.pos.dom.heldSalesDrawer.style.setProperty('display', 'flex', 'important');
            this.pos.dom.heldSalesDrawer.classList.remove('hidden'); // Explicitly remove hidden class
            this.pos.dom.heldSalesDrawer.style.top = '0';
            this.pos.dom.heldSalesDrawer.style.bottom = '0';
            this.pos.dom.heldSalesDrawer.style.right = '0'; // Ensure right aligned

            // Use setTimeout instead of RAF to be absolutely sure of paint cycle
            setTimeout(() => {
                this.pos.dom.heldSalesDrawer.classList.remove('translate-x-full');
                this.pos.dom.heldSalesDrawer.style.transform = 'translateX(0)';

                // Only show overlay on mobile (not on desktop)
                if (this.pos.dom.mobileOverlay && window.innerWidth < 768) {
                    this.pos.dom.mobileOverlay.classList.remove('hidden');
                    this.pos.dom.mobileOverlay.style.display = 'block';
                    this.pos.dom.mobileOverlay.style.zIndex = '2147483646';
                }
            }, 50);
        } else {
            console.warn('POS: Held Sales Drawer element not found!');
        }
    }


    closeHeldSalesDrawer() {
        if (this.pos.dom.heldSalesDrawer) {
            this.pos.dom.heldSalesDrawer.classList.add('translate-x-full');
            if (this.pos.dom.mobileOverlay) {
                this.pos.dom.mobileOverlay.classList.add('hidden');
                this.pos.dom.mobileOverlay.style.display = 'none';
                this.pos.dom.mobileOverlay.style.zIndex = ''; // Reset Z-Index
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
                            <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            <span class="pointer-events-none">Recuperar</span>
                        </button>
                        <button class="delete-held-btn bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 p-2 rounded-lg transition-all group/delete" data-id="${sale.id}" title="Eliminar">
                            <svg class="w-5 h-5 pointer-events-none overflow-visible" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path class="origin-bottom transition-transform duration-300 group-hover/delete:-rotate-12 group-hover/delete:-translate-y-1" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6"></path>
                                <path class="origin-center transition-transform duration-300 group-hover/delete:-translate-y-2 group-hover/delete:rotate-12" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind events explicitly after rendering
        const restoreBtns = this.pos.dom.heldSalesList.querySelectorAll('.restore-held-btn');
        restoreBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
                const id = btn.dataset.id;
                console.log('CLICK EVENT FIRED: restoreSale', id);
                // alert('DEBUG: Intentando recuperar venta ID: ' + id); // Debug removed
                this.restoreSale(id);
            });
        });

        const deleteBtns = this.pos.dom.heldSalesList.querySelectorAll('.delete-held-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                console.log('CLICK EVENT FIRED: deleteHeldSale', id);
                this.deleteHeldSale(id);
            });
        });
    }

    restoreSale(id) {
        // AGGRESSIVE DEBUG REMOVED
        console.log('POS: restoreSale called with id:', id, 'type:', typeof id);

        const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
        console.log('POS: heldSales count:', heldSales.length, 'IDs:', heldSales.map(s => s.id));

        // Convert both to strings to avoid type mismatch
        const saleIndex = heldSales.findIndex(s => String(s.id) === String(id));
        console.log('POS: saleIndex found:', saleIndex);

        if (saleIndex === -1) {
            console.warn('POS: Sale not found in held_sales!');
            return;
        }

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
            this.closeHeldSalesDrawer(); // Close drawer to show modal clearly
            this.pos.showConfirmationModal(
                '¿Reemplazar carrito?',
                'Hay productos en el carrito actual. ¿Desea reemplazarlos por la venta en espera?',
                () => doRestore(),
                'Sí, Reemplazar',
                () => {
                    // On Cancel: Re-open drawer so user doesn't lose context
                    setTimeout(() => this.showHeldSales(), 300);
                },
                'Cancelar'
            );
        } else {
            doRestore();
        }
    }

    deleteHeldSale(id) {
        console.log('POS: deleteHeldSale called for id', id);

        // 1. Temporarily close the drawer to show the modal clearly on mobile
        this.closeHeldSalesDrawer();

        // 2. Show Confirmation Modal
        this.pos.showConfirmationModal(
            '¿Eliminar venta en espera?',
            '¿Está seguro de eliminar esta venta en espera? Esta acción no se puede deshacer.',
            () => {
                // ON CONFIRM
                console.log('POS: User CONFIRMED deletion of', id);
                const heldSales = JSON.parse(localStorage.getItem('held_sales') || '[]');
                const newHeldSales = heldSales.filter(s => String(s.id) !== String(id));

                localStorage.setItem('held_sales', JSON.stringify(newHeldSales));

                this.renderHeldSalesList(newHeldSales);
                this.updateHeldSalesCount();
                ui.showNotification('Venta eliminada', 'success');

                // Re-open drawer to show updated list
                setTimeout(() => {
                    this.showHeldSales();
                }, 300);
            },
            'Sí, Eliminar',
            () => {
                // ON CANCEL
                console.log('POS: User CANCELLED deletion');
                // Re-open drawer so user doesn't lose context
                setTimeout(() => {
                    this.showHeldSales();
                }, 300);
            },
            'Cancelar'
        );
    }
}
