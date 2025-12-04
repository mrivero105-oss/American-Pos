import { api } from './api.js';
import { ui } from './ui.js';
import { debounce } from './utils.js';
import { CartManager } from './modules/pos/CartManager.js';
import { ProductManager } from './modules/pos/ProductManager.js';
import { CustomerManager } from './modules/pos/CustomerManager.js';
import { SalesManager } from './modules/pos/SalesManager.js';
import { CheckoutManager } from './modules/pos/CheckoutManager.js';
import { ReceiptManager } from './modules/pos/ReceiptManager.js';
import { WeightModal } from './modules/pos/WeightModal.js';
import { Scanner } from './modules/pos/Scanner.js';
import { CashControlManager } from './modules/pos/CashControlManager.js';

export class POS {
    constructor() {
        window.pos = this;
        this.cart = [];
        this.products = [];
        this.customers = [];
        this.selectedCustomer = null;
        this.lastSale = null;
        this.exchangeRate = 1.0;
        this.businessInfo = {};
        this.paymentMethods = [];

        // Initialize Managers
        this.cartManager = new CartManager(this);
        this.productManager = new ProductManager(this);
        this.customerManager = new CustomerManager(this);
        this.salesManager = new SalesManager(this);
        this.checkoutManager = new CheckoutManager(this);
        this.receiptManager = new ReceiptManager(this);
        this.weightModal = new WeightModal(this);
        this.scanner = new Scanner(this);
        this.cashControlManager = new CashControlManager(this);

        // Pagination State (Delegated to ProductManager)
        // this.currentPage = 1; // Now in productManager
        // this.itemsPerPage = 48; // Now in productManager
        // this.currentFilteredProducts = []; // Now in productManager

        this.customerSearchHighlightIndex = -1; // Track highlighted result

        console.log('POS: Calling init()');
        this.init();
    }

    async init() {
        console.log('POS: init() started');
        window.pos = this;
        // Global helper for the HTML button
        window.manualOpenPriceCheck = () => this.openPriceCheck();
        try {
            this.cacheDOM();
            console.log('POS: cacheDOM finished');

            this.showLoading(); // Show loading overlay

            this.bindEvents();
            console.log('POS: bindEvents finished');

            // Parallelize data loading
            console.time('POS Initialization');
            await Promise.all([
                this.loadSettings(),
                this.loadProducts(),
                this.loadCustomers(),
                this.cashControlManager.init()
            ]);
            console.timeEnd('POS Initialization');
            console.log('POS: Data loading finished');

            this.renderCategories();
            console.log('POS: renderCategories finished');

            this.checkHeldSale();
            this.renderCart();

            // Initial Focus
            if (this.dom.customerSearchInput) {
                this.dom.customerSearchInput.focus();
            }

            console.log('POS: init() completed successfully');
        } catch (error) {
            console.error('POS: Critical error during init:', error);
            ui.showNotification('Error crítico al iniciar POS: ' + error.message, 'error');
        } finally {
            this.hideLoading(); // Hide loading overlay
        }
    }

    showLoading() {
        const overlay = document.getElementById('pos-loading-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('pos-loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
    }

    cacheDOM() {
        this.dom = {
            productGrid: document.getElementById('product-grid'),
            categoryFilters: document.getElementById('category-filters'),
            cartItems: document.getElementById('cart-items'),
            cartTotal: document.getElementById('cart-total'),
            cartTotalBs: document.getElementById('cart-total-bs'),
            searchInput: document.getElementById('search-input'),
            checkoutBtn: document.getElementById('checkout-btn'),
            clearCartBtn: document.getElementById('clear-cart-btn'),
            holdSaleBtn: document.getElementById('hold-sale-btn'),
            viewHeldSalesBtn: document.getElementById('view-held-sales-btn'),
            heldCountBadge: document.getElementById('held-count-badge'),
            heldSalesDrawer: document.getElementById('held-sales-drawer'),
            heldSalesList: document.getElementById('held-sales-list'),
            closeHeldDrawerBtn: document.getElementById('close-held-drawer-btn'),
            mobileCartCount: document.getElementById('mobile-cart-count'),
            mobileCartItems: document.getElementById('mobile-cart-items-container'),
            desktopCartToggle: document.getElementById('desktop-cart-toggle'),
            cartToggleIcon: document.getElementById('cart-toggle-icon'),

            // Mobile Menu
            mobileMenuBtn: document.getElementById('mobile-menu-btn'),
            sidebar: document.getElementById('sidebar'),
            mobileOverlay: document.getElementById('mobile-overlay'),
            mobileCartBtn: document.getElementById('mobile-cart-btn'),
            cartSidebar: document.getElementById('cart-sidebar'), // Desktop
            mobileCartSidebar: document.getElementById('mobile-cart-sidebar'), // Mobile
            closeCartBtn: document.getElementById('close-cart-btn'),
            closeMobileCartBtn: document.getElementById('close-mobile-cart-btn'),

            paymentReceivedVes: document.getElementById('payment-received-ves'),
            paymentAmount: document.getElementById('payment-amount'),
            paymentMethodOptions: document.getElementById('payment-method-options'),
            paymentFields: document.getElementById('payment-fields'),
            paymentChange: document.getElementById('payment-change'),
            paymentModal: document.getElementById('payment-modal'),
            paymentFormContent: document.getElementById('payment-form-content'),
            receiptModalContent: document.getElementById('receipt-modal-content'),
            receiptContent: document.getElementById('receipt-content'),
            paymentTotalUsd: document.getElementById('payment-total-usd'),
            paymentTotalVes: document.getElementById('payment-total-ves'),
            cancelPaymentBtn: document.getElementById('cancel-payment-btn'),
            confirmPaymentBtn: document.getElementById('confirm-payment-btn'),
            closeReceiptBtn: document.getElementById('close-receipt'),
            emailReceiptBtn: document.getElementById('email-receipt-btn'),
            printReceiptBtn: document.getElementById('print-receipt-btn'),

            // Price Check
            priceCheckBtn: document.getElementById('price-check-btn'),
            closePriceCheckBtn: document.getElementById('close-price-check-btn'),
            priceCheckModal: document.getElementById('price-check-modal'),
            priceCheckInput: document.getElementById('price-check-input'),
            priceCheckPlaceholder: document.getElementById('price-check-placeholder'),
            priceCheckResult: document.getElementById('price-check-result'),
            priceCheckList: document.getElementById('price-check-list'),
            priceCheckImg: document.getElementById('price-check-img'),
            priceCheckName: document.getElementById('price-check-name'),
            priceCheckBarcode: document.getElementById('price-check-barcode'),
            priceCheckUsd: document.getElementById('price-check-usd'),
            priceCheckBs: document.getElementById('price-check-bs'),
            priceCheckStock: document.getElementById('price-check-stock'),

            // Custom Item
            cancelWeightBtn: document.getElementById('cancel-weight-btn'),
            cancelWeightBtnX: document.getElementById('close-weight-modal'),
            weightModal: document.getElementById('weight-modal'),
            weightModalTitle: document.getElementById('weight-modal-product-name'),
            weightModalUnitPrice: document.getElementById('weight-modal-unit-price'),
            weightInput: document.getElementById('weight-input'),
            weightPriceUsd: document.getElementById('weight-price-usd'),
            weightPriceBs: document.getElementById('weight-price-bs'), // Note: ID in HTML is weight-price-input for USD, need to check if BS input exists or if I should map correctly
            confirmWeightBtn: document.getElementById('confirm-weight-btn'),

            // Customer Search Elements
            customerSearchInput: document.getElementById('pos-customer-search'),
            customerSearchResults: document.getElementById('pos-customer-results'),
            customerSearchContainer: document.getElementById('customer-search-container'),
            selectedCustomerDisplay: document.getElementById('pos-selected-customer'),
            selectedCustomerName: document.getElementById('selected-customer-name'),
            selectedCustomerDoc: document.getElementById('selected-customer-doc'),
            deselectCustomerBtn: document.getElementById('deselect-customer-btn'),

            // Confirmation Modal
            confirmationModal: document.getElementById('confirmation-modal'),
            confirmModalTitle: document.getElementById('confirm-modal-title'),
            confirmModalMessage: document.getElementById('confirm-modal-message'),
            confirmActionBtn: document.getElementById('confirm-action-btn'),
            cancelConfirmBtn: document.getElementById('cancel-confirm-btn'),
            confirmModalIconContainer: document.getElementById('confirm-modal-icon-container'),
        };

        this.lastScanTime = 0;

        // Fallback/Retry for critical elements if not found immediately
        if (!this.dom.priceCheckBtn) {
            console.warn('POS: price-check-btn not found by ID, trying querySelector');
            this.dom.priceCheckBtn = document.querySelector('button[title="Consultar Precio (F3)"]');
        }
    }

    bindEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        try {
            // Payment
            if (this.dom.cancelPaymentBtn) this.dom.cancelPaymentBtn.addEventListener('click', () => this.hidePaymentModal());
            if (this.dom.confirmPaymentBtn) this.dom.confirmPaymentBtn.addEventListener('click', () => this.confirmPayment());

            // Header Total Clicks (Quick Fill)
            if (this.dom.paymentTotalUsd) {
                this.dom.paymentTotalUsd.addEventListener('click', () => {
                    const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    if (this.selectedPaymentMethodId === 'cash') {
                        if (this.dom.paymentReceivedUsd) this.dom.paymentReceivedUsd.value = total.toFixed(2);
                        if (this.dom.paymentReceivedVes) this.dom.paymentReceivedVes.value = '';
                    } else {
                        if (this.dom.paymentAmount) this.dom.paymentAmount.value = total.toFixed(2);
                    }
                    this.calculateChange();
                });
            }

            // Search Input
            if (this.dom.searchInput) {
                this.dom.searchInput.addEventListener('input', (e) => {
                    const query = e.target.value;
                    this.filterProducts(query);
                });
            }

            // Price Check Input
            if (this.dom.priceCheckInput) {
                this.dom.priceCheckInput.addEventListener('input', (e) => {
                    const query = e.target.value;
                    this.searchPriceCheck(query);
                });
            }

            // Customer Search Input
            if (this.dom.customerSearchInput) {
                console.log('POS: Binding customer search input event');
                this.dom.customerSearchInput.addEventListener('input', (e) => {
                    const query = e.target.value;
                    console.log('POS: Customer search input event fired. Query:', query);
                    this.searchCustomers(query);
                });

                // Hide results when clicking outside
                document.addEventListener('click', (e) => {
                    if (this.dom.customerSearchContainer && !this.dom.customerSearchContainer.contains(e.target)) {
                        if (this.dom.customerSearchResults) this.dom.customerSearchResults.classList.add('hidden');
                    }
                });
            } else {
                console.error('POS: customerSearchInput not found during bindEvents');
            }

            // Deselect Customer
            if (this.dom.deselectCustomerBtn) {
                this.dom.deselectCustomerBtn.addEventListener('click', () => this.deselectCustomer());
            }

            // Scanner
            const btnScan = document.getElementById('pos-scan-btn');
            const btnCloseScan = document.getElementById('close-pos-scanner');
            if (btnScan) btnScan.addEventListener('click', () => this.startScanner());
            if (btnCloseScan) btnCloseScan.addEventListener('click', () => this.stopScanner());

            // Mobile Menu Toggle
            if (this.dom.mobileMenuBtn) {
                this.dom.mobileMenuBtn.addEventListener('click', () => {
                    if (this.dom.sidebar) {
                        this.dom.sidebar.classList.remove('-translate-x-full');
                        if (this.dom.mobileOverlay) {
                            this.dom.mobileOverlay.classList.remove('hidden');
                            this.dom.mobileOverlay.style.display = 'block';
                        }
                    }
                });
            }

            // Mobile Cart Toggles
            if (this.dom.mobileCartBtn) {
                this.dom.mobileCartBtn.addEventListener('click', () => {
                    if (this.dom.mobileCartSidebar) {
                        this.dom.mobileCartSidebar.style.display = 'flex';
                        // Small delay to ensure display:flex applies before transform
                        requestAnimationFrame(() => {
                            this.dom.mobileCartSidebar.style.transform = ''; // Clear inline style to allow class to work
                            this.dom.mobileCartSidebar.classList.remove('translate-x-full');
                            if (this.dom.mobileOverlay) {
                                this.dom.mobileOverlay.classList.remove('hidden');
                                this.dom.mobileOverlay.style.display = 'block';
                            }
                        });
                    }
                });
            }

            if (this.dom.closeCartBtn) {
                this.dom.closeCartBtn.addEventListener('click', () => {
                    if (this.dom.mobileCartSidebar) {
                        this.dom.mobileCartSidebar.classList.add('translate-x-full');
                        // Optional: restore inline style after transition, but class should suffice if it works.
                        // For safety, we can leave it cleared as the class takes over.
                        if (this.dom.mobileOverlay) this.dom.mobileOverlay.classList.add('hidden');
                    }
                });
            }

            // Mobile Overlay Click
            if (this.dom.mobileOverlay) {
                this.dom.mobileOverlay.addEventListener('click', () => {
                    // Close Mobile Cart
                    if (this.dom.mobileCartSidebar) this.dom.mobileCartSidebar.classList.add('translate-x-full');
                    // Close Sidebar
                    if (this.dom.sidebar) this.dom.sidebar.classList.add('-translate-x-full');
                    // Close Held Sales
                    this.closeHeldSalesDrawer();

                    this.dom.mobileOverlay.classList.add('hidden');
                });
            }




            // Cart Actions
            if (this.dom.clearCartBtn) this.dom.clearCartBtn.addEventListener('click', () => this.clearCart());
            if (this.dom.holdSaleBtn) this.dom.holdSaleBtn.addEventListener('click', () => this.holdSale());
            const handleCartAction = (e) => {
                const target = e.target;
                const cartItem = target.closest('.cart-item');
                if (!cartItem) return;
                const id = cartItem.dataset.id;

                // Remove Item
                if (target.closest('.remove-item')) {
                    this.removeFromCart(id);
                    return;
                }

                // Increase Qty
                if (target.closest('.increase-qty')) {
                    this.updateQuantity(id, 1);
                    return;
                }

                // Decrease Qty
                if (target.closest('.decrease-qty')) {
                    this.updateQuantity(id, -1);
                    return;
                }
            };

            const handleCartInput = (e) => {
                if (e.target.classList.contains('qty-input')) {
                    const cartItem = e.target.closest('.cart-item');
                    if (!cartItem) return;
                    const id = cartItem.dataset.id;
                    const newQty = parseFloat(e.target.value); // Use parseFloat
                    if (!isNaN(newQty) && newQty > 0) {
                        this.setQuantity(id, newQty);
                    }
                }
            };

            if (this.dom.cartItems) {
                this.dom.cartItems.addEventListener('click', handleCartAction);
                this.dom.cartItems.addEventListener('change', handleCartInput);
            }

            if (this.dom.mobileCartItems) {
                this.dom.mobileCartItems.addEventListener('click', handleCartAction);
                this.dom.mobileCartItems.addEventListener('change', handleCartInput);
            }

            // Held Sales List Delegation
            if (this.dom.heldSalesList) {
                this.dom.heldSalesList.addEventListener('click', (e) => {
                    console.log('POS: Held sales list clicked', e.target);
                    const restoreBtn = e.target.closest('.restore-held-btn');
                    if (restoreBtn) {
                        console.log('POS: Restore button clicked', restoreBtn.dataset.id);
                        this.restoreSale(restoreBtn.dataset.id);
                        return;
                    }

                    const deleteBtn = e.target.closest('.delete-held-btn');
                    if (deleteBtn) {
                        console.log('POS: Delete button clicked', deleteBtn.dataset.id);
                        this.deleteHeldSale(deleteBtn.dataset.id);
                        return;
                    }
                });
            }

            // Customer Selection
            if (this.dom.skipCustomerBtn) this.dom.skipCustomerBtn.addEventListener('click', () => this.processCheckout(null));
            if (this.dom.closeCustomerSelection) this.dom.closeCustomerSelection.addEventListener('click', () => this.hideCustomerSelection());

            // Price Check
            if (this.dom.priceCheckBtn) {
                this.dom.priceCheckBtn.addEventListener('click', () => this.openPriceCheck());
            } else {
                console.error('POS: Price Check Button not found during bindEvents');
                // Try to bind later or delegate?
                document.addEventListener('click', (e) => {
                    if (e.target.closest('#price-check-btn')) {

                        // Global Keyboard Shortcuts
                        document.addEventListener('keydown', (e) => {
                            if (e.key === 'F3') {
                                e.preventDefault();
                                this.togglePriceCheck();
                            }
                        });
                        if (this.dom.searchCustomerCheckout) this.dom.searchCustomerCheckout.addEventListener('input', (e) => this.filterCustomers(e.target.value));
                        if (this.dom.customerListCheckout) this.dom.customerListCheckout.addEventListener('click', (e) => this.handleCustomerSelect(e));

                        // Receipt Actions
                        if (this.dom.closeReceiptBtn) this.dom.closeReceiptBtn.addEventListener('click', () => this.hideReceipt());
                        if (this.dom.emailReceiptBtn) this.dom.emailReceiptBtn.addEventListener('click', () => this.emailReceipt());
                        if (this.dom.printReceiptBtn) this.dom.printReceiptBtn.addEventListener('click', () => this.printReceipt());

                        // Global Shortcuts
                        document.addEventListener('keydown', (e) => {
                            if (e.key === 'Escape') {
                                // Check if payment/receipt modal is open
                                if (this.dom.paymentModal && !this.dom.paymentModal.classList.contains('hidden')) {
                                    // If receipt content is visible, use hideReceipt to reset state properly
                                    if (this.dom.receiptModalContent && !this.dom.receiptModalContent.classList.contains('hidden')) {
                                        this.hideReceipt();
                                    } else {
                                        // Otherwise it's the payment form
                                        this.hidePaymentModal();
                                    }
                                }
                                // Close search results if open
                                if (this.dom.customerSearchResults && !this.dom.customerSearchResults.classList.contains('hidden')) {
                                    this.dom.customerSearchResults.classList.add('hidden');
                                }
                            }
                        });

                        // New Customer Search Events
                        if (this.dom.customerSearchInput) {
                            this.dom.customerSearchInput.addEventListener('input', (e) => {
                                console.log('Input event fired (debounced):', e.target.value);
                                this.handleCustomerSearch(e.target.value);
                            });

                            // Keyboard Navigation
                            this.dom.customerSearchInput.addEventListener('keydown', (e) => {
                                const resultsContainer = this.dom.customerSearchResults;
                                if (resultsContainer.classList.contains('hidden')) return;

                                const items = resultsContainer.querySelectorAll('div[onclick]');
                                if (items.length === 0) return;

                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    this.customerSearchHighlightIndex++;
                                    if (this.customerSearchHighlightIndex >= items.length) this.customerSearchHighlightIndex = 0;
                                    this.updateCustomerSearchHighlight(items);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    this.customerSearchHighlightIndex--;
                                    if (this.customerSearchHighlightIndex < 0) this.customerSearchHighlightIndex = items.length - 1;
                                    this.updateCustomerSearchHighlight(items);
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (this.customerSearchHighlightIndex >= 0 && this.customerSearchHighlightIndex < items.length) {
                                        items[this.customerSearchHighlightIndex].click();
                                    }
                                }
                            });

                            // Close results when clicking outside
                            document.addEventListener('click', (e) => {
                                if (!this.dom.customerSearchContainer.contains(e.target)) {
                                    this.dom.customerSearchResults.classList.add('hidden');
                                }
                            });
                        }

                        if (this.dom.deselectCustomerBtn) {
                            this.dom.deselectCustomerBtn.addEventListener('click', () => this.deselectCustomer());
                        }

                        // Custom Item Modal
                        const btnCustom = document.getElementById('custom-item-btn');
                        if (btnCustom) btnCustom.addEventListener('click', () => this.openCustomItemModal());
                        if (this.dom.cancelCustomItemBtn) this.dom.cancelCustomItemBtn.addEventListener('click', () => this.closeCustomItemModal());
                        if (this.dom.customItemForm) this.dom.customItemForm.addEventListener('submit', (e) => this.handleCustomItemSubmit(e));

                        // Product Grid Click (Add to Cart)
                        if (this.dom.productGrid) {
                            this.dom.productGrid.addEventListener('click', (e) => {
                                const card = e.target.closest('.product-card');
                                if (card) {
                                    const id = card.dataset.id;
                                    // Use loose equality for ID matching just in case
                                    const product = this.products.find(p => p.id == id);

                                    if (product) {
                                        // Check stock if needed, though UI handles disabled state
                                        if (parseInt(product.stock || 0) > 0) {
                                            this.addToCart(product);
                                        } else {
                                            ui.showNotification('Producto agotado', 'warning');
                                        }
                                    }
                                }
                            });
                        }

                        // Weight Modal Events
                        if (this.dom.weightInput) {
                            this.dom.weightInput.addEventListener('input', () => this.calculateWeightValues('weight'));
                            this.dom.weightInput.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    this.confirmWeightItem();
                                }
                            });
                        }
                        if (this.dom.weightPriceUsd) {
                            this.dom.weightPriceUsd.addEventListener('input', () => this.calculateWeightValues('usd'));
                            this.dom.weightPriceUsd.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    this.confirmWeightItem();
                                }
                            });
                        }
                        if (this.dom.weightPriceBs) {
                            this.dom.weightPriceBs.addEventListener('input', () => this.calculateWeightValues('bs'));
                            this.dom.weightPriceBs.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    this.confirmWeightItem();
                                }
                            });
                        }

                        if (this.dom.cancelWeightBtn) this.dom.cancelWeightBtn.addEventListener('click', () => this.closeWeightModal());
                        if (this.dom.cancelWeightBtnX) this.dom.cancelWeightBtnX.addEventListener('click', () => this.closeWeightModal());
                        if (this.dom.confirmWeightBtn) this.dom.confirmWeightBtn.addEventListener('click', () => this.confirmWeightItem());

                        const weightForm = document.getElementById('weight-item-form');
                        if (weightForm) {
                            weightForm.addEventListener('submit', (e) => this.confirmWeightItem(e));
                        }

                        if (this.dom.desktopCartToggle) {
                            this.dom.desktopCartToggle.addEventListener('click', () => this.toggleCartSidebar());
                        }

                        // Handle window resize to reset cart state if needed
                        window.addEventListener('resize', () => {
                            if (window.innerWidth >= 768) {
                                this.updateCartToggleState();
                                this.syncMainContentMargin();
                            }
                        });

                        // Initial sync
                        setTimeout(() => this.syncMainContentMargin(), 100);

                    } catch (error) {
                        console.error('Error binding events:', error);
                    }
                }

    async startScanner() {
                    this.scanner.startScanner();
                }

    async stopScanner() {
                    this.scanner.stopScanner();
                }

    handleScan(barcode) {
                    this.scanner.handleScan(barcode);
                }

    async loadSettings() {
                    try {
                        const [rateData, businessData, paymentMethods] = await Promise.all([
                            api.settings.getRate(),
                            api.settings.getBusinessInfo(),
                            api.settings.getPaymentMethods()
                        ]);
                        this.exchangeRate = rateData.rate || 1.0;
                        this.businessInfo = businessData || {};
                        this.paymentMethods = paymentMethods || [];
                    } catch(error) {
                        console.error('Error loading settings', error);
                    }
                }

    async loadProducts() {
                    await this.productManager.loadProducts();
                }

    async loadCustomers() {
                    await this.customerManager.loadCustomers();
                }

    renderProducts(products = null) {
                    this.productManager.renderProducts(products);
                }

    changePage(newPage) {
                    this.productManager.changePage(newPage);
                }

    renderCategories() {
                    this.productManager.renderCategories();
                }


    filterByCategory(category) {
                    this.productManager.filterByCategory(category);
                }

    filterProducts(query) {
                    this.productManager.filterProducts(query);
                }

    handleGridClick(e) {
                    this.productManager.handleGridClick(e);
                }

    addToCart(productOrId, quantity = 1) {
                    this.cartManager.addToCart(productOrId, quantity);
                }

    openWeightModal(product) {
                    this.weightModal.openWeightModal(product);
                }

    closeWeightModal() {
                    this.weightModal.closeWeightModal();
                }

    calculateWeightValues(source) {
                    this.weightModal.calculateWeightValues(source);
                }

    confirmWeightItem() {
                    this.weightModal.confirmWeightItem();
                }

    searchCustomers(query) {
                    if(!query || query.length < 2) {
                    if (this.dom.customerSearchResults) this.dom.customerSearchResults.classList.add('hidden');
                    return;
                }

                const lowerQuery = query.toLowerCase();
                const results = this.customers.filter(c =>
                    c.name.toLowerCase().includes(lowerQuery) ||
                    (c.document_number && c.document_number.includes(lowerQuery))
                );

                this.renderCustomerSearchResults(results);
            }

            renderCustomerSearchResults(results) {
                if (!this.dom.customerSearchResults) return;

                if (results.length === 0) {
                    this.dom.customerSearchResults.innerHTML = '<div class="p-3 text-slate-500 text-center">No se encontraron clientes</div>';
                } else {
                    this.dom.customerSearchResults.innerHTML = results.map(c => `
                <div class="customer-result-item p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0" data-id="${c.id}">
                    <div class="font-medium text-slate-900 dark:text-white">${c.name}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400">${c.document_number || 'Sin documento'}</div>
                </div>
            `).join('');

                    // Bind click events
                    this.dom.customerSearchResults.querySelectorAll('.customer-result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const id = item.dataset.id;
                            const customer = this.customers.find(c => String(c.id) === String(id));
                            if (customer) {
                                this.selectCustomer(customer);
                            }
                        });
                    });
                }

                this.dom.customerSearchResults.classList.remove('hidden');
            }

            selectCustomer(customer) {
                this.selectedCustomer = customer;

                // Update UI
                if (this.dom.customerSearchInput) {
                    this.dom.customerSearchInput.value = customer.name;
                    this.dom.customerSearchInput.disabled = true;
                }

                if (this.dom.customerSearchResults) {
                    this.dom.customerSearchResults.classList.add('hidden');
                }

                if (this.dom.deselectCustomerBtn) {
                    this.dom.deselectCustomerBtn.classList.remove('hidden');
                }

                if (this.dom.customerDocumentDisplay) {
                    this.dom.customerDocumentDisplay.textContent = customer.document_number || 'Sin Documento';
                    this.dom.customerDocumentDisplay.parentElement.classList.remove('hidden');
                }
            }

            deselectCustomer() {
                this.selectedCustomer = null;

                // Update UI
                if (this.dom.customerSearchInput) {
                    this.dom.customerSearchInput.value = '';
                    this.dom.customerSearchInput.disabled = false;
                    this.dom.customerSearchInput.focus();
                }

                if (this.dom.deselectCustomerBtn) {
                    this.dom.deselectCustomerBtn.classList.add('hidden');
                }

                if (this.dom.customerDocumentDisplay) {
                    this.dom.customerDocumentDisplay.parentElement.classList.add('hidden');
                }
            }

            renderCart() {
                this.cartManager.renderCart();
            }

            renderCartItem(item) {
                return this.cartManager.renderCartItem(item);
            }

            handleCartClick(e) {
                this.cartManager.handleCartClick(e);
            }

            handleCartInput(e) {
                this.cartManager.handleCartInput(e);
            }

            checkHeldSale() {
                this.salesManager.checkHeldSale();
            }

            updateHeldSalesCount() {
                this.salesManager.updateHeldSalesCount();
            }

            initiateHoldSale() {
                this.salesManager.initiateHoldSale();
            }

            holdSale() {
                this.salesManager.holdSale();
            }

            showHeldSales() {
                this.salesManager.showHeldSales();
            }


            closeHeldSalesDrawer() {
                this.salesManager.closeHeldSalesDrawer();
            }

            renderHeldSalesList(heldSales) {
                this.salesManager.renderHeldSalesList(heldSales);
            }

            restoreSale(id) {
                this.salesManager.restoreSale(id);
            }

            deleteHeldSale(id) {
                console.log('POS: deleteHeldSale called for id', id);
                this.showConfirmationModal(
                    '¿Eliminar venta en espera?',
                    '¿Está seguro de eliminar esta venta en espera? Esta acción no se puede deshacer.',
                    () => {
                        this.salesManager.deleteHeldSale(id);
                    },
                    'Sí, Eliminar'
                );
            }

            openHeldSalesDrawer() {
                this.salesManager.showHeldSales();
            }

    async showCustomerSelection() {
                await this.customerManager.loadCustomers();
                if (!this.customers || this.customers.length === 0) {
                    this.processCheckout(null);
                    return;
                }
                this.customerManager.renderCustomerList(this.customers);
                if (this.dom.customerSelectionModal) {
                    this.dom.customerSelectionModal.classList.remove('hidden');
                    this.dom.customerSelectionModal.style.display = 'flex';
                }
                setTimeout(() => {
                    if (this.dom.searchCustomerCheckout) this.dom.searchCustomerCheckout.focus();
                }, 100);
            }

            hideCustomerSelection() {
                if (this.dom.customerSelectionModal) {
                    this.dom.customerSelectionModal.classList.add('hidden');
                    this.dom.customerSelectionModal.style.display = 'none';
                }
                if (this.dom.searchCustomerCheckout) this.dom.searchCustomerCheckout.value = '';
            }

            renderCustomerList(customers) {
                this.customerManager.renderCustomerList(customers);
            }

            filterCustomers(query) {
                this.customerManager.searchCustomers(query);
            }

            handleCustomerSelect(e) {
                this.customerManager.selectCustomer(e);
            }

            handleCustomerSearch(query) {
                this.customerManager.searchCustomers(query);
            }

            renderCustomerSearchResults(customers) {
                this.customerManager.renderCustomerSearchResults(customers);
            }

            selectCustomerById(id) {
                const customer = this.customers.find(c => String(c.id) === String(id));
                if (customer) this.customerManager.selectCustomer(customer);
            }

            selectCustomer(customer) {
                this.customerManager.selectCustomer(customer);
            }

            deselectCustomer() {
                this.customerManager.deselectCustomer();
            }

    async refreshData() {
                // Always reload settings to get latest payment methods/rates
                await this.loadSettings();

                // Only refresh products/customers if cache is missing (meaning it was invalidated by management views)
                if (!localStorage.getItem('cached_products') || !localStorage.getItem('cached_customers')) {
                    console.log('POS: Cache invalidated, refreshing data...');
                    await Promise.all([
                        this.loadProducts(),
                        this.loadCustomers()
                    ]);
                }
            }

            showInputModal(title, message, onConfirm, placeholder = '') {
                if (this.dom.inputModal) {
                    if (this.dom.inputModalTitle) this.dom.inputModalTitle.textContent = title;
                    if (this.dom.inputModalMessage) this.dom.inputModalMessage.textContent = message;
                    if (this.dom.inputModalValue) {
                        this.dom.inputModalValue.value = '';
                        this.dom.inputModalValue.placeholder = placeholder;
                    }

                    const confirmBtn = this.dom.confirmInputBtn;
                    const cancelBtn = this.dom.cancelInputBtn;

                    if (confirmBtn) {
                        const newConfirmBtn = confirmBtn.cloneNode(true);
                        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                        this.dom.confirmInputBtn = newConfirmBtn;

                        newConfirmBtn.addEventListener('click', () => {
                            const value = this.dom.inputModalValue.value;
                            if (onConfirm) onConfirm(value);
                            this.hideInputModal();
                        });
                    }

                    if (cancelBtn) {
                        const newCancelBtn = cancelBtn.cloneNode(true);
                        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                        this.dom.cancelInputBtn = newCancelBtn;

                        newCancelBtn.addEventListener('click', () => {
                            this.hideInputModal();
                        });
                    }

                    // Allow Enter key to confirm
                    if (this.dom.inputModalValue) {
                        const input = this.dom.inputModalValue;
                        const newInput = input.cloneNode(true);
                        input.parentNode.replaceChild(newInput, input);
                        this.dom.inputModalValue = newInput;

                        newInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                const value = this.dom.inputModalValue.value;
                                if (onConfirm) onConfirm(value);
                                this.hideInputModal();
                            }
                        });
                    }

                    this.dom.inputModal.classList.remove('hidden');
                    this.dom.inputModal.style.display = 'flex';
                    setTimeout(() => {
                        if (this.dom.inputModalValue) this.dom.inputModalValue.focus();
                    }, 100);
                }
            }

            hideInputModal() {
                if (this.dom.inputModal) {
                    this.dom.inputModal.classList.add('hidden');
                    this.dom.inputModal.style.display = 'none';
                }
            }

            removeFromCart(id) {
                this.cart = this.cart.filter(item => item.id !== id);
                this.renderCart();
            }

            updateQuantity(id, change) {
                const item = this.cart.find(i => i.id === id);
                if (item) {
                    const newQty = item.quantity + change;
                    if (newQty > 0 && newQty <= item.stock) {
                        item.quantity = newQty;
                        this.renderCart();
                    } else if (newQty > item.stock) {
                        ui.showNotification(`Stock máximo alcanzado(${item.stock})`, 'warning');
                    }
                }
            }

            setQuantity(id, qty) {
                const item = this.cart.find(i => i.id === id);
                if (item) {
                    if (qty > 0 && qty <= item.stock) {
                        item.quantity = qty;
                        this.renderCart();
                    } else if (qty > item.stock) {
                        ui.showNotification(`Stock máximo alcanzado(${item.stock})`, 'warning');
                        this.renderCart(); // Reset input
                    }
                }
            }

            clearCart() {
                if (this.cart.length === 0) return;

                this.showConfirmationModal(
                    '¿Vaciar Carrito?',
                    '¿Estás seguro de que deseas eliminar todos los productos del carrito? Esta acción no se puede deshacer.',
                    () => this.executeClearCart(),
                    'Sí, Vaciar'
                );
            }

            executeClearCart() {
                this.cart = [];
                this.selectedCustomer = null;
                this.customerSelectionSkipped = false;
                this.renderCart();
                this.hideConfirmationModal();
                ui.showNotification('Carrito vaciado');
            }

            showConfirmationModal(title, message, onConfirm, confirmText = 'Confirmar', onCancel = null, cancelText = 'Cancelar') {
                if (this.dom.confirmationModal) {
                    if (this.dom.confirmModalTitle) this.dom.confirmModalTitle.textContent = title;
                    if (this.dom.confirmModalMessage) this.dom.confirmModalMessage.textContent = message;

                    // Force update icon to animated trash can (Robust selector for cache issues)
                    const iconContainer = this.dom.confirmModalIconContainer ||
                        (this.dom.confirmationModal ? this.dom.confirmationModal.querySelector('.rounded-full') : null);

                    if (iconContainer) {
                        iconContainer.innerHTML = `
                    <svg class="w-10 h-10 text-red-600 dark:text-red-400 animate-tip-over overflow-visible" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                `;
                    }

                    const confirmBtn = this.dom.confirmActionBtn;
                    const cancelBtn = this.dom.cancelConfirmBtn;

                    if (confirmBtn) {
                        confirmBtn.textContent = confirmText;
                        // Remove old listeners by cloning
                        const newConfirmBtn = confirmBtn.cloneNode(true);
                        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                        this.dom.confirmActionBtn = newConfirmBtn;

                        newConfirmBtn.addEventListener('click', () => {
                            if (onConfirm) onConfirm();
                            this.hideConfirmationModal();
                        });
                    }

                    if (cancelBtn) {
                        cancelBtn.textContent = cancelText;
                        const newCancelBtn = cancelBtn.cloneNode(true);
                        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                        this.dom.cancelConfirmBtn = newCancelBtn;

                        newCancelBtn.addEventListener('click', () => {
                            if (onCancel) onCancel();
                            this.hideConfirmationModal();
                        });
                    }

                    this.dom.confirmationModal.classList.remove('hidden');
                    this.dom.confirmationModal.style.display = 'flex';
                }
            }

            hideConfirmationModal() {
                if (this.dom.confirmationModal) {
                    this.dom.confirmationModal.classList.add('hidden');
                    this.dom.confirmationModal.style.display = 'none';
                }
            }

            openCustomItemModal() {
                if (this.dom.customItemModal) {
                    this.dom.customItemModal.classList.remove('hidden');
                    this.dom.customItemModal.style.display = 'flex';
                }
                if (this.dom.customItemName) this.dom.customItemName.focus();
            }

            closeCustomItemModal() {
                if (this.dom.customItemModal) {
                    this.dom.customItemModal.classList.add('hidden');
                    this.dom.customItemModal.style.display = 'none';
                }
                if (this.dom.customItemForm) this.dom.customItemForm.reset();
            }

            handleCustomItemSubmit(e) {
                e.preventDefault();
                const name = this.dom.customItemName.value;
                const price = parseFloat(this.dom.customItemPriceUsd.value);

                if (!name || isNaN(price) || price <= 0) {
                    ui.showNotification('Datos inválidos', 'error');
                    return;
                }

                const customProduct = {
                    id: 'custom-' + Date.now(),
                    name: name,
                    price: price,
                    stock: 9999,
                    imageUri: 'https://via.placeholder.com/150?text=Custom',
                    isCustom: true
                };

                this.addToCart(customProduct);
                this.closeCustomItemModal();
                ui.showNotification('Item personalizado agregado', 'success');
            }




            processCheckout(customer) {
                this.checkoutManager.processCheckout(customer);
            }

            showPaymentModal() {
                this.checkoutManager.showPaymentModal();
            }

            hidePaymentModal() {
                this.checkoutManager.hidePaymentModal();
            }

            populatePaymentMethods() {
                this.checkoutManager.populatePaymentMethods();
            }

            handlePaymentMethodClick(methodId) {
                this.checkoutManager.handlePaymentMethodClick(methodId);
            }

            onPaymentMethodChange() {
                this.checkoutManager.onPaymentMethodChange();
            }



            calculateChange() {
                this.checkoutManager.calculateChange();
            }

    async confirmPayment() {
                this.checkoutManager.confirmPayment();
            }

            showReceipt(saleData) {
                this.receiptManager.showReceipt(saleData);
            }

            generateReceiptHtml(saleData) {
                return this.receiptManager.generateReceiptHtml(saleData);
            }

            hideReceipt() {
                this.receiptManager.hideReceipt();
            }

    async emailReceipt() {
                this.receiptManager.emailReceipt();
            }

            sendEmailInBackground(email) {
                this.receiptManager.sendEmailInBackground(email);
            }

            showEmailInputModal(callback) {
                this.receiptManager.showEmailInputModal(callback);
            }

            printReceipt() {
                this.receiptManager.printReceipt();
            }

            // Price Check Logic
            togglePriceCheck() {
                if (this.dom.priceCheckModal && !this.dom.priceCheckModal.classList.contains('hidden')) {
                    this.closePriceCheck();
                } else {
                    this.openPriceCheck();
                }
            }

            openPriceCheck() {
                if (this.dom.priceCheckModal) {
                    this.dom.priceCheckModal.classList.remove('hidden');
                    this.dom.priceCheckModal.style.display = 'flex';
                    this.resetPriceCheckUI();
                    if (this.dom.priceCheckInput) this.dom.priceCheckInput.focus();
                }
            }

            closePriceCheck() {
                if (this.dom.priceCheckModal) {
                    this.dom.priceCheckModal.classList.add('hidden');
                    this.dom.priceCheckModal.style.display = 'none';
                }
            }

            resetPriceCheckUI() {
                if (this.dom.priceCheckInput) this.dom.priceCheckInput.value = '';
                if (this.dom.priceCheckResult) this.dom.priceCheckResult.classList.add('hidden');
                if (this.dom.priceCheckList) {
                    this.dom.priceCheckList.classList.add('hidden');
                    this.dom.priceCheckList.innerHTML = '';
                }
                this.priceCheckSelectedIndex = -1;
            }

            searchPriceCheck(query) {
                if (!query) {
                    if (this.dom.priceCheckList) this.dom.priceCheckList.classList.add('hidden');
                    return;
                }

                const lowerQuery = query.toLowerCase();
                const results = this.products.filter(p =>
                    p.name.toLowerCase().includes(lowerQuery) ||
                    (p.barcode && p.barcode.includes(query))
                ).slice(0, 5); // Limit to 5 results

                this.displayPriceCheckList(results);
            }

            displayPriceCheckList(products) {
                if (!this.dom.priceCheckList) return;

                if (products.length === 0) {
                    this.dom.priceCheckList.classList.add('hidden');
                    return;
                }

                this.dom.priceCheckList.innerHTML = products.map((p, index) => `
        <div class="price-check-item p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 flex justify-between items-center"
             data-id="${p.id}"
             onclick="if(window.pos) window.pos.selectPriceCheckProduct('${p.id}')">
            <div>
                <div class="font-bold text-slate-800 dark:text-white text-sm">${p.name}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">${p.barcode || 'Sin código'}</div>
            </div>
            <div class="font-bold text-slate-900 dark:text-white">$${parseFloat(p.price).toFixed(2)}</div>
        </div>
    `).join('');

                this.dom.priceCheckList.classList.remove('hidden');
                this.priceCheckSelectedIndex = -1;

                // Keep event listeners as backup/primary
                this.dom.priceCheckList.querySelectorAll('.price-check-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent bubbling issues
                        const id = item.dataset.id;
                        console.log('Event listener click:', id);
                        this.selectPriceCheckProduct(id);
                    });
                });
            }

            selectPriceCheckProduct(id) {
                console.log('selectPriceCheckProduct called with ID:', id);
                const product = this.products.find(p => String(p.id) === String(id));
                if (product) {
                    console.log('Product found:', product.name);
                    this.displayPriceCheckResult(product);
                    if (this.dom.priceCheckList) this.dom.priceCheckList.classList.add('hidden');
                    if (this.dom.priceCheckInput) this.dom.priceCheckInput.value = ''; // Clear input
                } else {
                    console.error('Product not found in local cache for ID:', id);
                }
            }

            displayPriceCheckResult(product) {
                if (!this.dom.priceCheckResult) return;

                const priceBs = product.price * this.exchangeRate;
                const imageUri = product.imageUri || 'https://via.placeholder.com/150?text=No+Image';

                this.dom.priceCheckResult.innerHTML = `
            <div class="flex flex-col items-center text-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <img src="${imageUri}" alt="${product.name}" class="w-32 h-32 object-cover rounded-lg mb-4 shadow-sm">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">${product.name}</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">${product.barcode || 'Sin código'}</p>
                
                <div class="grid grid-cols-2 gap-4 w-full mb-4">
                    <div class="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Precio USD</p>
                        <p class="text-2xl font-extrabold text-slate-900 dark:text-white">$${parseFloat(product.price).toFixed(2)}</p>
                    </div>
                    <div class="bg-slate-50 dark:bg-slate-700 p-3 rounded-lg">
                        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Precio Bs</p>
                        <p class="text-2xl font-extrabold text-slate-900 dark:text-white">Bs ${priceBs.toFixed(2)}</p>
                    </div>
                </div>

                <button onclick="window.pos.addToCart('${product.id}'); window.pos.closePriceCheck();" 
                    class="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    Agregar al Carrito
                </button>
            </div>
        `;

                // Toggle visibility
                this.dom.priceCheckResult.classList.remove('hidden');
                if (this.dom.priceCheckPlaceholder) {
                    this.dom.priceCheckPlaceholder.classList.add('hidden');
                }
            }

            renderCustomerSearchResults(results) {
                if (!this.dom.customerSearchResults) {
                    console.error('POS: customerSearchResults DOM element not found!');
                    return;
                }

                console.log('POS: Rendering search results:', results);

                if (results.length === 0) {
                    this.dom.customerSearchResults.innerHTML = `
                <div class="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                    No se encontraron clientes
                </div>
            `;
                } else {
                    this.dom.customerSearchResults.innerHTML = results.map(c => `
                <div class="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors"
                    onclick="pos.selectCustomer('${c.id}')">
                    <div class="font-bold text-slate-800 dark:text-white text-sm">${c.name}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 flex gap-2">
                        <span>${c.idDocument || 'Sin Documento'}</span>
                        <span>•</span>
                        <span>${c.email || 'Sin email'}</span>
                    </div>
                </div>
            `).join('');
                }

                this.dom.customerSearchResults.classList.remove('hidden');
                console.log('POS: customerSearchResults classList:', this.dom.customerSearchResults.classList.toString());
            }

            selectCustomer(customerId) {
                const customer = this.customers.find(c => c.id == customerId); // Loose equality for string/number mismatch
                if (!customer) return;

                this.selectedCustomer = customer;

                // Update UI
                if (this.dom.selectedCustomerName) this.dom.selectedCustomerName.textContent = customer.name;
                if (this.dom.selectedCustomerDoc) this.dom.selectedCustomerDoc.textContent = `${customer.docType || ''}-${customer.docNumber || ''}`;

                if (this.dom.customerSearchContainer) {
                    const inputContainer = this.dom.customerSearchContainer.querySelector('.relative');
                    if (inputContainer) inputContainer.classList.add('hidden');
                }

                if (this.dom.selectedCustomerDisplay) this.dom.selectedCustomerDisplay.classList.remove('hidden');
                if (this.dom.customerSearchResults) this.dom.customerSearchResults.classList.add('hidden');
                if (this.dom.customerSearchInput) this.dom.customerSearchInput.value = '';

                ui.showNotification(`Cliente seleccionado: ${customer.name}`);
            }

            deselectCustomer() {
                this.selectedCustomer = null;

                if (this.dom.customerSearchContainer) {
                    const inputContainer = this.dom.customerSearchContainer.querySelector('.relative');
                    if (inputContainer) inputContainer.classList.remove('hidden');
                }

                if (this.dom.selectedCustomerDisplay) this.dom.selectedCustomerDisplay.classList.add('hidden');
                if (this.dom.customerSearchInput) {
                    this.dom.customerSearchInput.value = '';
                    this.dom.customerSearchInput.focus();
                }
            }

            toggleCartSidebar() {
                const cartContainer = document.getElementById('cart-container');

                if (!cartContainer) return;

                // Determine if currently open
                // Open if: (No translate-x-full) OR (Has md:translate-x-0)
                const isOpen = !cartContainer.classList.contains('translate-x-full') || cartContainer.classList.contains('md:translate-x-0');

                if (isOpen) {
                    // Close it
                    cartContainer.classList.add('translate-x-full');
                    cartContainer.classList.remove('md:translate-x-0');
                } else {
                    // Open it
                    cartContainer.classList.remove('translate-x-full');
                    cartContainer.classList.add('md:translate-x-0');
                }

                this.syncMainContentMargin();
                this.updateCartToggleState();
            }

            syncMainContentMargin() {
                const cartContainer = document.getElementById('cart-container');
                const mainContent = document.getElementById('pos-content-wrapper');

                if (!cartContainer || !mainContent) {
                    console.warn('POS: syncMainContentMargin - Elements not found', { cartContainer, mainContent });
                    return;
                }

                // Robust check for open state
                const isOpen = !cartContainer.classList.contains('translate-x-full') || cartContainer.classList.contains('md:translate-x-0');
                console.log('POS: syncMainContentMargin', { isOpen, innerWidth: window.innerWidth });

                if (!isOpen) {
                    // Cart is closed, remove margin
                    mainContent.style.setProperty('margin-right', '0px', 'important');
                } else {
                    // Cart is open, add margin based on screen size
                    if (window.innerWidth >= 1024) {
                        mainContent.style.setProperty('margin-right', '24rem', 'important'); // 384px
                    } else {
                        mainContent.style.setProperty('margin-right', '20rem', 'important'); // 320px
                    }
                }
            }

            updateCartToggleState() {
                const cartContainer = document.getElementById('cart-container');
                const icon = this.dom.cartToggleIcon;

                if (!cartContainer || !icon) return;

                const isOpen = !cartContainer.classList.contains('translate-x-full') || cartContainer.classList.contains('md:translate-x-0');

                if (!isOpen) {
                    // Cart is CLOSED (off screen)
                    // Icon should point LEFT (to open)
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    // Cart is OPEN
                    // Icon should point RIGHT (to close)
                    icon.style.transform = 'rotate(180deg)';
                }
            }

            enableSwipeToClose() {
                const cartSidebar = document.getElementById('cart-sidebar');
                if (!cartSidebar) return;

                let startX = 0;
                let startY = 0;

                cartSidebar.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                }, { passive: true });

                cartSidebar.addEventListener('touchend', (e) => {
                    const endX = e.changedTouches[0].clientX;
                    const endY = e.changedTouches[0].clientY;
                    const deltaX = endX - startX;
                    const deltaY = endY - startY;

                    // Check if horizontal swipe is dominant
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        // Swipe Right (positive deltaX) to close
                        if (deltaX > 50) {
                            this.toggleCartSidebar();
                        }
                    }
                });
            }

            enableSwipeToOpen() {
                // Add swipe listener to the document body or a specific edge area
                let startX = 0;
                let startY = 0;

                document.addEventListener('touchstart', (e) => {
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                }, { passive: true });

                document.addEventListener('touchend', (e) => {
                    // Only trigger if starting near the right edge (e.g., last 30px)
                    if (window.innerWidth - startX > 30) return;

                    const endX = e.changedTouches[0].clientX;
                    const endY = e.changedTouches[0].clientY;
                    const deltaX = endX - startX;
                    const deltaY = endY - startY;

                    // Legacy Swipe Handler - REMOVED to prevent mobile overlay issues
                    /*
                    document.addEventListener('touchstart', (e) => { ... });
                    document.addEventListener('touchend', (e) => { ... });
                    */
                });
            }
        }

// Global Functions for HTML access
window.toggleMobileMenu = function () {
            const menu = document.getElementById('mobile-menu');
            if (menu) {
                menu.classList.toggle('hidden');
            }
        };

        window.toggleMobileCart = function () {
            const cart = document.getElementById('mobile-cart-sidebar');
            const overlay = document.getElementById('mobile-overlay');

            if (cart && overlay) {
                const isClosed = cart.classList.contains('translate-x-full');
                if (isClosed) {
                    // Open
                    cart.style.display = 'flex';
                    // Small delay to allow display:flex to apply before transition
                    requestAnimationFrame(() => {
                        cart.classList.remove('translate-x-full');
                        cart.style.transform = ''; // Clear inline transform
                        overlay.classList.remove('hidden');
                    });
                } else {
                    // Close
                    cart.classList.add('translate-x-full');
                    overlay.classList.add('hidden');
                    // Wait for transition then hide
                    setTimeout(() => {
                        cart.style.display = 'none';
                    }, 300);
                }
            }
        };

        window.closeMobileCart = function () {
            const cart = document.getElementById('mobile-cart-sidebar');
            const overlay = document.getElementById('mobile-overlay');

            if (cart && overlay) {
                cart.classList.add('translate-x-full');
                overlay.classList.add('hidden');
                setTimeout(() => {
                    cart.style.display = 'none';
                }, 300);
            }
        };

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            window.pos = new POS();
        });
