export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    }).format(amount);
};

export const formatBs = (amount) => {
    return new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: 'VES'
    }).format(amount);
};

export const formatDate = (dateInput) => {
    if (!dateInput) return '';

    let date;
    // Handle Firestore Timestamp object (from REST API)
    if (dateInput && typeof dateInput === 'object' && dateInput._seconds) {
        date = new Date(dateInput._seconds * 1000);
    } else {
        date = new Date(dateInput);
    }

    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Round Bs amount UP to nearest whole number
 * Example: 105.62 → 106
 * @param {number} amount - Amount in Bs
 * @returns {number} Rounded amount
 */
export const roundBsUp = (amount) => {
    return Math.ceil(amount);
};

/**
 * Round Bs amount to nearest whole number
 * Example: 105.62 → 106, 105.49 → 105
 * @param {number} amount - Amount in Bs
 * @returns {number} Rounded amount
 */
export const roundBsNearest = (amount) => {
    return Math.round(amount);
};

/**
 * Round USD amount to 2 decimal places
 * @param {number} amount - Amount in USD
 * @returns {number} Rounded amount
 */
export const roundUsd = (amount) => {
    return Math.round(amount * 10000) / 10000;
};

/**
 * Currency Settings Manager
 * Tracks which currencies are enabled for the current user
 */
export const currencySettings = {
    _enabled: null, // Will be loaded from localStorage or default

    /**
     * Initialize - Load from localStorage if available
     */
    init() {
        const stored = localStorage.getItem('currency_settings');
        if (stored) {
            try {
                this._enabled = JSON.parse(stored);
                console.log('Currency settings loaded from localStorage:', this._enabled);
            } catch (e) {
                console.error('Error parsing currency_settings from localStorage:', e);
                this._enabled = ['USD', 'VES']; // Default to both
            }
        } else {
            this._enabled = ['USD', 'VES']; // Default to both
        }
    },

    /**
     * Set enabled currencies from user data
     * @param {string[]} currencies - Array of currency codes ['USD', 'VES']
     */
    setEnabled(currencies) {
        if (Array.isArray(currencies) && currencies.length > 0) {
            this._enabled = currencies.map(c => c.toUpperCase());
        } else {
            this._enabled = ['USD', 'VES']; // Default to both
        }

        // CRITICAL: Save to localStorage so CashControlManager and other components can read it
        localStorage.setItem('currency_settings', JSON.stringify(this._enabled));
        console.log('Currency settings updated:', this._enabled);
    },

    /**
     * Check if USD is enabled
     * @returns {boolean}
     */
    isUsdEnabled() {
        if (!this._enabled) this.init();
        return this._enabled.includes('USD');
    },

    /**
     * Check if Bs (VES) is enabled
     * @returns {boolean}
     */
    isBsEnabled() {
        if (!this._enabled) this.init();
        return this._enabled.includes('VES') || this._enabled.includes('BS');
    },

    /**
     * Check if ONLY USD is enabled (no Bs)
     * @returns {boolean}
     */
    isUsdOnly() {
        return this.isUsdEnabled() && !this.isBsEnabled();
    },

    /**
     * Check if ONLY Bs is enabled (no USD)
     * @returns {boolean}
     */
    isBsOnly() {
        return this.isBsEnabled() && !this.isUsdEnabled();
    },

    /**
     * Check if both currencies are enabled
     * @returns {boolean}
     */
    isBothEnabled() {
        return this.isUsdEnabled() && this.isBsEnabled();
    }
};

// Initialize on module load
currencySettings.init();
