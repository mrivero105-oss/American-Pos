// UI Module v2.1 - showConfirm() for professional confirmation dialogs - Build: 2024.12.19
export const ui = {
    showNotification: (message, type = 'success') => {
        const container = document.getElementById('notification-container');
        if (!container) {
            const newContainer = document.createElement('div');
            newContainer.id = 'notification-container';
            newContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
            document.body.appendChild(newContainer);
        }

        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
        notification.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        notification.textContent = message;

        document.getElementById('notification-container').appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.remove('translate-x-full');
        });

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    },

    toggleModal: (modalId, show = true) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            if (show) {
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
            } else {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        }
    },

    /**
     * Professional confirmation dialog to replace native confirm()
     * @param {Object} options - Configuration options
     * @param {string} options.title - Modal title
     * @param {string} options.message - Confirmation message
     * @param {string} options.confirmText - Text for confirm button (default: 'Confirmar')
     * @param {string} options.cancelText - Text for cancel button (default: 'Cancelar')
     * @param {string} options.type - Type: 'danger', 'warning', 'info' (default: 'danger')
     * @param {string} options.icon - Custom icon HTML (optional)
     * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
     */
    showConfirm: ({ title = 'Confirmar', message, confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'danger', icon = null }) => {
        return new Promise((resolve) => {
            // Remove any existing confirm modal
            const existing = document.getElementById('confirm-modal-global');
            if (existing) existing.remove();

            // Icon configurations
            const icons = {
                danger: `<svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>`,
                warning: `<svg class="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>`,
                info: `<svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>`
            };

            // Button colors
            const buttonColors = {
                danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
                warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
                info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            };

            const selectedIcon = icon || icons[type] || icons.danger;
            const buttonColor = buttonColors[type] || buttonColors.danger;

            const modal = document.createElement('div');
            modal.id = 'confirm-modal-global';
            modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" id="confirm-overlay"></div>
                <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 animate-scale-in">
                    <div class="p-6 text-center">
                        <div class="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
                            ${selectedIcon}
                        </div>
                        <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-2">${title}</h3>
                        <p class="text-slate-600 dark:text-slate-400 text-sm">${message}</p>
                    </div>
                    <div class="flex border-t border-slate-200 dark:border-slate-700">
                        <button id="confirm-modal-cancel" class="flex-1 px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-700">
                            ${cancelText}
                        </button>
                        <button id="confirm-modal-confirm" class="flex-1 px-4 py-3.5 text-white font-medium ${buttonColor} transition-colors">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Focus the confirm button
            setTimeout(() => {
                document.getElementById('confirm-modal-confirm')?.focus();
            }, 100);

            const cleanup = (result) => {
                modal.remove();
                resolve(result);
            };

            document.getElementById('confirm-modal-cancel').onclick = () => cleanup(false);
            document.getElementById('confirm-modal-confirm').onclick = () => cleanup(true);
            document.getElementById('confirm-overlay').onclick = () => cleanup(false);

            // Handle keyboard
            const handleKeydown = (e) => {
                if (e.key === 'Escape') cleanup(false);
                if (e.key === 'Enter') cleanup(true);
            };
            document.addEventListener('keydown', handleKeydown, { once: true });
        });
    }
};
