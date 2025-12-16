import { api } from '../../api.js';

export class CustomersView {
    constructor(dashboard = null) {
        this.dashboard = dashboard; // Not currently used, kept for potential future use
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
            inputId: document.getElementById('customer-id'), // Hidden
            // Credit fields
            inputCreditLimit: document.getElementById('customer-credit-limit'),
            inputCreditBalance: document.getElementById('customer-credit-balance'),
            // Credit History Modal
            creditHistoryModal: document.getElementById('credit-history-modal'),
            closeCreditHistoryModal: document.getElementById('close-credit-history-modal'),
            creditCustomerName: document.getElementById('credit-customer-name'),
            creditCustomerId: document.getElementById('credit-customer-id'),
            creditLimitDisplay: document.getElementById('credit-limit-display'),
            creditBalanceDisplay: document.getElementById('credit-balance-display'),
            creditAvailableDisplay: document.getElementById('credit-available-display'),
            creditPaymentForm: document.getElementById('credit-payment-form'),
            creditPaymentAmount: document.getElementById('credit-payment-amount'),
            creditHistoryList: document.getElementById('credit-history-list')
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

        // Credit History Modal
        if (this.dom.closeCreditHistoryModal) {
            this.dom.closeCreditHistoryModal.addEventListener('click', () => this.closeCreditHistoryModal());
        }
        if (this.dom.creditPaymentForm) {
            this.dom.creditPaymentForm.addEventListener('submit', (e) => this.handleCreditPayment(e));
        }
    }

    async load() {
        // Show loading state if needed
        try {
            const response = await api.customers.getAll();
            // API may return array or paginated object {customers: [...], total: ...}
            if (Array.isArray(response)) {
                this.customers = response;
            } else if (response && response.customers) {
                this.customers = response.customers;
            } else {
                this.customers = [];
            }
            this.renderTable(this.customers);
        } catch (e) {
            console.error('Error loading customers:', e);
            // ui.showNotification('Error loading customers', 'error');
        }
    }

    renderTable(list) {
        if (!this.dom.tableBody) return;

        // Generate a consistent color based on name
        const getAvatarColor = (name) => {
            const colors = [
                'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
                'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
            ];
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
        };

        // Get initials from name
        const getInitials = (name) => {
            if (!name) return '?';
            const parts = name.trim().split(' ');
            if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
            return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
        };

        this.dom.tableBody.innerHTML = list.map(c => {
            const creditBalance = c.creditBalance || 0;
            const creditLimit = c.creditLimit || 0;
            const hasCredit = creditLimit > 0;
            const hasDebt = creditBalance > 0;
            const creditUsedPercent = creditLimit > 0 ? Math.min((creditBalance / creditLimit) * 100, 100) : 0;
            const availableCredit = Math.max(creditLimit - creditBalance, 0);

            // Credit bar color based on usage
            let creditBarColor = 'bg-green-500';
            if (creditUsedPercent > 75) creditBarColor = 'bg-red-500';
            else if (creditUsedPercent > 50) creditBarColor = 'bg-yellow-500';

            const avatarColor = getAvatarColor(c.name || '');
            const initials = getInitials(c.name);

            return `
            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="p-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                            ${initials}
                        </div>
                        <div>
                            <div class="text-slate-800 dark:text-slate-200 font-bold">${c.name}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">${c.phone || 'Sin teléfono'}</div>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-slate-600 dark:text-slate-400 font-mono text-sm">${c.idDocument || '-'}</td>
                <td class="p-3 hidden md:table-cell">
                    ${hasCredit ? `
                        <div class="min-w-[120px]">
                            <div class="flex items-center justify-between text-xs mb-1">
                                <span class="${hasDebt ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-green-600 dark:text-green-400'}">
                                    ${hasDebt ? `Debe: $${creditBalance.toFixed(2)}` : 'Sin deuda'}
                                </span>
                                <span class="text-slate-400">$${creditLimit}</span>
                            </div>
                            <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div class="h-full ${creditBarColor} transition-all duration-300" style="width: ${creditUsedPercent}%"></div>
                            </div>
                            <div class="text-[10px] text-slate-400 mt-0.5">
                                Disponible: $${availableCredit.toFixed(2)}
                            </div>
                        </div>
                    ` : `
                        <span class="text-slate-400 text-sm">Sin crédito</span>
                    `}
                </td>
                <td class="p-3 text-right">
                    <div class="flex justify-end gap-1">
                        ${hasCredit ? `
                        <button class="view-credit-btn p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors" data-id="${c.id}" title="Ver Crédito">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        </button>
                        ` : ''}
                        <button class="edit-customer-btn p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" data-id="${c.id}" title="Editar">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button class="delete-customer-btn p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" data-id="${c.id}" title="Eliminar">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');


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

        // Bind credit view buttons
        console.log('Binding credit buttons, found:', this.dom.tableBody.querySelectorAll('.view-credit-btn').length);
        this.dom.tableBody.querySelectorAll('.view-credit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                console.log('Credit button clicked for customer:', id);
                this.openCreditHistoryModal(id);
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
            // Credit fields
            if (this.dom.inputCreditLimit) this.dom.inputCreditLimit.value = customer.creditLimit || 0;
            if (this.dom.inputCreditBalance) this.dom.inputCreditBalance.value = customer.creditBalance || 0;
        } else {
            this.dom.modalTitle.textContent = 'Nuevo Cliente';
            this.dom.inputId.value = '';
            if (this.dom.inputCreditLimit) this.dom.inputCreditLimit.value = 0;
            if (this.dom.inputCreditBalance) this.dom.inputCreditBalance.value = 0;
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
            address: this.dom.inputAddress.value,
            // Credit fields
            creditLimit: parseFloat(this.dom.inputCreditLimit?.value) || 0
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

    // --- Credit History Modal Methods ---

    async openCreditHistoryModal(customerId) {
        if (!this.dom.creditHistoryModal) return;

        try {
            const data = await api.customers.getCreditHistory(customerId);

            // Store current customer ID
            if (this.dom.creditCustomerId) this.dom.creditCustomerId.value = customerId;

            // Update header
            if (this.dom.creditCustomerName) this.dom.creditCustomerName.textContent = data.customer.name;

            // Update balance displays
            const limit = data.customer.creditLimit || 0;
            const balance = data.customer.creditBalance || 0;
            const available = limit - balance;

            if (this.dom.creditLimitDisplay) this.dom.creditLimitDisplay.textContent = `$${limit.toFixed(2)}`;
            if (this.dom.creditBalanceDisplay) this.dom.creditBalanceDisplay.textContent = `$${balance.toFixed(2)}`;
            if (this.dom.creditAvailableDisplay) this.dom.creditAvailableDisplay.textContent = `$${available.toFixed(2)}`;

            // Render history
            this.renderCreditHistory(data.history);

            // Show modal
            this.dom.creditHistoryModal.classList.remove('hidden');
            this.dom.creditHistoryModal.style.display = 'flex';

            // Clear payment form
            if (this.dom.creditPaymentAmount) this.dom.creditPaymentAmount.value = '';

        } catch (err) {
            console.error('Error loading credit history:', err);
            alert('Error al cargar historial de crédito');
        }
    }

    closeCreditHistoryModal() {
        if (this.dom.creditHistoryModal) {
            this.dom.creditHistoryModal.classList.add('hidden');
            this.dom.creditHistoryModal.style.display = 'none';
        }
    }

    renderCreditHistory(history) {
        if (!this.dom.creditHistoryList) return;

        if (!history || history.length === 0) {
            this.dom.creditHistoryList.innerHTML = `
                <p class="text-slate-400 text-sm text-center py-4">Sin movimientos</p>
            `;
            return;
        }

        this.dom.creditHistoryList.innerHTML = history.map(h => {
            const isCharge = h.type === 'charge';
            const icon = isCharge ? '📤' : '📥';
            const colorClass = isCharge ? 'text-red-600' : 'text-green-600';
            const sign = isCharge ? '+' : '-';
            const date = new Date(h.timestamp).toLocaleDateString('es-VE', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            return `
                <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div>
                        <span class="text-lg mr-2">${icon}</span>
                        <span class="text-sm text-slate-700 dark:text-slate-300">${h.description}</span>
                        <p class="text-xs text-slate-400 mt-1">${date}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold ${colorClass}">${sign}$${h.amount.toFixed(2)}</p>
                        <p class="text-xs text-slate-400">Saldo: $${h.balanceAfter?.toFixed(2) || '0.00'}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    async handleCreditPayment(e) {
        e.preventDefault();

        const customerId = this.dom.creditCustomerId?.value;
        const amount = parseFloat(this.dom.creditPaymentAmount?.value);

        if (!customerId || !amount || amount <= 0) {
            alert('Ingrese un monto válido');
            return;
        }

        try {
            const result = await api.customers.registerCreditPayment(customerId, amount);

            // Reload modal with updated data
            await this.openCreditHistoryModal(customerId);

            // Reload customers table to update balance display
            this.load();

            alert(`Abono registrado. Nueva deuda: $${result.newBalance.toFixed(2)}`);
        } catch (err) {
            console.error('Error registering payment:', err);
            alert(err.message || 'Error al registrar abono');
        }
    }
}
