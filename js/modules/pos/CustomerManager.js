import { api } from '../../api.js';
import { ui } from '../../ui.js';

export class CustomerManager {
    constructor(pos) {
        this.pos = pos;
        this.isLoading = false;
    }

    async loadCustomers() {
        // No-op or minimal init. We don't want to load thousands of customers on startup anymore.
        // Maybe load just the first 10 for the "Initial" view if desired?
        // ONE-TIME: Clear old huge cache to free memory
        if (localStorage.getItem('cached_customers')) {
            localStorage.removeItem('cached_customers');
            console.log('POS: Cleared legacy customer cache');
        }

        console.log('POS: CustomerManager ready (Remote Search Mode)');
    }

    async searchCustomers(query) {
        if (!query || query.length < 2) {
            if (this.pos.dom.customerSearchResults) this.pos.dom.customerSearchResults.classList.add('hidden');
            return;
        }

        this.isLoading = true;
        // Show loading state?
        const container = this.pos.dom.customerSearchResults;
        if (container) {
            container.classList.remove('hidden');
            container.innerHTML = '<div class="p-3 text-slate-500 text-center text-sm">Buscando...</div>';
        }

        try {
            console.log(`POS: Searching customers remotely: "${query}"`);
            const response = await api.customers.getAll(1, 20, query); // Page 1, Limit 20, Search Query

            // Handle both legacy array and new paginated object
            let results = [];
            if (Array.isArray(response)) {
                results = response;
            } else {
                results = response.customers || [];
            }

            this.renderCustomerSearchResults(results);

        } catch (error) {
            console.error('Error searching customers:', error);
            if (container) {
                container.innerHTML = '<div class="p-3 text-red-500 text-center text-sm">Error en búsqueda</div>';
            }
        } finally {
            this.isLoading = false;
        }
    }

    // This method was used by the checkout modal search
    async filterCustomerList(query, container) {
        if (!query || query.length < 2) return; // Wait for 2 chars

        try {
            // Re-use API logic but render to distinct container
            const response = await api.customers.getAll(1, 20, query);
            let results = [];
            if (Array.isArray(response)) {
                results = response;
            } else {
                results = response.customers || [];
            }
            this.renderCustomerSearchResults(results, container);
        } catch (error) {
            console.error('Error filtering customers for checkout:', error);
        }
    }

    renderCustomerSearchResults(results, container = null) {
        const target = container || this.pos.dom.customerSearchResults;
        if (!target) return;

        target.classList.remove('hidden');

        if (results.length === 0) {
            target.innerHTML = '<div class="p-3 text-slate-500 text-center text-sm">No se encontraron clientes</div>';
        } else {
            target.innerHTML = results.map(c => `
                <div class="customer-result-item p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 rounded-lg" data-id="${c.id}">
                    <div class="font-medium text-slate-900 dark:text-white">${c.name}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400">
                        ${c.idDocument ? `CI: ${c.idDocument}` : ''} ${c.email ? `• ${c.email}` : ''}
                    </div>
                </div>
            `).join('');

            // Bind click events
            target.querySelectorAll('.customer-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    // We need the full object. Since we don't have a global array anymore, find it in 'results'.
                    const customer = results.find(c => String(c.id) === String(id));

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
        if (docEl) docEl.textContent = customer.idDocument ? `CI: ${customer.idDocument}` : 'Sin Documento';
    }

    deselectCustomer() {
        this.pos.selectedCustomer = null;

        // Show Search Container
        const searchContainer = document.getElementById('customer-search-container');
        if (searchContainer) {
            searchContainer.classList.remove('hidden');
            searchContainer.style.display = 'block';

            // CRITICAL: Also un-hide the inner .relative container that holds the input
            const inputContainer = searchContainer.querySelector('.relative');
            if (inputContainer) {
                inputContainer.classList.remove('hidden');
                inputContainer.style.display = 'block';
            }
        }

        // Hide Selected Customer Card
        const selectedContainer = document.getElementById('pos-selected-customer');
        if (selectedContainer) selectedContainer.classList.add('hidden');

        // Hide ANY open results FIRST
        if (this.pos.dom.customerSearchResults) {
            this.pos.dom.customerSearchResults.classList.add('hidden');
            this.pos.dom.customerSearchResults.innerHTML = '';
        }

        // Re-bind input (this clones the element, so we must query AFTER)
        // Actually, re-render logic in POS might clobber this? 
        // POS.v4.js logic for deselect basically just calls this. 
        // We only need to focus, no need to re-bind events if elements are static in HTML.

        setTimeout(() => {
            const input = document.getElementById('pos-customer-search');
            if (input) {
                input.value = '';
                input.focus();
                // Update cached reference
                if (this.pos.dom) this.pos.dom.customerSearchInput = input;
            }
        }, 100);
    }
}


