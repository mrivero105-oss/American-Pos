import { api } from './api.js';
import { ui } from './ui.js';
import { currencySettings } from './utils.js';

export class Settings {
    constructor() {
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
    }

    cacheDOM() {
        this.dom = {
            rateInput: document.getElementById('exchange-rate-input'),
            saveRateBtn: document.getElementById('save-rate-btn'),
            // Business Info
            businessName: document.getElementById('business-name'),
            businessAddress: document.getElementById('business-address'),
            businessPhone: document.getElementById('business-phone'),
            businessTaxId: document.getElementById('business-tax-id'),
            businessLogo: document.getElementById('business-logo'), // Enabled
            saveBusinessBtn: document.getElementById('save-business-btn'),

            // Payment Methods - NEW
            paymentMethodsList: document.getElementById('payment-methods-list'),
            paymentMethodsCount: document.getElementById('payment-methods-count'),

            newPaymentMethodName: document.getElementById('new-payment-method-name'),
            newPaymentMethodCurrency: document.getElementById('new-payment-method-currency'),
            newPaymentMethodRequiresRef: document.getElementById('new-payment-method-requires-ref'),
            addPaymentMethodBtn: document.getElementById('add-payment-method-btn'),

            // Backup
            downloadBackupBtn: document.getElementById('download-backup-btn'),
            restoreBackupBtn: document.getElementById('restore-backup-btn'),
            restoreFileInput: document.getElementById('restore-file-input')
        };
    }

    bindEvents() {
        this.dom.saveRateBtn?.addEventListener('click', () => this.saveRate());
        this.dom.saveBusinessBtn?.addEventListener('click', () => this.saveBusinessInfo());
        this.dom.addPaymentMethodBtn?.addEventListener('click', () => this.addPaymentMethod());

        // Delegation for delete buttons
        this.dom.paymentMethodsList?.addEventListener('click', (e) => {
            const btn = e.target.closest('.delete-method-btn');
            if (btn) {
                const id = btn.dataset.id;
                this.deletePaymentMethod(id);
            }
        });

        // Backup events
        this.dom.downloadBackupBtn?.addEventListener('click', () => this.createBackup());
        this.dom.restoreBackupBtn?.addEventListener('click', () => this.dom.restoreFileInput?.click());
        this.dom.restoreFileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.restoreBackup(e.target.files[0]);
            }
        });

        // Logo file input event
        const logoFileInput = document.getElementById('business-logo-file');
        logoFileInput?.addEventListener('change', (e) => this.handleLogoFileChange(e));

        // Initialize payment methods array
        this.paymentMethods = [];
    }

    async loadSettings() {
        // Hide exchange rate section when USD-only mode
        const exchangeRateContainer = document.getElementById('exchange-rate-container');
        if (exchangeRateContainer) {
            exchangeRateContainer.style.display = currencySettings.isBsEnabled() ? '' : 'none';
        }

        try {
            // Use allSettled to prevent one failure from blocking everything
            const results = await Promise.allSettled([
                api.settings.getRate(),
                api.settings.getBusinessInfo(),
                api.settings.getPaymentMethods()
            ]);

            const rateData = results[0].status === 'fulfilled' ? results[0].value : { rate: 1 };
            const businessData = results[1].status === 'fulfilled' ? results[1].value : {};
            const paymentMethods = results[2].status === 'fulfilled' ? results[2].value : [];

            if (results[0].status === 'rejected') console.warn('Failed to load exchange rate', results[0].reason);
            if (results[1].status === 'rejected') console.warn('Failed to load business info', results[1].reason);
            if (results[2].status === 'rejected') console.warn('Failed to load payment methods', results[2].reason);

            // Populate UI
            if (this.dom.rateInput) {
                this.dom.rateInput.value = rateData.rate || 1;
            }

            if (this.dom.businessName) {
                this.dom.businessName.value = businessData.name || '';
            }
            if (this.dom.businessAddress) {
                this.dom.businessAddress.value = businessData.address || '';
            }
            if (this.dom.businessPhone) {
                this.dom.businessPhone.value = businessData.phone || '';
            }
            if (this.dom.businessTaxId) {
                this.dom.businessTaxId.value = businessData.taxId || '';
            }
            if (this.dom.businessLogo) {
                this.dom.businessLogo.value = businessData.logoUrl || '';
                this.updateLogoPreview(businessData.logoUrl);
            }

            // Store payment methods locally and render
            this.paymentMethods = paymentMethods || [];
            this.renderPaymentMethods();
        } catch (error) {
            console.error('Error loading settings:', error);
            ui.showNotification('Error loading settings', 'error');
        }
    }

    handleLogoFileChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            ui.showNotification('Por favor selecciona una imagen válida', 'error');
            return;
        }

        // Validate file size (max 500KB for base64 storage)
        if (file.size > 500 * 1024) {
            ui.showNotification('La imagen es muy grande. Máximo 500KB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            // Set the base64 data URL in the input field
            if (this.dom.businessLogo) {
                this.dom.businessLogo.value = base64;
            }
            this.updateLogoPreview(base64);
            ui.showNotification('Imagen cargada. Haz clic en Guardar Cambios para aplicar.', 'success');
        };
        reader.readAsDataURL(file);
    }

    updateLogoPreview(logoUrl) {
        const preview = document.getElementById('logo-preview');
        if (!preview) return;

        if (logoUrl && logoUrl.trim() !== '') {
            preview.innerHTML = `<img src="${logoUrl}" alt="Logo" class="w-full h-full object-cover">`;
        } else {
            preview.innerHTML = '<span class="text-xs text-slate-400">Sin logo</span>';
        }
    }

    async saveRate() {
        if (this.dom.saveRateBtn.disabled) return;

        const rate = parseFloat(this.dom.rateInput?.value);
        if (!rate || rate <= 0) {
            ui.showNotification('Please enter a valid rate', 'error');
            return;
        }

        this.dom.saveRateBtn.disabled = true;
        this.dom.saveRateBtn.textContent = 'Guardando...';

        try {
            await api.settings.updateRate(rate);
            ui.showNotification('Tasa actualizada correctamente');
            // Trigger an event or callback to update POS if needed
            try {
                if (window.app && window.app.views.pos) {
                    // Refresh settings in POS to get new rate
                    window.app.views.pos.loadSettings();
                }
            } catch (posError) {
                console.error('Error updating POS with new rate:', posError);
            }
        } catch (error) {
            ui.showNotification('Error saving rate', 'error');
        } finally {
            this.dom.saveRateBtn.disabled = false;
            this.dom.saveRateBtn.textContent = 'OK';
        }
    }

    async saveBusinessInfo() {
        if (this.dom.saveBusinessBtn.disabled) return;

        const info = {
            name: this.dom.businessName?.value.trim(),
            address: this.dom.businessAddress?.value.trim(),
            phone: this.dom.businessPhone?.value.trim(),
            taxId: this.dom.businessTaxId?.value.trim(),
            logoUrl: this.dom.businessLogo?.value.trim()
        };

        this.dom.saveBusinessBtn.disabled = true;
        this.dom.saveBusinessBtn.textContent = 'Guardando...';

        try {
            await api.settings.updateBusinessInfo(info);
            ui.showNotification('Información del negocio actualizada');
        } catch (error) {
            ui.showNotification('Error saving business info', 'error');
        } finally {
            this.dom.saveBusinessBtn.disabled = false;
            this.dom.saveBusinessBtn.textContent = 'Guardar Cambios';
        }
    }

    renderPaymentMethods() {
        if (!this.dom.paymentMethodsList) return;

        if (this.dom.paymentMethodsCount) {
            this.dom.paymentMethodsCount.textContent = this.paymentMethods.length;
        }

        if (this.paymentMethods.length === 0) {
            this.dom.paymentMethodsList.innerHTML = `
                <div class="text-center py-8 text-slate-400 flex flex-col items-center">
                    <svg class="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                    <span class="text-sm">Sin métodos de pago</span>
                </div>
            `;
            return;
        }

        this.dom.paymentMethodsList.innerHTML = this.paymentMethods.map(method => `
            <div class="flex justify-between items-center p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors group shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs">
                        ${method.currency}
                    </div>
                    <div>
                        <p class="font-bold text-slate-800 dark:text-white text-sm">${method.name}</p>
                        ${method.requiresReference ? '<span class="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Ref. Req</span>' : ''}
                    </div>
                </div>
                <button class="delete-method-btn text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all focus:opacity-100" data-id="${method.id}" title="Eliminar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `).join('');
    }

    async addPaymentMethod() {
        const name = this.dom.newPaymentMethodName?.value.trim();
        const currency = this.dom.newPaymentMethodCurrency?.value || 'USD';
        const requiresReference = this.dom.newPaymentMethodRequiresRef?.checked;

        if (!name) {
            ui.showNotification('El nombre es requerido', 'warning');
            return;
        }

        const newMethod = {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name: name,
            currency: currency,
            type: 'custom',
            requiresReference: requiresReference
        };

        // Check for duplicates
        if (this.paymentMethods.some(m => m.id === newMethod.id)) {
            ui.showNotification('Este método de pago ya existe', 'warning');
            return;
        }

        this.paymentMethods.push(newMethod);

        try {
            await api.settings.updatePaymentMethods(this.paymentMethods);
            this.renderPaymentMethods();

            // Clear inputs
            this.dom.newPaymentMethodName.value = '';
            this.dom.newPaymentMethodRequiresRef.checked = false;
            this.dom.newPaymentMethodName.focus(); // Focus back for rapid entry

            ui.showNotification('Método de pago agregado');
        } catch (error) {
            console.error('Error adding payment method:', error);
            ui.showNotification('Error al agregar método de pago', 'error');
            // Revert
            this.paymentMethods.pop();
        }
    }

    async deletePaymentMethod(id) {
        if (!confirm('¿Estás seguro de eliminar este método de pago?')) return;

        const originalMethods = [...this.paymentMethods];
        this.paymentMethods = this.paymentMethods.filter(m => m.id !== id);

        try {
            await api.settings.updatePaymentMethods(this.paymentMethods);
            this.renderPaymentMethods();
            ui.showNotification('Método de pago eliminado');
        } catch (error) {
            console.error('Error deleting payment method:', error);
            ui.showNotification('Error al eliminar método de pago', 'error');
            // Revert
            this.paymentMethods = originalMethods;
            this.renderPaymentMethods();
        }
    }

    // --- BACKUP & RESTORE ---
    async createBackup() {
        try {
            this.dom.downloadBackupBtn.disabled = true;
            this.dom.downloadBackupBtn.textContent = 'Generando...';

            const data = await api.backup.create();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_pos_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            ui.showNotification('Copia de seguridad descargada');
        } catch (error) {
            console.error('Error creating backup:', error);
            ui.showNotification('Error al crear copia de seguridad', 'error');
        } finally {
            this.dom.downloadBackupBtn.disabled = false;
            this.dom.downloadBackupBtn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Descargar Copia
            `;
        }
    }

    async restoreBackup(file) {
        if (!confirm('ADVERTENCIA: Esto sobrescribirá todos los datos actuales. Se creará una copia de seguridad automática antes de proceder. ¿Estás seguro?')) {
            this.dom.restoreFileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backupData = JSON.parse(e.target.result);

                this.dom.restoreBackupBtn.disabled = true;
                this.dom.restoreBackupBtn.textContent = 'Restaurando...';

                await api.backup.restore(backupData);

                alert('Restauración completada con éxito. La página se recargará.');
                window.location.reload();
            } catch (error) {
                console.error('Error restoring backup:', error);
                ui.showNotification('Error al restaurar: Archivo inválido o corrupto', 'error');
                this.dom.restoreBackupBtn.disabled = false;
                this.dom.restoreBackupBtn.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                    </svg>
                    Restaurar Copia
                `;
            }
        };
        reader.readAsText(file);
    }
}
