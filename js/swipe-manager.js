export class SwipeManager {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50; // Minimum distance for swipe
        this.maxVerticalDistance = 30; // Maximum vertical limit to ignore scrolls

        // Elements
        this.sidebar = document.getElementById('sidebar');
        this.mobileCart = document.getElementById('mobile-cart-sidebar');
        this.overlay = document.getElementById('mobile-overlay');

        this.init();
    }

    init() {
        document.addEventListener('touchstart', e => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchend', e => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe();
        }, { passive: true });

        console.log('SwipeManager initialized');
    }

    handleSwipe() {
        const xDiff = this.touchEndX - this.touchStartX;
        const yDiff = this.touchEndY - this.touchStartY;

        // Check vertical limit to avoid triggering on scroll
        if (Math.abs(yDiff) > this.maxVerticalDistance) return;
        // Check horizontal minimum distance
        if (Math.abs(xDiff) < this.minSwipeDistance) return;

        if (xDiff > 0) {
            this.onSwipeRight();
        } else {
            this.onSwipeLeft();
        }
    }

    /**
     * Swipe Right ( -> )
     * 1. If Cart is OPEN, Close it.
     * 2. If Sidebar is CLOSED, Open it.
     */
    onSwipeRight() {
        // Refresh elements just in case
        this.refreshElements();

        const isCartOpen = this.isCartOpen();
        const isSidebarOpen = this.isSidebarOpen();

        if (isCartOpen) {
            this.closeCart();
        } else if (!isSidebarOpen) {
            this.openSidebar();
        }
    }

    /**
     * Swipe Left ( <- )
     * 1. If Sidebar is OPEN, Close it.
     * 2. If Cart is CLOSED, Open it.
     */
    onSwipeLeft() {
        // Refresh elements just in case
        this.refreshElements();

        const isCartOpen = this.isCartOpen();
        const isSidebarOpen = this.isSidebarOpen();

        if (isSidebarOpen) {
            this.closeSidebar();
        } else if (!isCartOpen) {
            // Only open cart if we are on POS page (check if cart exists)
            if (this.mobileCart) {
                this.openCart();
            }
        }
    }

    refreshElements() {
        this.sidebar = document.getElementById('sidebar');
        this.mobileCart = document.getElementById('mobile-cart-sidebar');
        this.overlay = document.getElementById('mobile-overlay');
    }

    isCartOpen() {
        if (!this.mobileCart) return false;
        // Logic: Cart is open if it does NOT have 'translate-x-full' AND style.display is not 'none'
        // But usually verifying class is safer if it's toggled
        return !this.mobileCart.classList.contains('translate-x-full');
    }

    isSidebarOpen() {
        if (!this.sidebar) return false;
        // Sidebar is hidden with '-translate-x-full' on mobile default
        // So it is open if it does NOT have '-translate-x-full'
        return !this.sidebar.classList.contains('-translate-x-full');
    }

    openSidebar() {
        if (!this.sidebar) return;
        this.sidebar.classList.remove('-translate-x-full');
        this.showOverlay();
    }

    closeSidebar() {
        if (!this.sidebar) return;
        this.sidebar.classList.add('-translate-x-full');
        this.hideOverlayIfSafe();
    }

    openCart() {
        if (!this.mobileCart) return;
        this.mobileCart.style.display = 'flex';
        // Delay to ensure transition triggers? Sometimes needed but classList usually works
        // Removing translate moves it into view
        requestAnimationFrame(() => {
            this.mobileCart.classList.remove('translate-x-full');
        });
        this.showOverlay();
    }

    closeCart() {
        if (!this.mobileCart) return;
        this.mobileCart.classList.add('translate-x-full');
        this.hideOverlayIfSafe();
    }

    showOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('hidden');
            this.overlay.style.display = 'block';
        }
    }

    hideOverlayIfSafe() {
        // Only hide overlay if BOTH panels are closed
        // But wait, the action just closed one.
        // We can check if the OTHER is open.

        // However, standard behavior is one or the other.
        // Just checking state is safer.
        setTimeout(() => {
            const cartOpen = this.isCartOpen();
            const sidebarOpen = this.isSidebarOpen();
            if (!cartOpen && !sidebarOpen && this.overlay) {
                this.overlay.classList.add('hidden');
                this.overlay.style.display = 'none';
            }
        }, 50);
    }
}
