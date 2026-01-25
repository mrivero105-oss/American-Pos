// Debug module MUST be imported first to override console.log before any other code
import './debug.js';
import { POS } from './pos.v4.js?v=debug14';
import { Dashboard } from './dashboard.js';
import { SalesHistory } from './sales.js';
import { Settings } from './settings.js';
import { CustomersView } from './modules/dashboard/CustomersView.js';
import { UsersManager } from './modules/admin/UsersManager.js';
import { Products } from './products.js';
import { authService } from './auth.js';
import { SwipeManager } from './swipe-manager.js';
import { SuppliersView } from './modules/dashboard/SuppliersView.js';
import { PurchaseOrdersView } from './modules/dashboard/PurchaseOrdersView.js';
import { ComponentLoader } from './components/ComponentLoader.js';
import { api } from './api.js';
import { currencySettings } from './utils.js';

const APP_VERSION = 'v226'; // Fixed payment modal and logout modal logic

class App {
    constructor() {
        if (window.bootLog) window.bootLog('→ App constructor');
        // Note: Views will be initialized in init() after components load
        this.views = {};
        this.currentView = 'pos';
        this.init();
    }



    startBackgroundSync() {
        const runSync = async () => {
            try {
                // Determine if we are online (crude check)
                if (!navigator.onLine) return;

                console.log('Background Sync: checking...');
                const result = await api.sync.pull();

                if (result.details.creates > 0 || result.details.updates > 0) {
                    console.log('Background Sync: Data updated', result);

                    // Show unobtrusive notification if supported
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('American POS', { body: `Datos actualizados: ${result.details.creates} nuevos, ${result.details.updates} cambios` });
                    } else {
                        // Fallback toast if UI available
                        const toast = document.createElement('div');
                        toast.className = 'fixed bottom-4 left-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-[100] text-sm animate-fade-in';
                        toast.textContent = `☁️ Sincronizado: ${result.details.updates + result.details.creates} cambios`;
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 4000);
                    }

                    // If on products view, refresh
                    if (this.currentView === 'products' && this.views.products.loadProducts) {
                        this.views.products.loadProducts();
                    }
                }
            } catch (e) {
                console.warn('Background sync failed silent:', e);
            }
        };

        // Request notification permission for sync updates
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Run initial after a delay to allow boot
        setTimeout(runSync, 10000); // 10s after boot

        // Loop every 5 mins
        setInterval(runSync, 5 * 60 * 1000);
    }

    async init() {
        if (window.bootLog) window.bootLog('→ App.init()');

        try {
            // 1. Load Components
            if (window.bootLog) window.bootLog('→ Loading components...');
            await ComponentLoader.loadMany([
                { url: 'components/AdminModals.html', targetId: 'admin-modals-placeholder' },
                { url: 'components/CheckoutModals.html', targetId: 'checkout-cash-modals-placeholder' },
                { url: 'components/CashModals.html', targetId: 'checkout-cash-modals-placeholder' },
                { url: 'components/UtilityModals.html', targetId: 'utility-modals-placeholder' }
            ]);

            // 2. Initialize Views (Now that DOM elements exist)
            this.views = {
                pos: new POS(),
                dashboard: new Dashboard(),
                sales: new SalesHistory(),
                settings: new Settings(),
                customers: new CustomersView(),
                users: new UsersManager(),
                products: Products,
                suppliers: new SuppliersView(),
                purchaseOrders: new PurchaseOrdersView()
            };

            // Start Background Sync service
            // this.startBackgroundSync(); // DISABLED FOR OFFLINE MODE

            // 3. Check Authentication
            if (!authService.isAuthenticated()) {
                if (window.bootLog) window.bootLog('→ Not authenticated, redirecting...');
                window.location.href = 'login.html';
                return;
            }

            // 4. Reactive Auth Listener (handle logout/session expiry)
            authService.onAuthChange((user) => {
                if (!user) {
                    if (window.bootLog) window.bootLog('→ Auth state changed: No user, redirecting to login...');
                    window.location.href = 'login.html';
                }
            });

            // Initialize currency settings from user data
            const user = authService.getUser();
            // Commented out to prevent overriding local preference
            /*if (user && user.businessInfo && user.businessInfo.currencies) {
                currencySettings.setEnabled(user.businessInfo.currencies);
            }*/

            // Initialize Swipe Manager for Mobile
            this.swipeManager = new SwipeManager();

            // Hide exchange rate section when USD-only mode
            const exchangeRateContainer = document.getElementById('exchange-rate-container');
            if (exchangeRateContainer && !currencySettings.isBsEnabled()) {
                exchangeRateContainer.style.display = 'none';
            }

            // Navigation
            const navLinks = document.querySelectorAll('[data-view]');
            console.log('Found nav links:', navLinks.length);

            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    // If clicking the toggle button, do nothing (handled separately)
                    if (e.currentTarget.id === 'sidebar-toggle-desktop') return;

                    console.log('Nav link clicked:', e.currentTarget.dataset.view);
                    e.preventDefault();
                    const viewName = e.currentTarget.dataset.view;
                    this.switchView(viewName);

                    // Close mobile sidebar on selection
                    if (window.innerWidth < 768) {
                        this.toggleSidebar(false);
                    }
                });
            });

            // Initialize Sidebar Toggle (Desktop)
            const sidebarToggle = document.getElementById('sidebar-toggle-desktop');
            const sidebar = document.getElementById('sidebar');
            if (sidebarToggle && sidebar) {
                sidebarToggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    sidebar.classList.toggle('sidebar-collapsed');
                    const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
                    localStorage.setItem('sidebarCollapsed', isCollapsed);
                });

                // Restore preference
                if (localStorage.getItem('sidebarCollapsed') === 'true') {
                    sidebar.classList.add('sidebar-collapsed');
                }
            }

            // Logout Button with inline professional confirmation modal
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    // Inline showConfirm implementation (bypasses ui.js CDN cache issue)
                    const confirmed = await new Promise((resolve) => {
                        const existing = document.getElementById('confirm-modal-global');
                        if (existing) existing.remove();

                        const modal = document.createElement('div');
                        modal.id = 'confirm-modal-global';
                        modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4';
                        modal.innerHTML = `
                        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="confirm-overlay"></div>
                        <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform">
                            <div class="p-6 text-center">
                                <div class="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                                    <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                                    </svg>
                                </div>
                                <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Cerrar Sesión</h3>
                                <p class="text-slate-600 dark:text-slate-400 text-sm">¿Estás seguro de que deseas cerrar sesión? Tendrás que volver a iniciar sesión.</p>
                            </div>
                            <div class="flex border-t border-slate-200 dark:border-slate-700">
                                <button id="confirm-modal-cancel" class="flex-1 px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-700">
                                    Cancelar
                                </button>
                                <button id="confirm-modal-confirm" class="flex-1 px-4 py-3.5 text-white font-medium bg-red-600 hover:bg-red-700 transition-colors">
                                    Cerrar Sesión
                                </button>
                            </div>
                        </div>
                    `;

                        document.body.appendChild(modal);
                        setTimeout(() => document.getElementById('confirm-modal-confirm')?.focus(), 100);

                        const cleanup = (result) => { modal.remove(); resolve(result); };
                        document.getElementById('confirm-modal-cancel').onclick = () => cleanup(false);
                        document.getElementById('confirm-modal-confirm').onclick = () => cleanup(true);
                        document.getElementById('confirm-overlay').onclick = () => cleanup(false);

                        const handleKeydown = (e) => {
                            if (e.key === 'Escape') cleanup(false);
                            if (e.key === 'Enter') cleanup(true);
                        };
                        document.addEventListener('keydown', handleKeydown, { once: true });
                    });

                    if (confirmed) {
                        await authService.logout();
                    }
                };
            }

            // Mobile Menu Button
            const mobileMenuBtn = document.getElementById('mobile-menu-btn');
            if (mobileMenuBtn) {
                mobileMenuBtn.addEventListener('click', () => {
                    this.toggleSidebar(true);
                });
            }

            // Close Cart Button (Mobile)
            const closeCartBtn = document.getElementById('close-cart-btn');
            if (closeCartBtn) {
                closeCartBtn.addEventListener('click', () => {
                    this.toggleCart(false);
                });
            }

            // Overlay
            const overlay = document.getElementById('mobile-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => {
                    this.toggleSidebar(false);
                    this.toggleCart(false);
                });
            }

            // Theme Toggle (Delegation)
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('#theme-toggle, #mobile-theme-toggle, #sidebar-theme-toggle');
                if (btn) {
                    console.log('Theme toggle clicked');
                    try {
                        console.log('Tailwind Config:', typeof tailwind !== 'undefined' ? JSON.stringify(tailwind.config) : 'undefined');
                    } catch (e) {
                        console.error('Error reading tailwind config:', e);
                    }

                    if (document.documentElement.classList.contains('dark')) {
                        document.documentElement.classList.remove('dark');
                        localStorage.theme = 'light';
                    } else {
                        document.documentElement.classList.add('dark');
                        localStorage.theme = 'dark';
                    }
                }
            });

            // Initial view
            if (window.bootLog) window.bootLog('→ Products.init()');
            this.views.products.init();

            // Determine initial view: Hash -> LocalStorage -> Default
            let initialView = 'pos';
            const hashView = window.location.hash.substring(1); // Remove #
            const savedView = localStorage.getItem('activeView');

            if (hashView && this.views[hashView]) {
                console.log('Restoring view from URL:', hashView);
                initialView = hashView;
            } else if (savedView && this.views[savedView]) {
                console.log('Restoring view from LocalStorage:', savedView);
                initialView = savedView;
            }

            if (window.bootLog) window.bootLog('→ switchView(' + initialView + ')');
            this.switchView(initialView);
        } catch (error) {
            console.error('App init failed:', error);
            if (window.bootLog) window.bootLog('❌ Error in App.init(): ' + error.message);
        }
    }

    toggleSidebar(show) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');

        if (show) {
            sidebar.style.display = 'flex';
            // Use RAF to ensure display:flex applies before transform transition
            requestAnimationFrame(() => {
                sidebar.classList.remove('-translate-x-full');
                if (overlay) {
                    overlay.classList.remove('hidden');
                    overlay.style.display = 'block';
                }
            });
        } else {
            sidebar.classList.add('-translate-x-full');
            if (overlay) {
                // Only hide overlay if cart is also closed
                const cartSidebar = document.getElementById('cart-sidebar');
                // Check mobile cart as well
                const mobileCart = document.getElementById('mobile-cart-sidebar');

                const cartClosed = (!cartSidebar || cartSidebar.classList.contains('translate-x-full')) &&
                    (!mobileCart || mobileCart.classList.contains('translate-x-full'));

                if (cartClosed) {
                    overlay.classList.add('hidden');
                    overlay.style.display = 'none';
                }
            }
            // Hide sidebar after transition
            setTimeout(() => {
                if (window.innerWidth < 768) {
                    sidebar.style.display = 'none';
                }
            }, 300);
        }
    }

    toggleCart(show) {
        const cartSidebar = document.getElementById('cart-sidebar');
        const overlay = document.getElementById('mobile-overlay');

        if (!cartSidebar) return; // Safety check

        if (show) {
            cartSidebar.classList.remove('translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
        } else {
            cartSidebar.classList.add('translate-x-full');
            // Only hide overlay if sidebar is also closed
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('-translate-x-full')) {
                if (overlay) overlay.classList.add('hidden');
            } else if (!sidebar && overlay) {
                // Fallback if sidebar not found but overlay exists
                overlay.classList.add('hidden');
            }
        }
    }

    switchView(viewName) {
        // Save state persistence
        localStorage.setItem('activeView', viewName);

        // Update Nav
        this.updateNavigation(viewName);

        // Hide all views
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.add('hidden');
            section.classList.remove('flex'); // Ensure flex doesn't override hidden
        });

        // Robust Sidebar Hiding (Prevent Ghosting outside POS)
        if (viewName !== 'pos') {
            const sidebarsToHide = ['desktop-cart-container', 'mobile-cart-sidebar', 'mobile-overlay'];
            sidebarsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('hidden');
                    if (id !== 'mobile-overlay') {
                        el.classList.add('translate-x-full');
                        el.style.display = 'none';
                    }
                }
            });
        }

        // Show selected view
        const activeSection = document.getElementById(`view-${viewName}`);
        if (activeSection) {
            activeSection.classList.remove('hidden');
            // If it's POS, we need flex for the sidebar/grid layout to work
            if (viewName === 'pos') {
                activeSection.classList.add('flex');
            }
            console.log(`Switching to view: ${viewName}`);

            // Close Held Sales Drawer if open (when leaving POS or just in case)
            if (this.views.pos && typeof this.views.pos.closeHeldSalesDrawer === 'function') {
                this.views.pos.closeHeldSalesDrawer();
            }

            // Force close global drawer DOM element (Robust Fix)
            const heldDrawer = document.getElementById('held-sales-drawer');
            if (heldDrawer) {
                heldDrawer.classList.add('translate-x-full');
                heldDrawer.style.display = 'none';
                // Also hide overlay if it was open for this drawer
                if (window.innerWidth < 768) {
                    const overlay = document.getElementById('mobile-overlay');
                    if (overlay && !document.getElementById('mobile-cart-sidebar')?.classList.contains('translate-x-full') === false && !document.getElementById('sidebar')?.classList.contains('-translate-x-full') === false) {
                        // Only hide if other sidebars are also closed
                        overlay.classList.add('hidden');
                    }
                }
            }

            // Trigger data load if needed
            try {
                if (viewName === 'dashboard') this.views.dashboard.loadData();
                if (viewName === 'sales') this.views.sales.loadSales();
                if (viewName === 'products') {
                    console.log('Loading products view...', this.views.products);
                    this.views.products.loadProducts();
                }
                if (viewName === 'settings') this.views.settings.loadSettings();
                if (viewName === 'users') this.views.users.load();
                if (viewName === 'customers') this.views.customers.load();
                if (viewName === 'pos') this.views.pos.refreshData();
                if (viewName === 'suppliers') {
                    this.views.suppliers.load();
                    this.views.purchaseOrders.load();
                    this.setupSuppliersTabs();
                }
            } catch (error) {
                console.error(`Error loading view ${viewName}:`, error);
            }
        }

        this.currentView = viewName;

        // Update Title and URL
        const titles = {
            'pos': 'Punto de Venta',
            'dashboard': 'Dashboard',
            'sales': 'Historial de Ventas',
            'customers': 'Clientes',
            'products': 'Productos',
            'settings': 'Ajustes',
            'users': 'Usuarios',
            'suppliers': 'Proveedores'
        };

        const title = titles[viewName] || 'Inicio';
        document.title = `American POS - ${title}`;

        // Update URL without reloading
        if (history.replaceState) {
            history.replaceState(null, '', `#${viewName}`);
        }

        // Manage Cart Visibility
        const cartSidebar = document.getElementById('cart-sidebar');
        const mobileCartBtn = document.getElementById('mobile-cart-btn');

        if (viewName === 'pos') {
            if (cartSidebar) cartSidebar.classList.remove('hidden');
            if (mobileCartBtn) mobileCartBtn.classList.remove('hidden');
        } else {
            if (cartSidebar) cartSidebar.classList.add('hidden');
            if (mobileCartBtn) mobileCartBtn.classList.add('hidden');
        }

        // Manage Mobile Header Controls (Search, Scan, Price, Theme)
        const mobilePosControls = document.getElementById('mobile-pos-controls');
        if (mobilePosControls) {
            if (viewName === 'pos') {
                mobilePosControls.style.display = 'flex'; // Ensure flex layout is restored
                mobilePosControls.classList.remove('hidden');
            } else {
                mobilePosControls.style.display = 'none';
                mobilePosControls.classList.add('hidden');
            }
        }
    }

    updateNavigation(currentView) {
        document.querySelectorAll('nav a').forEach(link => {
            if (link.dataset.view === currentView) {
                // Active State
                link.classList.add('bg-slate-800', 'text-white');
                link.classList.remove('text-slate-800', 'dark:text-slate-200', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
            } else {
                // Inactive State
                link.classList.remove('bg-slate-800', 'text-white');
                link.classList.add('text-slate-800', 'dark:text-slate-200', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
            }
        });

        // Toggle Users menu item visibility
        const user = authService.getUser();
        const usersLink = document.getElementById('nav-users-link');

        if (usersLink) {
            if (user && user.role === 'admin') {
                usersLink.classList.remove('hidden');
                usersLink.style.display = 'flex'; // Force display if hidden by default was hard
            } else {
                usersLink.classList.add('hidden');
                usersLink.style.display = 'none';
            }
        }
    }

    setupSuppliersTabs() {
        const tabSuppliers = document.getElementById('tab-suppliers');
        const tabPO = document.getElementById('tab-purchase-orders');
        const panelSuppliers = document.getElementById('suppliers-panel');
        const panelPO = document.getElementById('purchase-orders-panel');

        if (!tabSuppliers || !tabPO) return;

        // Remove previous listeners by cloning
        const newTabSuppliers = tabSuppliers.cloneNode(true);
        const newTabPO = tabPO.cloneNode(true);
        tabSuppliers.parentNode.replaceChild(newTabSuppliers, tabSuppliers);
        tabPO.parentNode.replaceChild(newTabPO, tabPO);

        newTabSuppliers.addEventListener('click', () => {
            panelSuppliers.classList.remove('hidden');
            panelPO.classList.add('hidden');
            newTabSuppliers.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
            newTabSuppliers.classList.remove('text-slate-500');
            newTabPO.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
            newTabPO.classList.add('text-slate-500');
        });

        newTabPO.addEventListener('click', () => {
            panelSuppliers.classList.add('hidden');
            panelPO.classList.remove('hidden');
            newTabPO.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
            newTabPO.classList.remove('text-slate-500');
            newTabSuppliers.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
            newTabSuppliers.classList.add('text-slate-500');
        });
    }
}

// Global App Instance
if (window.bootLog) window.bootLog('→ Creating App...');
try {
    window.app = new App();
    if (window.bootLog) window.bootLog('✓ BOOT COMPLETE');
} catch (error) {
    console.error('FATAL: App initialization failed', error);
    document.body.innerHTML = `<div style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: #fee; color: #c00; padding: 20px; font-family: monospace; text-align: center;"><div><h1>Error al iniciar</h1><p>${error.message}</p><p style="font-size: 12px; margin-top: 10px;">Por favor, actualiza la página o borra la caché.</p></div></div>`;
}
