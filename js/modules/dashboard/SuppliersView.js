import { api } from '../../api.js';
import { debounce } from '../../utils.js';

export class SuppliersView {
    constructor() {
        this.dom = {
            view: document.getElementById('view-suppliers'),
            tableBody: document.getElementById('suppliers-table-body'),
            searchInput: document.getElementById('suppliers-search'),
            addBtn: document.getElementById('add-supplier-btn'),
            modal: document.getElementById('supplier-modal'),
            modalForm: document.getElementById('supplier-form'),
            modalTitle: document.getElementById('supplier-modal-title'),
            closeModalBtn: document.getElementById('close-supplier-modal'),
            cancelModalBtn: document.getElementById('cancel-supplier-modal'),
            // Inputs
            inputName: document.getElementById('supplier-name'),
            inputContactName: document.getElementById('supplier-contact-name'),
            inputPhone: document.getElementById('supplier-phone'),
            inputEmail: document.getElementById('supplier-email'),
            inputAddress: document.getElementById('supplier-address'),
            inputNotes: document.getElementById('supplier-notes'),
            inputId: document.getElementById('supplier-id')
        };

        this.suppliers = [];
        this.bindEvents();
    }

    bindEvents() {
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', debounce((e) => {
                this.filterSuppliers(e.target.value);
            }, 300));
        }

        if (this.dom.addBtn) {
            this.dom.addBtn.addEventListener('click', () => this.openModal());
        }

        if (this.dom.closeModalBtn) this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.dom.cancelModalBtn) this.dom.cancelModalBtn.addEventListener('click', () => this.closeModal());

        if (this.dom.modalForm) {
            this.dom.modalForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    async load() {
        try {
            this.suppliers = await api.suppliers.getAll();
            if (!Array.isArray(this.suppliers)) this.suppliers = [];
            this.renderTable(this.suppliers);
        } catch (e) {
            console.error('Error loading suppliers:', e);
        }
    }

    renderTable(list) {
        if (!this.dom.tableBody) return;

        this.dom.tableBody.innerHTML = list.map(s => `
            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 text-slate-800 dark:text-slate-200 font-bold">${s.name}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-sm">${s.contactName || '-'}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-sm hidden md:table-cell">${s.phone || '-'}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400 text-sm hidden lg:table-cell">${s.email || '-'}</td>
                <td class="p-3 text-right">
                    <button class="text-blue-600 hover:text-blue-800 p-1 mr-2 edit-supplier-btn" data-id="${s.id}" title="Editar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="text-red-600 hover:text-red-800 p-1 delete-supplier-btn" data-id="${s.id}" title="Eliminar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        // Bind dynamic buttons
        this.dom.tableBody.querySelectorAll('.edit-supplier-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const supplier = this.suppliers.find(s => String(s.id) === String(id));
                if (supplier) this.openModal(supplier);
            });
        });

        this.dom.tableBody.querySelectorAll('.delete-supplier-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.handleDelete(id);
            });
        });
    }

    filterSuppliers(query) {
        if (!query) {
            this.renderTable(this.suppliers);
            return;
        }

        const lower = query.toLowerCase();
        const filtered = this.suppliers.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            (s.contactName && s.contactName.toLowerCase().includes(lower))
        );
        this.renderTable(filtered);
    }

    openModal(supplier = null) {
        if (!this.dom.modal) return;

        this.dom.modalForm.reset();

        if (supplier) {
            this.dom.modalTitle.textContent = 'Editar Proveedor';
            this.dom.inputId.value = supplier.id;
            this.dom.inputName.value = supplier.name;
            this.dom.inputContactName.value = supplier.contactName || '';
            this.dom.inputPhone.value = supplier.phone || '';
            this.dom.inputEmail.value = supplier.email || '';
            this.dom.inputAddress.value = supplier.address || '';
            this.dom.inputNotes.value = supplier.notes || '';
        } else {
            this.dom.modalTitle.textContent = 'Nuevo Proveedor';
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
            contactName: this.dom.inputContactName.value,
            phone: this.dom.inputPhone.value,
            email: this.dom.inputEmail.value,
            address: this.dom.inputAddress.value,
            notes: this.dom.inputNotes.value
        };

        if (!data.name) return;

        try {
            if (id) {
                await api.suppliers.update(id, data);
            } else {
                await api.suppliers.create(data);
            }

            this.closeModal();
            this.load();
        } catch (err) {
            console.error('Error saving supplier:', err);
            alert('Error al guardar proveedor');
        }
    }

    async handleDelete(id) {
        if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;

        try {
            await api.suppliers.delete(id);
            this.load();
        } catch (err) {
            console.error('Error deleting supplier:', err);
            alert('Error al eliminar proveedor');
        }
    }
}
