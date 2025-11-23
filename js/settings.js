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
            saveRateBtn: document.getElementById('save-rate-btn')
        };
    }

    bindEvents() {
        this.dom.saveRateBtn?.addEventListener('click', () => this.saveRate());
    }

    async loadSettings() {
        try {
            const data = await api.settings.getRate();
            if (this.dom.rateInput) {
                this.dom.rateInput.value = data.rate;
            }
            return data.rate;
        } catch (error) {
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
}
