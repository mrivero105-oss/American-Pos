import { ui } from '../../ui.js';

export class WeightModal {
    constructor(pos) {
        this.pos = pos;
        this.selectedWeightProduct = null;
    }

    openWeightModal(product) {
        this.selectedWeightProduct = product;

        if (!this.pos.dom.weightModal || !this.pos.dom.weightModalTitle || !this.pos.dom.weightModalUnitPrice || !this.pos.dom.weightInput || !this.pos.dom.weightPriceUsd) {
            console.error('Weight modal elements not found in DOM cache');
            return;
        }

        this.pos.dom.weightModalTitle.textContent = product.name;
        this.pos.dom.weightModalUnitPrice.textContent = `$${parseFloat(product.price).toFixed(2)} / Kg`;

        this.pos.dom.weightInput.value = '';
        this.pos.dom.weightPriceUsd.value = '';
        if (this.pos.dom.weightPriceBs) this.pos.dom.weightPriceBs.value = '';

        // Focus weight input by default
        setTimeout(() => this.pos.dom.weightInput.focus(), 100);

        this.pos.dom.weightModal.classList.remove('hidden');
        this.pos.dom.weightModal.style.display = 'flex';
    }

    closeWeightModal() {
        if (this.pos.dom.weightModal) {
            this.pos.dom.weightModal.classList.add('hidden');
            this.pos.dom.weightModal.style.display = 'none';
        }
        this.selectedWeightProduct = null;
    }

    confirmWeightItem() {
        if (!this.selectedWeightProduct) return;

        const weight = parseFloat(this.pos.dom.weightInput.value);

        if (isNaN(weight) || weight <= 0) {
            ui.showNotification('Ingrese un peso válido', 'warning');
            return;
        }

        // Add to cart with specific quantity (weight)
        // We pass the weight as quantity
        try {
            this.pos.cartManager.addToCart(this.selectedWeightProduct, weight);
            this.closeWeightModal();
        } catch (error) {
            console.error('Error adding weighted item:', error);
            ui.showNotification('Error al agregar producto', 'error');
        }
    }

    calculateWeightValues(source) {
        if (!this.selectedWeightProduct) return;

        const pricePerKg = parseFloat(this.selectedWeightProduct.price);
        const exchangeRate = this.pos.exchangeRate;

        console.log(`Calculating weight values. Source: ${source}, Price/Kg: ${pricePerKg}, Rate: ${exchangeRate}`);

        if (source === 'weight') {
            const weight = parseFloat(this.pos.dom.weightInput.value);
            console.log('Weight input:', weight);
            if (!isNaN(weight)) {
                const totalPrice = weight * pricePerKg;
                const totalBs = totalPrice * exchangeRate;

                this.pos.dom.weightPriceUsd.value = totalPrice.toFixed(2);
                if (this.pos.dom.weightPriceBs) this.pos.dom.weightPriceBs.value = totalBs.toFixed(2);
            } else {
                this.pos.dom.weightPriceUsd.value = '';
                if (this.pos.dom.weightPriceBs) this.pos.dom.weightPriceBs.value = '';
            }
        } else if (source === 'price_usd') {
            const priceUsd = parseFloat(this.pos.dom.weightPriceUsd.value);
            console.log('USD input:', priceUsd);
            if (!isNaN(priceUsd) && pricePerKg > 0) {
                const weight = priceUsd / pricePerKg;
                const totalBs = priceUsd * exchangeRate;

                this.pos.dom.weightInput.value = weight.toFixed(3);
                if (this.pos.dom.weightPriceBs) this.pos.dom.weightPriceBs.value = totalBs.toFixed(2);
            } else {
                this.pos.dom.weightInput.value = '';
                if (this.pos.dom.weightPriceBs) this.pos.dom.weightPriceBs.value = '';
            }
        } else if (source === 'price_bs') {
            const priceBs = parseFloat(this.pos.dom.weightPriceBs.value);
            console.log('Bs input:', priceBs);
            if (!isNaN(priceBs) && exchangeRate > 0 && pricePerKg > 0) {
                const priceUsd = priceBs / exchangeRate;
                const weight = priceUsd / pricePerKg;
                console.log('Calculated USD:', priceUsd, 'Weight:', weight);
                this.pos.dom.weightPriceUsd.value = priceUsd.toFixed(2);
                this.pos.dom.weightInput.value = weight.toFixed(3);
            } else {
                this.pos.dom.weightPriceUsd.value = '';
                this.pos.dom.weightInput.value = '';
            }
        }
    }
}
