import { api } from '../../api.js';
import { ui } from '../../ui.js';
import { formatCurrency } from '../../utils.js';

export class RefundManager {
    constructor(pos) {
        this.pos = pos;
        this.currentSale = null;
        this.selectedItems = new Map(); // itemId -> quantity
    }

    // Initialize modal inside SalesHistory or on-demand
    initModal(sale) {
        this.currentSale = sale;
        this.selectedItems.clear();
        this.renderRefundModal();
    }

    renderRefundModal() {
        // Create modal containers if not exists or reuse existing
        // For simplicity, we'll inject/replace a specific modal div in the body
        let modal = document.getElementById('refund-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'refund-modal';
            modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden z-50 flex items-center justify-center';
            document.body.appendChild(modal);
        }

        const itemsHtml = this.currentSale.items.map(item => {
            const maxQty = item.quantity; // In future: subtract already refunded qty
            return `
                <div class="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-slate-800">
                    <div class="flex items-center space-x-3 flex-1">
                        <input type="checkbox" class="refund-item-check w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                            data-id="${item.id}"
                            onchange="window.refundManager.toggleItem('${item.id}', this.checked)">
                        <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-white">${item.name}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Comprado: ${item.quantity} x ${formatCurrency(item.price)}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <input type="number" 
                            id="refund-qty-${item.id}"
                            class="w-20 px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                            min="1" max="${maxQty}" value="${maxQty}"
                            disabled
                            onchange="window.refundManager.updateQuantity('${item.id}', this.value)">
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="relative mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <div class="mt-3">
                    <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">Procesar Devolución</h3>
                    
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 text-sm text-blue-800 dark:text-blue-200">
                        Solo selecciona los productos que el cliente va a devolver.
                    </div>

                    <div class="max-h-60 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 mb-4">
                        ${itemsHtml}
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
                        <select id="refund-reason" class="w-full text-sm border-gray-300 dark:border-slate-600 rounded-md shadow-sm dark:bg-slate-800 dark:text-white">
                            <option value="Defectuoso">Producto Defectuoso</option>
                            <option value="Equivocado">Producto Equivocado</option>
                            <option value="Cliente">Desistimiento del Cliente</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    <div class="flex justify-between items-center py-3 border-t border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-white">
                        <span>Total a Reembolsar:</span>
                        <span id="refund-total-amount">$0.00</span>
                    </div>

                    <div class="flex justify-end space-x-3 mt-4">
                        <button onclick="window.refundManager.closeModal()" 
                            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium">
                            Cancelar
                        </button>
                        <button onclick="window.refundManager.processRefund()" 
                            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm">
                            Confirmar Devolución
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Expose globally for inline events (simple approach)
        window.refundManager = this;

        modal.classList.remove('hidden');
    }

    toggleItem(itemId, checked) {
        const qtyInput = document.getElementById(`refund-qty-${itemId}`);
        if (qtyInput) {
            qtyInput.disabled = !checked;
            if (checked) {
                const item = this.currentSale.items.find(i => i.id === itemId);
                const qty = parseInt(qtyInput.value) || 1;
                this.selectedItems.set(itemId, {
                    id: itemId,
                    quantity: qty,
                    price: item.price,
                    name: item.name
                });
            } else {
                this.selectedItems.delete(itemId);
            }
            this.updateTotal();
        }
    }

    updateQuantity(itemId, value) {
        if (!this.selectedItems.has(itemId)) return;

        const qty = parseInt(value);
        const item = this.currentSale.items.find(i => i.id === itemId);

        // Validate max
        if (qty > item.quantity) {
            document.getElementById(`refund-qty-${itemId}`).value = item.quantity;
            return this.updateQuantity(itemId, item.quantity);
        }

        this.selectedItems.set(itemId, {
            id: itemId,
            quantity: qty,
            price: item.price,
            name: item.name
        });
        this.updateTotal();
    }

    updateTotal() {
        let total = 0;
        this.selectedItems.forEach(item => {
            total += (item.price * item.quantity);
        });
        document.getElementById('refund-total-amount').textContent = formatCurrency(total);
    }

    closeModal() {
        const modal = document.getElementById('refund-modal');
        if (modal) {
            modal.classList.add('hidden');
            setTimeout(() => modal.remove(), 200); // Remove from DOM
        }
    }

    async processRefund() {
        if (this.selectedItems.size === 0) {
            ui.showNotification('Selecciona al menos un producto para devolver', 'warning');
            return;
        }

        const reason = document.getElementById('refund-reason').value;
        const items = Array.from(this.selectedItems.values());

        // ui.showLoading(true);
        try {
            await api.post('/refunds', {
                saleId: this.currentSale.id,
                items: items,
                reason: reason
            });

            this.closeModal();
            ui.showNotification('Devolución procesada y Stock actualizado', 'success');

            // Trigger refresh in SalesHistory if available
            if (window.salesHistory) {
                window.salesHistory.loadSales();
            }
        } catch (error) {
            console.error('Refund error:', error);
            ui.showNotification('Error al procesar devolución', 'error');
        } finally {
            // ui.showLoading(false);
        }
    }
}
