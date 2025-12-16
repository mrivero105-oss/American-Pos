/**
 * Debug Utility - Conditional Logging System
 * 
 * This module provides a drop-in replacement for console.log that only outputs
 * when debug mode is enabled. It's designed to silently suppress logs in production.
 * 
 * Enable debug mode from browser console:
 *   enablePosDebug()
 * 
 * Disable debug mode:
 *   disablePosDebug()
 */

const DEBUG = localStorage.getItem('POS_DEBUG') === 'true';

// Override console methods for POS modules
const originalConsoleLog = console.log.bind(console);
const originalConsoleWarn = console.warn.bind(console);

/**
 * Wrapped console.log that only outputs in debug mode for POS-prefixed messages
 */
console.log = function (...args) {
    // Always show if debug mode is on
    if (DEBUG) {
        originalConsoleLog(...args);
        return;
    }

    // In production, filter out POS debug messages
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
        // Suppress POS debug logs in production
        if (firstArg.startsWith('POS:') ||
            firstArg.includes('POS:') ||
            firstArg.startsWith('DEBUG:')) {
            return; // Silently suppress
        }
    }

    // Allow non-POS logs through
    originalConsoleLog(...args);
};

/**
 * Wrapped console.warn that only outputs in debug mode for POS-prefixed messages
 */
console.warn = function (...args) {
    if (DEBUG) {
        originalConsoleWarn(...args);
        return;
    }

    const firstArg = args[0];
    if (typeof firstArg === 'string' &&
        (firstArg.startsWith('POS:') || firstArg.includes('POS:'))) {
        return; // Silently suppress
    }

    originalConsoleWarn(...args);
};

// Error logs are NEVER suppressed - they should always be visible
// console.error is left unchanged

/**
 * Enable debug mode (requires page reload to take effect)
 */
window.enablePosDebug = function () {
    localStorage.setItem('POS_DEBUG', 'true');
    originalConsoleLog('%c🐛 POS Debug Mode ENABLED', 'color: green; font-weight: bold');
    originalConsoleLog('Reload the page to see all debug logs.');
};

/**
 * Disable debug mode
 */
window.disablePosDebug = function () {
    localStorage.removeItem('POS_DEBUG');
    originalConsoleLog('%c🔇 POS Debug Mode DISABLED', 'color: orange; font-weight: bold');
    originalConsoleLog('Reload the page to suppress debug logs.');
};

/**
 * Check if debug mode is currently enabled
 */
window.isPosDebugEnabled = function () {
    const status = localStorage.getItem('POS_DEBUG') === 'true';
    originalConsoleLog(`POS Debug Mode: ${status ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    return status;
};

// Log status on load (visible in both modes)
if (DEBUG) {
    originalConsoleLog('%c🐛 POS Debug Mode: ACTIVE', 'color: green; font-weight: bold; font-size: 12px');
}

export { DEBUG };
export default { DEBUG };
