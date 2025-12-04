import { api } from '../../api.js';
import { ui } from '../../ui.js';

export class CustomerManager {
    constructor(pos) {
        this.pos = pos;
    }

    async loadCustomers() {
        console.log('POS: Loading customers...');
        // 1. Try to load from cache first
        const cachedCustomers = localStorage.getItem('cached_customers');
        if (cachedCustomers) {
            try {
                this.pos.customers = JSON.parse(cachedCustomers);
                console.log('POS: Loaded customers from cache. Count:', this.pos.customers.length);
            } catch (e) {
                console.error('Error parsing cached customers', e);
            }
        }

        // 2. Fetch fresh data in background
        try {
            console.log('POS: Fetching fresh customers from API...');
            const freshCustomers = await api.customers.getAll();
            console.log('POS: API Response:', freshCustomers);

            if (Array.isArray(freshCustomers)) {
                this.pos.customers = freshCustomers;
                localStorage.setItem('cached_customers', JSON.stringify(freshCustomers));
                console.log('POS: Updated customers from API. Count:', this.pos.customers.length);

                // If modal is open, refresh list
                if (this.pos.dom.customerSelectionModal && !this.pos.dom.customerSelectionModal.classList.contains('hidden')) {
                    // Note: renderCustomerList might be in POS or here? 
                    // It seems renderCustomerList is not in the extracted methods list but it is called here.
                    // I need to check if renderCustomerList exists in POS or if I missed it.
                    // Looking at the outline, renderCustomerList is not explicitly listed in the main methods I extracted, 
                    // but renderCustomerSearchResults is.
                    // Let's check if renderCustomerList is defined in POS.
                    if (this.pos.renderCustomerList) {
                        this.pos.renderCustomerList(this.pos.customers);
                    }
                }
            } else {
                console.error('POS: API returned non-array for customers:', freshCustomers);
            }
        } catch (error) {
            console.error('Error loading customers:', error);
            if (!this.pos.customers || this.pos.customers.length === 0) {
                ui.showNotification('Error al cargar clientes', 'error');
            }
        }
    }

    searchCustomers(query) {
        if (!query || query.length < 2) {
            if (this.pos.dom.customerSearchResults) this.pos.dom.customerSearchResults.classList.add('hidden');
            return;
        }

        const lowerQuery = query.toLowerCase();
        const results = this.pos.customers.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            (c.document_number && c.document_number.includes(lowerQuery))
        );

        this.renderCustomerSearchResults(results);
    }

    renderCustomerSearchResults(results) {
        if (!this.pos.dom.customerSearchResults) return;

        if (results.length === 0) {
            this.pos.dom.customerSearchResults.innerHTML = '<div class="p-3 text-slate-500 text-center">No se encontraron clientes</div>';
        } else {
            this.pos.dom.customerSearchResults.innerHTML = results.map(c => `
                <div class="customer-result-item p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0" data-id="${c.id}">
                    <div class="font-medium text-slate-900 dark:text-white">${c.name}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400">${c.document_number || 'Sin documento'}</div>
                </div>
            `).join('');

            // Bind click events
            this.pos.dom.customerSearchResults.querySelectorAll('.customer-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const customer = this.pos.customers.find(c => String(c.id) === String(id));
                    if (customer) {
                        this.selectCustomer(customer);
                    }
                });
            });
        }

        this.pos.dom.customerSearchResults.classList.remove('hidden');
    }

    selectCustomer(customer) {
        this.pos.selectedCustomer = customer;

        // Update UI
        if (this.pos.dom.customerSearchInput) {
            this.pos.dom.customerSearchInput.value = customer.name;
            this.pos.dom.customerSearchInput.disabled = true;
        }

        if (this.pos.dom.customerSearchResults) {
            this.pos.dom.customerSearchResults.classList.add('hidden');
        }

        if (this.pos.dom.deselectCustomerBtn) {
            this.pos.dom.deselectCustomerBtn.classList.remove('hidden');
        }

        if (this.pos.dom.customerDocumentDisplay) {
            this.pos.dom.customerDocumentDisplay.textContent = customer.document_number || 'Sin Documento';
            this.pos.dom.customerDocumentDisplay.parentElement.classList.remove('hidden');
        }
    }

    deselectCustomer() {
        this.pos.selectedCustomer = null;

        // Update UI
        if (this.pos.dom.customerSearchInput) {
            this.pos.dom.customerSearchInput.value = '';
            this.pos.dom.customerSearchInput.disabled = false;
            this.pos.dom.customerSearchInput.focus();
        }

        if (this.pos.dom.deselectCustomerBtn) {
            this.pos.dom.deselectCustomerBtn.classList.add('hidden');
        }

        if (this.pos.dom.customerDocumentDisplay) {
            this.pos.dom.customerDocumentDisplay.parentElement.classList.add('hidden');
        }
    }
}
