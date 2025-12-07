import { api } from '../../api.js';

export class CustomersView {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.dom = {
            view: document.getElementById('view-customers'),
            tableBody: document.getElementById('customers-table-body'),
            searchInput: document.getElementById('customers-search'),
            addBtn: document.getElementById('add-customer-btn'),
            modal: document.getElementById('customer-modal'),
            modalForm: document.getElementById('customer-form'),
            modalTitle: document.getElementById('customer-modal-title'),
            closeModalBtn: document.getElementById('close-customer-modal'),
            cancelModalBtn: document.getElementById('cancel-customer-modal'),
            // Inputs
            inputName: document.getElementById('customer-name'),
            inputDoc: document.getElementById('customer-doc'),
            inputPhone: document.getElementById('customer-phone'),
            inputEmail: document.getElementById('customer-email'),
            inputAddress: document.getElementById('customer-address'),
            inputId: document.getElementById('customer-id') // Hidden
        };

        this.customers = [];
        this.bindEvents();
    }

    bindEvents() {
        // Search
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', (e) => this.filterCustomers(e.target.value));
        }

        // Add Button
        if (this.dom.addBtn) {
            this.dom.addBtn.addEventListener('click', () => this.openModal());
        }

        // Modal Actions
        if (this.dom.closeModalBtn) this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.dom.cancelModalBtn) this.dom.cancelModalBtn.addEventListener('click', () => this.closeModal());

        // Form Submit
        if (this.dom.modalForm) {
            this.dom.modalForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    async load() {
        // Show loading state if needed
        try {
            this.customers = await api.customers.getAll();
            if (!Array.isArray(this.customers)) this.customers = [];
            this.renderTable(this.customers);
        } catch (e) {
            console.error('Error loading customers:', e);
            // ui.showNotification('Error loading customers', 'error');
        }
    }

    renderTable(list) {
        if (!this.dom.tableBody) return;

        this.dom.tableBody.innerHTML = list.map(c => `
            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 text-slate-800 dark:text-slate-200 font-bold">${c.name}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-mono text-sm">${c.idDocument || '-'}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-sm hidden md:table-cell">${c.phone || '-'}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-sm hidden lg:table-cell">${c.email || '-'}</td>
                <td class="p-3 text-right">
                    <button class="text-blue-600 hover:text-blue-800 p-1 mr-2 edit-customer-btn" data-id="${c.id}" title="Editar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="text-red-600 hover:text-red-800 p-1 delete-customer-btn" data-id="${c.id}" title="Eliminar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        // Bind dynamic buttons
        this.dom.tableBody.querySelectorAll('.edit-customer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const customer = this.customers.find(c => String(c.id) === String(id));
                if (customer) this.openModal(customer);
            });
        });

        this.dom.tableBody.querySelectorAll('.delete-customer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.handleDelete(id);
            });
        });
    }

    filterCustomers(query) {
        if (!query) {
            this.renderTable(this.customers);
            return;
        }

        const lower = query.toLowerCase();
        const filtered = this.customers.filter(c =>
            c.name.toLowerCase().includes(lower) ||
            (c.idDocument && c.idDocument.includes(lower))
        );
        this.renderTable(filtered);
    }

    openModal(customer = null) {
        if (!this.dom.modal) return;

        this.dom.modalForm.reset();

        if (customer) {
            this.dom.modalTitle.textContent = 'Editar Cliente';
            this.dom.inputId.value = customer.id;
            this.dom.inputName.value = customer.name;
            this.dom.inputDoc.value = customer.idDocument || '';
            this.dom.inputPhone.value = customer.phone || '';
            this.dom.inputEmail.value = customer.email || '';
            this.dom.inputAddress.value = customer.address || '';
        } else {
            this.dom.modalTitle.textContent = 'Nuevo Cliente';
            this.dom.inputId.value = '';
        }

        this.dom.modal.classList.remove('hidden');
        this.dom.modal.style.display = 'flex';
        this.dom.inputName.focus();
    }

    closeModal() {
        if (this.dom.modal) {
            this.dom.modal.classList.add('hidden');
            this.dom.modal.style.display = 'none';
        }
        this.dom.modalForm.reset();
    }

    async handleSubmit(e) {
        e.preventDefault();

        const id = this.dom.inputId.value;
        const data = {
            name: this.dom.inputName.value,
            idDocument: this.dom.inputDoc.value,
            phone: this.dom.inputPhone.value,
            email: this.dom.inputEmail.value,
            address: this.dom.inputAddress.value
        };

        if (!data.name) return;

        // Show loading?

        try {
            if (id) {
                // Update
                await api.customers.update(id, data);
            } else {
                // Create
                await api.customers.create(data);
            }

            this.closeModal();
            this.load(); // Reload table
            // ui.showNotification('Cliente guardado correctamente', 'success');
        } catch (err) {
            console.error('Error saving customer:', err);
            // ui.showNotification('Error al guardar', 'error');
        }
    }

    async handleDelete(id) {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;

        try {
            await api.customers.delete(id);
            this.load();
            // ui.showNotification('Cliente eliminado', 'success');
        } catch (err) {
            console.error('Error deleting customer:', err);
            // ui.showNotification('Error al eliminar', 'error');
        }
    }
}
