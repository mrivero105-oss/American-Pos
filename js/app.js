// Debug module MUST be imported first to override console.log before any other code
import './debug.js';
import { POS } from './pos.v4.js?v=351';
import { Dashboard } from './dashboard.js?v=223';
import { SalesHistory } from './sales.js?v=223';
import { Settings } from './settings.js?v=223';
import { CustomersView } from './modules/dashboard/CustomersView.js?v=223';
import { UsersManager } from './modules/admin/UsersManager.js?v=223';
import { Products } from './products.js?v=223';
import { authService } from './auth.js?v=223';
import { SwipeManager } from './swipe-manager.js';
import { SuppliersView } from './modules/dashboard/SuppliersView.js?v=224';
import { PurchaseOrdersView } from './modules/dashboard/PurchaseOrdersView.js?v=224';
import { currencySettings } from './utils.js';

const APP_VERSION = 'v224';

class App {
    constructor() {
        this.views = {
            pos: new POS(),
            dashboard: new Dashboard(),
            sales: new SalesHistory(),
            settings: new Settings(),
            customers: new CustomersView(), // Don't pass a separate Dashboard
            users: new UsersManager(),
            products: Products,
            suppliers: new SuppliersView(),
            purchaseOrders: new PurchaseOrdersView()
        };
        this.currentView = 'pos';
        this.init();
    }

    async init() {
        // Check Authentication
        if (!authService.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        // Initialize currency settings from user data
        const user = authService.getUser();
        if (user && user.businessInfo && user.businessInfo.currencies) {
            currencySettings.setEnabled(user.businessInfo.currencies);
        }

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

        // Logout Button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
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
            const btn = e.target.closest('#theme-toggle, #mobile-theme-toggle');
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

        this.switchView(initialView);
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
        });

        // Show selected view
        const activeSection = document.getElementById(`view-${viewName}`);
        if (activeSection) {
            activeSection.classList.remove('hidden');
            console.log(`Switching to view: ${viewName}`);

            // Close Held Sales Drawer if open (when leaving POS or just in case)
            if (this.views.pos && typeof this.views.pos.closeHeldSalesDrawer === 'function') {
                this.views.pos.closeHeldSalesDrawer();
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
window.app = new App();
