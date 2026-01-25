/**
 * Boot & Error Handling Utility
 * Manages PWA recovery, boot logging, and global error/rejection tracking.
 */

// Detect if running as installed PWA
const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

// Boot diagnostic
window.bootLog = function (msg) {
    // Disabled for production, but kept as a global hook
    if (window.debugMode) {
        console.log(`[BOOT] ${msg}`);
    }
};

window.bootLog('→ HTML loaded' + (isPWA ? ' [PWA]' : ''));

/**
 * Shows a red error box at the top of the screen for critical failures.
 */
function showScreenError(title, details) {
    let errorBox = document.getElementById('critical-error-box');
    if (!errorBox) {
        errorBox = document.createElement('div');
        errorBox.id = 'critical-error-box';
        errorBox.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: #fee2e2; border-bottom: 4px solid #ef4444; padding: 20px; font-family: monospace; color: #b91c1c; overflow: auto; max-height: 50vh; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);';
        document.body.appendChild(errorBox);
    }

    errorBox.innerHTML += `
        <div style="margin-bottom: 10px; border-bottom: 1px solid #fecaca; padding-bottom: 10px;">
            <strong style="font-size: 1.1em; display: block; margin-bottom: 4px;">🚨 ${title}</strong>
            <pre style="margin: 0; white-space: pre-wrap; font-size: 0.9em;">${details}</pre>
        </div>
    `;
}

// Global error handler
window.addEventListener('error', function (e) {
    console.error('BOOT ERROR:', e.error);
    window.bootLog('❌ ERROR: ' + (e.error ? e.error.message : e.message));

    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; inset: 0; background: #fee; color: #c00; padding: 20px; font-family: monospace; z-index: 99999; display: flex; align-items: center; justify-content: center; text-align: center;';
    errorDiv.innerHTML = `
        <div>
            <h1 style="font-size: 24px; margin-bottom: 10px;">⚠️ Error al cargar</h1>
            <p style="margin-bottom: 5px;">${e.error ? e.error.message : e.message}</p>
            <p style="font-size: 12px; opacity: 0.7;">Archivo: ${e.filename || 'desconocido'}<br>Línea: ${e.lineno || '?'}</p>
            <button onclick="const toKeep = {}; ['pos_held_sales', 'authToken', 'userInfo', 'lastEmail'].forEach(k => toKeep[k] = localStorage.getItem(k)); localStorage.clear(); Object.keys(toKeep).forEach(k => { if(toKeep[k]) localStorage.setItem(k, toKeep[k]); }); if('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister())); location.reload();" 
                    style="margin-top: 15px; padding: 10px 20px; background: #c00; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Reparar y Recargar
            </button>
        </div>`;
    document.body.appendChild(errorDiv);
});

// Unhandled Rejection handler
window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled Rejection:', event.reason);
    showScreenError('Unhandled Rejection', `Reason: ${event.reason ? (event.reason.stack || event.reason) : 'Unknown'}`);
});

// PWA Recovery: If app hasn't loaded successfully in 5 seconds, force recovery
if (isPWA) {
    let bootCompleted = false;

    setTimeout(function () {
        if (!bootCompleted && !window.app) {
            console.error('[PWA] Boot timeout - forcing recovery');

            const failCount = parseInt(localStorage.getItem('pwa_boot_fail_count') || '0');

            if (failCount >= 2) {
                const keysToKeep = ['pos_held_sales', 'pwa_boot_fail_count', 'theme', 'authToken', 'userInfo', 'lastEmail'];
                const savedData = {};
                keysToKeep.forEach(k => { savedData[k] = localStorage.getItem(k); });

                localStorage.clear();
                keysToKeep.forEach(k => { if (savedData[k]) localStorage.setItem(k, savedData[k]); });

                if ('caches' in window) {
                    caches.keys().then(keys => {
                        keys.forEach(key => caches.delete(key));
                    });
                }
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                        regs.forEach(reg => reg.unregister());
                    });
                }
                document.body.innerHTML = `
                    <div style="position: fixed; inset: 0; background: #fee; color: #c00; padding: 20px; font-family: sans-serif; display: flex; align-items: center; justify-content: center; text-align: center;">
                        <div>
                            <h1 style="font-size: 20px; margin-bottom: 10px;">🔄 Reparación Completa</h1>
                            <p style="margin-bottom: 15px;">La app se ha reseteado completamente.<br>Por favor, <strong>cierra la app</strong> y ábrela de nuevo.</p>
                            <button onclick="window.close();" style="padding: 12px 24px; background: #c00; color: white; border: none; border-radius: 6px; font-size: 16px;">Cerrar App</button>
                        </div>
                    </div>`;

            } else {
                localStorage.setItem('pwa_boot_fail_count', String(failCount + 1));
                location.reload();
            }
        }
    }, 5000);

    window.addEventListener('load', function () {
        if (window.app) {
            bootCompleted = true;
            localStorage.setItem('pwa_boot_fail_count', '0');
        }
    });
}

// Export for use in other scripts if needed
window.showScreenError = showScreenError;
