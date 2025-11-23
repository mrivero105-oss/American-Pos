import { api } from './api.js';
import { ui } from './ui.js';

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
            businessLogo: document.getElementById('business-logo'),
            saveBusinessBtn: document.getElementById('save-business-btn')
        };
    }

    bindEvents() {
        this.dom.saveRateBtn?.addEventListener('click', () => this.saveRate());
        this.dom.saveBusinessBtn?.addEventListener('click', () => this.saveBusinessInfo());
    }

    async loadSettings() {
        try {
            const [rateData, businessData] = await Promise.all([
                api.settings.getRate(),
                api.settings.getBusinessInfo()
            ]);

            if (this.dom.rateInput) {
                this.dom.rateInput.value = rateData.rate;
            }

            if (this.dom.businessName) {
                this.dom.businessName.value = businessData.name || '';
                this.dom.businessAddress.value = businessData.address || '';
                this.dom.businessPhone.value = businessData.phone || '';
                this.dom.businessTaxId.value = businessData.taxId || '';
                this.dom.businessLogo.value = businessData.logoUrl || '';
            }

            return rateData.rate;
        } catch (error) {
            console.error('Error loading settings:', error);
            ui.showNotification('Error loading settings', 'error');
            return 1.0;
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
                    window.app.views.pos.updateExchangeRate(rate);
                }
            } catch (posError) {
                console.error('Error updating POS with new rate:', posError);
            }
        } catch (error) {
            ui.showNotification('Error saving rate', 'error');
        } finally {
            this.dom.saveRateBtn.disabled = false;
            this.dom.saveRateBtn.textContent = 'Guardar Tasa';
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
            this.dom.saveBusinessBtn.textContent = 'Guardar Información';
        }
    }
}
