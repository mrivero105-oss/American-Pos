import { api } from '../../api.js';

export class PurchaseOrdersView {
    constructor() {
        this.dom = {
            view: document.getElementById('view-purchase-orders'),
            tableBody: document.getElementById('purchase-orders-table-body'),
            addBtn: document.getElementById('add-purchase-order-btn'),
            modal: document.getElementById('purchase-order-modal'),
            modalForm: document.getElementById('purchase-order-form'),
            modalTitle: document.getElementById('purchase-order-modal-title'),
            closeModalBtn: document.getElementById('close-purchase-order-modal'),
            cancelModalBtn: document.getElementById('cancel-purchase-order-modal'),
            // Form inputs
            selectSupplier: document.getElementById('po-supplier-select'),
            itemsContainer: document.getElementById('po-items-container'),
            addItemBtn: document.getElementById('po-add-item-btn'),
            inputNotes: document.getElementById('po-notes'),
            totalDisplay: document.getElementById('po-total-display')
        };

        this.orders = [];
        this.suppliers = [];
        this.products = [];
        this.bindEvents();
    }

    bindEvents() {
        if (this.dom.addBtn) {
            this.dom.addBtn.addEventListener('click', () => this.openModal());
        }

        if (this.dom.closeModalBtn) this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.dom.cancelModalBtn) this.dom.cancelModalBtn.addEventListener('click', () => this.closeModal());

        if (this.dom.modalForm) {
            this.dom.modalForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.dom.addItemBtn) {
            this.dom.addItemBtn.addEventListener('click', () => this.addItemRow());
        }
    }

    async load() {
        try {
            [this.orders, this.suppliers, this.products] = await Promise.all([
                api.purchaseOrders.getAll(),
                api.suppliers.getAll(),
                api.products.getAll()
            ]);

            // Handle paginated products response
            if (this.products && this.products.products) {
                this.products = this.products.products;
            }
            if (!Array.isArray(this.orders)) this.orders = [];
            if (!Array.isArray(this.suppliers)) this.suppliers = [];
            if (!Array.isArray(this.products)) this.products = [];

            this.renderTable(this.orders);
        } catch (e) {
            console.error('Error loading purchase orders:', e);
        }
    }

    renderTable(list) {
        if (!this.dom.tableBody) return;

        const statusLabels = {
            pending: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>',
            received: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Recibida</span>',
            cancelled: '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Cancelada</span>'
        };

        this.dom.tableBody.innerHTML = list.map(o => {
            const date = new Date(o.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
            const itemCount = o.items?.length || 0;

            return `
            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 text-slate-600 dark:text-slate-400 font-mono text-xs">#${o.id.slice(-6)}</td>
                <td class="p-3 text-slate-800 dark:text-slate-200 font-bold">${o.supplierName}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-sm">${date}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-sm">${itemCount} items</td>
                <td class="p-3 text-slate-800 dark:text-slate-200 font-bold">$${o.total.toFixed(2)}</td>
                <td class="p-3">${statusLabels[o.status] || o.status}</td>
                <td class="p-3 text-right">
                    ${o.status === 'pending' ? `
                        <button class="text-green-600 hover:text-green-800 p-1 mr-1 receive-order-btn" data-id="${o.id}" title="Recibir">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        </button>
                        <button class="text-red-600 hover:text-red-800 p-1 cancel-order-btn" data-id="${o.id}" title="Cancelar">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `}).join('');

        // Bind action buttons
        this.dom.tableBody.querySelectorAll('.receive-order-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleReceive(btn.dataset.id));
        });

        this.dom.tableBody.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleCancel(btn.dataset.id));
        });
    }

    openModal() {
        if (!this.dom.modal) return;

        this.dom.modalForm.reset();
        this.dom.modalTitle.textContent = 'Nueva Orden de Compra';

        // Populate supplier dropdown
        if (this.dom.selectSupplier) {
            this.dom.selectSupplier.innerHTML = `
                <option value="">Seleccionar proveedor...</option>
                ${this.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            `;
        }

        // Clear items and add one row
        if (this.dom.itemsContainer) {
            this.dom.itemsContainer.innerHTML = '';
            this.addItemRow();
        }

        this.updateTotal();
        this.dom.modal.classList.remove('hidden');
        this.dom.modal.style.display = 'flex';
    }

    closeModal() {
        if (this.dom.modal) {
            this.dom.modal.classList.add('hidden');
            this.dom.modal.style.display = 'none';
        }
    }

    addItemRow() {
        if (!this.dom.itemsContainer) return;

        const row = document.createElement('div');
        row.className = 'flex gap-2 items-center po-item-row';
        row.innerHTML = `
            <select class="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 dark:text-white po-product-select" required>
                <option value="">Producto...</option>
                ${this.products.map(p => `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`).join('')}
            </select>
            <input type="number" class="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 dark:text-white po-quantity" min="1" value="1" placeholder="Cant." required>
            <input type="number" class="w-24 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 dark:text-white po-cost" min="0" step="0.01" value="0" placeholder="Costo $" required>
            <button type="button" class="text-red-500 hover:text-red-700 p-1 remove-item-btn">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;

        row.querySelector('.remove-item-btn').addEventListener('click', () => {
            row.remove();
            this.updateTotal();
        });

        row.querySelectorAll('.po-quantity, .po-cost').forEach(input => {
            input.addEventListener('input', () => this.updateTotal());
        });

        this.dom.itemsContainer.appendChild(row);
    }

    updateTotal() {
        if (!this.dom.totalDisplay) return;

        let total = 0;
        document.querySelectorAll('.po-item-row').forEach(row => {
            const qty = parseFloat(row.querySelector('.po-quantity').value) || 0;
            const cost = parseFloat(row.querySelector('.po-cost').value) || 0;
            total += qty * cost;
        });

        this.dom.totalDisplay.textContent = `$${total.toFixed(2)}`;
    }

    async handleSubmit(e) {
        e.preventDefault();

        const supplierId = this.dom.selectSupplier.value;
        if (!supplierId) {
            alert('Selecciona un proveedor');
            return;
        }

        const items = [];
        document.querySelectorAll('.po-item-row').forEach(row => {
            const select = row.querySelector('.po-product-select');
            const productId = select.value;
            const productName = select.options[select.selectedIndex]?.dataset.name || '';
            const quantity = parseInt(row.querySelector('.po-quantity').value) || 0;
            const cost = parseFloat(row.querySelector('.po-cost').value) || 0;

            if (productId && quantity > 0) {
                items.push({ productId, name: productName, quantity, cost });
            }
        });

        if (items.length === 0) {
            alert('Agrega al menos un producto');
            return;
        }

        try {
            await api.purchaseOrders.create({
                supplierId,
                items,
                notes: this.dom.inputNotes?.value || ''
            });

            this.closeModal();
            this.load();
        } catch (err) {
            console.error('Error creating order:', err);
            alert('Error al crear orden');
        }
    }

    async handleReceive(id) {
        if (!confirm('¿Confirmas recibir esta orden? El stock se actualizará automáticamente.')) return;

        try {
            await api.purchaseOrders.receive(id);
            this.load();
            alert('Orden recibida. Stock actualizado.');
        } catch (err) {
            console.error('Error receiving order:', err);
            alert(err.message || 'Error al recibir orden');
        }
    }

    async handleCancel(id) {
        if (!confirm('¿Estás seguro de cancelar esta orden?')) return;

        try {
            await api.purchaseOrders.cancel(id);
            this.load();
        } catch (err) {
            console.error('Error cancelling order:', err);
            alert('Error al cancelar orden');
        }
    }
}
