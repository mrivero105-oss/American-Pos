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

    filterCustomerList(query, container) {
        if (!this.pos.customers) return;
        const lowerQuery = query ? query.toLowerCase() : '';
        const results = this.pos.customers.filter(c =>
            c.name.toLowerCase().includes(lowerQuery) ||
            (c.document_number && c.document_number.includes(lowerQuery))
        );
        this.renderCustomerSearchResults(results, container);
    }

    renderCustomerList(customers, container = null) {
        // Render a limited set of customers (e.g. first 20) to avoid lagging the UI
        const list = customers || [];
        this.renderCustomerSearchResults(list.slice(0, 20), container);
    }

    renderCustomerSearchResults(results, container = null) {
        const target = container || this.pos.dom.customerSearchResults;
        if (!target) return;

        if (results.length === 0) {
            target.innerHTML = '<div class="p-3 text-slate-500 text-center">No se encontraron clientes</div>';
        } else {
            target.innerHTML = results.map(c => `
                <div class="customer-result-item p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 rounded-lg" data-id="${c.id}">
                    <div class="font-medium text-slate-900 dark:text-white">${c.name}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400">${c.document_number || 'Sin documento'}</div>
                </div>
            `).join('');

            // Bind click events
            target.querySelectorAll('.customer-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const customer = this.pos.customers.find(c => String(c.id) === String(id));
                    if (customer) {
                        // If we are in the modal (container passed), we proceed to checkout
                        if (container) {
                            this.pos.processCheckout(customer);
                        } else {
                            // Standard sidebar selection
                            this.selectCustomer(customer);
                        }
                    }
                });
            });
        }

        if (!container) {
            this.pos.dom.customerSearchResults.classList.remove('hidden');
        }
    }

    selectCustomer(customer) {
        this.pos.selectedCustomer = customer;

        // Hide Search Container
        const searchContainer = document.getElementById('customer-search-container');
        if (searchContainer) searchContainer.classList.add('hidden');

        // Show Selected Customer Card
        const selectedContainer = document.getElementById('pos-selected-customer');
        if (selectedContainer) selectedContainer.classList.remove('hidden');

        // Update Text
        const nameEl = document.getElementById('selected-customer-name');
        const docEl = document.getElementById('selected-customer-doc');

        if (nameEl) nameEl.textContent = customer.name;
        if (docEl) docEl.textContent = customer.document_number ? `CI: ${customer.document_number}` : 'Sin Documento';

        // Ensure deselect button event is bound (it usually is by bindEvents / cacheDOM, but good to check layout)
    }

    deselectCustomer() {
        this.pos.selectedCustomer = null;

        // Show Search Container
        const searchContainer = document.getElementById('customer-search-container');
        if (searchContainer) {
            searchContainer.classList.remove('hidden');
            searchContainer.style.display = 'block';
        }

        // Hide Selected Customer Card
        const selectedContainer = document.getElementById('pos-selected-customer');
        if (selectedContainer) selectedContainer.classList.add('hidden');

        // Reset and Focus Input (Safe DOM query)
        setTimeout(() => {
            // Force re-bind to clear any stuck state
            if (this.pos.bindCustomerSearchInput) {
                this.pos.bindCustomerSearchInput();
            }

            const input = document.getElementById('pos-customer-search');
            if (input) {
                input.value = '';
                input.disabled = false;
                input.readOnly = false; // Ensure not readonly
                input.classList.remove('hidden');
                input.style.display = 'block';
                input.setAttribute('placeholder', 'Buscar cliente (Nombre/CI)...');
                input.focus();

                // Update cache if needed
                if (this.pos.dom) this.pos.dom.customerSearchInput = input;
            } else {
                console.error('POS: Customer search input not found during deselect');
            }
        }, 50);

        // Hide ANY open results
        if (this.pos.dom.customerSearchResults) {
            this.pos.dom.customerSearchResults.classList.add('hidden');
            this.pos.dom.customerSearchResults.innerHTML = '';
        }
    }
}
