import { api } from '../../api.js';
import { formatBs, roundBsUp, roundBsNearest, currencySettings } from '../../utils.js';
import { ui } from '../../ui.js';
import { sounds } from '../../sounds.js';

export class CheckoutManager {
    constructor(pos) {
        this.pos = pos;
        this.selectedPaymentMethodId = 'cash';
    }

    processCheckout(customer) {
        // Check if shift is open
        if (!this.pos.cashControlManager.currentShift) {
            ui.showNotification('Debe abrir la caja antes de realizar ventas', 'warning');
            this.pos.cashControlManager.showOpenModal();
            return;
        }

        this.pos.selectedCustomer = customer;
        this.pos.customerSelectionSkipped = !customer; // Set flag if skipped
        this.pos.hideCustomerSelection();

        if (this.pos.pendingHold) {
            this.pos.salesManager.holdSale();
            this.pos.pendingHold = false;
            return;
        }

        this.showPaymentModal();
    }

    showPaymentModal() {
        // ROBUST: Ensure Modal Exists
        let modal = this.pos.dom.paymentModal;
        if (!modal) {
            modal = document.getElementById('payment-modal');
            if (modal) this.pos.dom.paymentModal = modal;
        }

        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        } else {
            console.error('CheckoutManager: Payment Modal NOT found');
            return;
        }

        // Show confirm payment button (may have been hidden after previous sale)
        if (this.pos.dom.confirmPaymentBtn) {
            this.pos.dom.confirmPaymentBtn.classList.remove('hidden');
        }

        // Ensure methods are populated
        this.populatePaymentMethods();

        // Calculate totals
        const total = this.pos.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalBsRaw = total * this.pos.exchangeRate;
        // Round UP to nearest whole Bs (105.62 → 106)
        const totalBs = roundBsUp(totalBsRaw);

        // Currency-aware display
        const showBs = currencySettings.isBsEnabled();
        const showUsd = currencySettings.isUsdEnabled();

        // Update Total Display based on currency settings
        if (this.pos.dom.paymentTotalUsd) {
            if (showBs) {
                // Show Bs as primary
                this.pos.dom.paymentTotalUsd.textContent = formatBs(totalBs);
            } else {
                // USD only - show USD as primary
                this.pos.dom.paymentTotalUsd.textContent = `$${total.toFixed(2)}`;
            }
        }
        if (this.pos.dom.paymentTotalVes) {
            if (showBs && showUsd) {
                // Both currencies - show USD as secondary
                this.pos.dom.paymentTotalVes.textContent = `$${total.toFixed(2)}`;
                this.pos.dom.paymentTotalVes.style.display = '';
            } else {
                // Single currency - hide secondary
                this.pos.dom.paymentTotalVes.style.display = 'none';
            }
        }

        // Select default method (Cash)
        this.handlePaymentMethodClick('cash');

        // ROBUST: Ensure Payment Fields Container Exists
        let fieldsContainer = this.pos.dom.paymentFields;
        if (!fieldsContainer) {
            fieldsContainer = document.getElementById('payment-fields');
            if (fieldsContainer) this.pos.dom.paymentFields = fieldsContainer;
        }

        // Auto-fill amount for Cash USD
        if (fieldsContainer) {
            const cashUsdInput = fieldsContainer.querySelector('input[data-id="cash_usd"]');
            if (cashUsdInput) {
                cashUsdInput.value = total.toFixed(2);
                this.calculateChange();
            }
        } else {
            console.error('CheckoutManager: Payment Fields container NOT found');
        }

        // Show payment form, hide receipt
        if (this.pos.dom.paymentFormContent) this.pos.dom.paymentFormContent.classList.remove('hidden');
        if (this.pos.dom.receiptModalContent) this.pos.dom.receiptModalContent.classList.add('hidden');
    }

    hidePaymentModal() {
        if (this.pos.dom.paymentModal) {
            this.pos.dom.paymentModal.classList.add('hidden');
            this.pos.dom.paymentModal.style.display = 'none';
        }
    }

    populatePaymentMethods() {
        // ROBUST: Ensure container exists
        let container = this.pos.dom.paymentMethodOptions;
        if (!container) {
            container = document.getElementById('payment-method-options');
            if (container) this.pos.dom.paymentMethodOptions = container;
        }

        if (!container) {
            console.error('CheckoutManager: Payment Method Options container NOT found in DOM.');
            return;
        }

        container.innerHTML = '';

        // Ensure Cash exists
        if (!this.pos.paymentMethods.some(m => m.id === 'cash')) {
            this.pos.paymentMethods.unshift({ id: 'cash', name: 'Efectivo (USD/VES)', currency: 'MIXED' });
        }

        // Render Buttons
        this.pos.paymentMethods.forEach(method => {
            // Skip individual cash entries if they exist in the list (legacy)
            if (method.id === 'cash_usd' || method.id === 'cash_bs') return;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `payment-method-btn w-full py-3 px-4 rounded-lg border text-sm font-medium transition-all duration-200 ${method.id === this.selectedPaymentMethodId
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600 dark:text-white shadow-md'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600'
                } `;
            button.textContent = method.name;
            button.dataset.id = method.id;
            button.addEventListener('click', () => this.handlePaymentMethodClick(method.id));
            container.appendChild(button);
        });

        // Add Combined Option explicitly
        const combinedButton = document.createElement('button');
        combinedButton.type = 'button';
        combinedButton.className = `payment-method-btn w-full py-3 px-4 rounded-lg border text-sm font-medium transition-all duration-200 ${this.selectedPaymentMethodId === 'combined'
            ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600 dark:text-white shadow-md'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600'
            } `;
        combinedButton.textContent = 'Combinado (Múltiples)';
        combinedButton.dataset.id = 'combined';
        combinedButton.addEventListener('click', () => this.handlePaymentMethodClick('combined'));
        container.appendChild(combinedButton);

        // Add Fiado Option (only if customer has credit enabled)
        const customer = this.pos.selectedCustomer;
        if (customer && customer.creditLimit && customer.creditLimit > 0) {
            const availableCredit = (customer.creditLimit || 0) - (customer.creditBalance || 0);
            const cartTotal = this.pos.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const hasEnoughCredit = availableCredit >= cartTotal;

            const fiadoButton = document.createElement('button');
            fiadoButton.type = 'button';
            fiadoButton.className = `payment-method-btn w-full py-3 px-4 rounded-lg border text-sm font-medium transition-all duration-200 ${this.selectedPaymentMethodId === 'fiado'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : hasEnoughCredit
                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                } `;
            fiadoButton.innerHTML = `
                <span>💳 Crédito</span>
                <span class="block text-xs mt-1 ${hasEnoughCredit ? 'opacity-70' : 'text-red-500'}">
                    Disponible: $${availableCredit.toFixed(2)}
                </span>
            `;
            fiadoButton.dataset.id = 'fiado';

            if (hasEnoughCredit) {
                fiadoButton.addEventListener('click', () => this.handlePaymentMethodClick('fiado'));
            } else {
                fiadoButton.disabled = true;
                fiadoButton.title = 'Crédito insuficiente';
            }
            container.appendChild(fiadoButton);
        }

        this.onPaymentMethodChange();
    }

    handlePaymentMethodClick(methodId) {
        this.selectedPaymentMethodId = methodId;

        // ROBUST: Ensure container exists
        let container = this.pos.dom.paymentMethodOptions;
        if (!container) {
            container = document.getElementById('payment-method-options');
            if (container) this.pos.dom.paymentMethodOptions = container;
        }

        if (!container) {
            console.error('CheckoutManager: Cannot handle click, container not found.');
            return;
        }

        // Update UI
        const buttons = container.querySelectorAll('.payment-method-btn');
        buttons.forEach(btn => {
            if (btn.dataset.id === methodId) {
                btn.className = 'payment-method-btn w-full py-3 px-4 rounded-lg border text-sm font-medium transition-all duration-200 bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600 dark:text-white shadow-md';
            } else {
                btn.className = 'payment-method-btn w-full py-3 px-4 rounded-lg border text-sm font-medium transition-all duration-200 bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600';
            }
        });

        this.onPaymentMethodChange();
    }

    onPaymentMethodChange() {
        const methodId = this.selectedPaymentMethodId;
        this.pos.dom.paymentFields.innerHTML = '';

        let inputsToRender = [];

        if (methodId === 'cash') {
            inputsToRender.push(
                { id: 'cash_usd', name: 'Efectivo USD', currency: 'USD', placeholder: '0.00' },
                { id: 'cash_ves', name: 'Efectivo VES', currency: 'VES', placeholder: '0.00' }
            );
        } else if (methodId === 'combined') {
            // Cash first
            inputsToRender.push(
                { id: 'cash_usd', name: 'Efectivo USD', currency: 'USD', placeholder: '0.00' },
                { id: 'cash_ves', name: 'Efectivo VES', currency: 'VES', placeholder: '0.00' }
            );
            // Then all others
            this.pos.paymentMethods.forEach(m => {
                if (m.id !== 'cash' && m.id !== 'combined' && m.id !== 'cash_usd' && m.id !== 'cash_bs') {
                    inputsToRender.push({
                        id: m.id,
                        name: m.name,
                        currency: m.currency || 'VES',
                        placeholder: '0.00',
                        requiresReference: m.requiresReference
                    });
                }
            });
        } else {
            // Single specific method
            const method = this.pos.paymentMethods.find(m => m.id === methodId);
            if (method) {
                inputsToRender.push({
                    id: method.id,
                    name: method.name,
                    currency: method.currency || 'VES',
                    placeholder: '0.00',
                    requiresReference: method.requiresReference
                });
            }
        }

        // Determine Layout Class
        const layoutClass = methodId === 'combined'
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2'
            : 'space-y-3 mb-4';

        // Generate HTML
        let html = `<div class="${layoutClass}">`;

        inputsToRender.forEach(input => {
            const showRef = input.requiresReference || input.id === 'pago_movil' || input.name.toLowerCase().includes('pago movil');
            const isUsd = input.currency === 'USD';
            const icon = isUsd ? '$' : 'Bs';
            const borderColor = isUsd ? 'focus-within:border-green-500' : 'focus-within:border-blue-500';
            const iconBg = isUsd ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

            html += `
                <div class="payment-input-group bg-slate-50 dark:bg-slate-700/30 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors ${borderColor}">
                    <div class="flex justify-between items-center mb-1">
                        <label class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate pr-2" title="${input.name}">${input.name}</label>
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${iconBg}">${input.currency}</span>
                    </div>
                    
                    <div class="space-y-2">
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                <span class="text-slate-400 dark:text-slate-500 font-bold text-xs">${icon}</span>
                            </div>
                            <input type="number" class="payment-input w-full pl-7 pr-8 py-1.5 text-sm rounded-md border-0 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-inset focus:ring-indigo-500" data-currency="${input.currency}" data-id="${input.id}" step="any" min="0" placeholder="${input.placeholder}" />
                            <button type="button" class="clear-input-btn absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors hidden" data-for="${input.id}">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        ${showRef ? `
                        <div class="relative">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span class="text-slate-400 dark:text-slate-500 text-xs">#</span>
                            </div>
                            <input type="text" data-ref-for="${input.id}" class="payment-ref w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-0 border-0 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500" placeholder="Referencia" />
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        this.pos.dom.paymentFields.innerHTML = html;

        // Bind events
        this.pos.dom.paymentFields.querySelectorAll('.payment-input').forEach(input => {
            const clearBtn = input.parentElement.querySelector('.clear-input-btn');

            // Toggle clear button visibility
            const toggleClearBtn = () => {
                if (clearBtn) {
                    if (input.value && input.value !== '0') {
                        clearBtn.classList.remove('hidden');
                    } else {
                        clearBtn.classList.add('hidden');
                    }
                }
            };

            input.addEventListener('input', () => {
                toggleClearBtn();
                this.calculateChange();
            });

            // Add focus effect to parent group
            input.addEventListener('focus', function () {
                this.closest('.payment-input-group').classList.add('ring-2', 'ring-indigo-500/20', 'border-indigo-400');
            });
            input.addEventListener('blur', function () {
                this.closest('.payment-input-group').classList.remove('ring-2', 'ring-indigo-500/20', 'border-indigo-400');
            });

            // Initial toggle
            toggleClearBtn();
        });

        // Bind clear button clicks
        this.pos.dom.paymentFields.querySelectorAll('.clear-input-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const inputId = btn.dataset.for;
                const input = this.pos.dom.paymentFields.querySelector(`input[data-id="${inputId}"]`);
                if (input) {
                    input.value = '';
                    input.dispatchEvent(new Event('input'));
                    input.focus();
                }
            });
        });

        // Reset change display
        this.calculateChange();
    }

    calculateChange() {
        const total = this.pos.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let paidUsd = 0;
        let paidBs = 0;

        // Unified calculation: Iterate over ALL visible payment inputs
        const inputs = this.pos.dom.paymentFields.querySelectorAll('.payment-input');
        inputs.forEach(input => {
            const val = parseFloat(input.value || 0);
            const currency = input.dataset.currency;
            if (currency === 'USD') {
                paidUsd += val;
            } else {
                paidBs += val;
            }
        });

        const paidTotalInUsd = paidUsd + (paidBs / (this.pos.exchangeRate || 1));
        const changeUsd = paidTotalInUsd - total;
        const changeBsRaw = changeUsd * this.pos.exchangeRate;
        // Round change to nearest whole Bs
        const changeBs = roundBsNearest(changeBsRaw);

        if (changeUsd >= 0) {
            this.pos.dom.paymentChange.innerHTML = `
                <div class="flex flex-col items-center justify-center">
                    <span class="text-sm text-green-600 dark:text-green-400 font-medium">Cambio</span>
                    <div class="text-xl font-bold text-green-600 dark:text-green-400">
                        Bs ${changeBs.toLocaleString('es-VE')}
                    </div>
                    <div class="text-sm font-medium text-green-600 dark:text-green-400">
                        $${changeUsd.toFixed(2)}
                    </div>
                </div>
            `;
        } else {
            const missing = Math.abs(changeUsd);
            const missingBs = missing * this.pos.exchangeRate;
            this.pos.dom.paymentChange.innerHTML = `
                <div class="flex flex-col items-center justify-center">
                    <span class="text-sm text-red-500 dark:text-red-400 font-medium">Faltan</span>
                    <div class="text-xl font-bold text-red-600 dark:text-red-400">
                        Bs ${missingBs.toFixed(2)}
                    </div>
                    <div class="text-sm font-medium text-red-600 dark:text-red-400">
                        $${missing.toFixed(2)}
                    </div>
                </div>
            `;
        }
    }

    async confirmPayment() {
        const total = this.pos.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Handle FIADO payment
        if (this.selectedPaymentMethodId === 'fiado') {
            if (!this.pos.selectedCustomer || !this.pos.selectedCustomer.id) {
                ui.showNotification('Se requiere un cliente para venta a crédito', 'error');
                return;
            }

            const saleData = {
                items: this.pos.cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    isWeighted: item.isWeighted,
                    category: item.category || 'Otros'
                })),
                total: total,
                customer: this.pos.selectedCustomer,
                customerId: this.pos.selectedCustomer.id,
                paymentMethod: 'fiado',
                paymentMethods: [{ method: 'fiado', amount: total, currency: 'USD' }],
                exchangeRate: this.pos.exchangeRate,
                timestamp: new Date().toISOString()
            };

            try {
                const createdSale = await api.sales.create(saleData);
                this.pos.lastSale = createdSale;
                this.handleSuccessfulSale(createdSale);
                ui.showNotification('Venta a crédito registrada', 'success');
            } catch (error) {
                console.error('Error processing fiado sale:', error);
                ui.showNotification(error.message || 'Error al procesar venta a crédito', 'error');
            }
            return;
        }

        // Handle normal payments
        let paidUsd = 0;
        let paidBs = 0;

        const inputs = this.pos.dom.paymentFields.querySelectorAll('.payment-input');
        inputs.forEach(input => {
            const val = parseFloat(input.value || 0);
            const currency = input.dataset.currency;
            if (currency === 'USD') {
                paidUsd += val;
            } else {
                paidBs += val;
            }
        });

        const paidTotalInUsd = paidUsd + (paidBs / (this.pos.exchangeRate || 1));

        if (paidTotalInUsd < total - 0.01) {
            ui.showNotification('Monto insuficiente', 'warning');
            return;
        }

        // Construct Payment Details
        const paymentDetails = [];
        inputs.forEach(input => {
            const val = parseFloat(input.value || 0);
            if (val > 0) {
                const id = input.dataset.id;
                const refInput = this.pos.dom.paymentFields.querySelector(`input[data-ref-for="${id}"]`);
                const ref = refInput ? refInput.value : '';
                paymentDetails.push({
                    method: id,
                    amount: val,
                    currency: input.dataset.currency,
                    reference: ref
                });
            }
        });

        const saleData = {
            items: this.pos.cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                isWeighted: item.isWeighted,
                category: item.category || 'Otros'
            })),
            total: total,
            customer: this.pos.selectedCustomer, // Can be null
            customerId: this.pos.selectedCustomer?.id || null,
            paymentMethods: paymentDetails,
            exchangeRate: this.pos.exchangeRate,
            timestamp: new Date().toISOString()
        };

        try {
            const createdSale = await api.sales.create(saleData);
            this.pos.lastSale = createdSale;
            this.handleSuccessfulSale(createdSale);
        } catch (error) {
            console.error('Error processing sale:', error);

            // Offline Sales Fallback
            // If network error (or specific 5xx, though fetch usually throws on network only if we handle it right in api.js)
            // api.js throws 'Failed to fetch' or similar on network issues.

            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || !navigator.onLine)) {
                console.log('POS: Network error detected. Saving to Offline Queue.');

                const offlineQueue = JSON.parse(localStorage.getItem('offline_sales_queue') || '[]');

                // Add a temporary local ID
                saleData.id = 'offline-' + Date.now();
                saleData.isOffline = true;

                offlineQueue.push(saleData);
                localStorage.setItem('offline_sales_queue', JSON.stringify(offlineQueue));

                ui.showNotification('Sin conexión. Venta guardada localmente.', 'info');

                // Treat as success for UI purposes
                this.pos.lastSale = saleData;
                this.handleSuccessfulSale(saleData);

                // Trigger sync attempt in background (if connection flapped back)
                // this.pos.syncOfflineSales(); // We'll add this method to POS next
            } else {
                ui.showNotification('Error al procesar la venta: ' + error.message, 'error');
            }
        }
    }

    handleSuccessfulSale(sale) {
        this.pos.cart = [];
        this.pos.selectedCustomer = null;
        this.pos.customerSelectionSkipped = false;
        this.pos.renderCart();
        // this.hidePaymentModal(); // Keep modal open for receipt
        this.pos.receiptManager.showReceipt(sale);

        // Hide confirm payment button since sale is already complete
        if (this.pos.dom.confirmPaymentBtn) {
            this.pos.dom.confirmPaymentBtn.classList.add('hidden');
        }

        if (!sale.isOffline) {
            ui.showNotification('Venta procesada correctamente');
            sounds.success(); // Success chime
        }
    }
}

