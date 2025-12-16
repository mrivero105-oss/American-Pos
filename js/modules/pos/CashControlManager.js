import { api } from '../../api.js';
import { ui } from '../../ui.js';
import { formatCurrency, formatBs } from '../../utils.js';

export class CashControlManager {
    constructor(pos) {
        this.pos = pos;
        this.currentShift = null;
    }

    async init() {
        await this.checkCurrentShift();
        this.bindEvents();
    }

    async checkCurrentShift() {
        try {
            this.currentShift = await api.cash.getCurrentShift();
        } catch (error) {
            console.error('Error checking shift:', error);
            ui.showNotification('Error de conexión con Caja: ' + error.message, 'warning');
            this.currentShift = null;
        } finally {
            this.updateUI();
        }
    }

    bindEvents() {
        // Bind global buttons if they exist (will be added to index.html)
        const openBtn = document.getElementById('open-cash-btn');
        const closeBtn = document.getElementById('close-cash-btn');
        const movementBtn = document.getElementById('cash-movement-btn');

        if (openBtn) openBtn.addEventListener('click', () => this.showOpenModal());
        if (closeBtn) closeBtn.addEventListener('click', () => this.showCloseModal());
        if (movementBtn) movementBtn.addEventListener('click', () => this.showMovementModal());

        // Bind Modal Actions
        document.getElementById('confirm-open-cash')?.addEventListener('click', () => this.handleOpenShift());
        document.getElementById('confirm-close-cash')?.addEventListener('click', () => this.handleCloseShift());
        document.getElementById('confirm-cash-movement')?.addEventListener('click', () => this.handleMovement());
    }

    updateUI() {
        const openBtn = document.getElementById('open-cash-btn');
        const closeBtn = document.getElementById('close-cash-btn');
        const movementBtn = document.getElementById('cash-movement-btn');
        const statusIndicator = document.getElementById('cash-status-indicator');

        if (this.currentShift) {
            // Shift is OPEN
            if (openBtn) openBtn.classList.add('hidden');
            if (closeBtn) closeBtn.classList.remove('hidden');
            if (movementBtn) movementBtn.classList.remove('hidden');
            if (statusIndicator) {
                statusIndicator.textContent = 'ABIERTA';
                statusIndicator.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20';
            }
        } else {
            // Shift is CLOSED
            if (openBtn) openBtn.classList.remove('hidden');
            if (closeBtn) closeBtn.classList.add('hidden');
            if (movementBtn) movementBtn.classList.add('hidden');
            if (statusIndicator) {
                statusIndicator.textContent = 'CERRADA';
                statusIndicator.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20';
            }
        }
    }

    showOpenModal() {
        ui.toggleModal('open-cash-modal', true);
        document.getElementById('open-cash-amount').value = '';
        document.getElementById('open-cash-amount').focus();
    }

    async handleOpenShift() {
        const amountInput = document.getElementById('open-cash-amount');
        const amount = parseFloat(amountInput.value);

        if (isNaN(amount) || amount < 0) {
            ui.showNotification('Ingrese un monto válido', 'error');
            return;
        }

        try {
            this.currentShift = await api.cash.openShift(amount, 'admin'); // TODO: Use real user ID
            ui.toggleModal('open-cash-modal', false);
            ui.showNotification('Caja abierta exitosamente');
            this.updateUI();
        } catch (error) {
            console.error('Error opening shift:', error);
            ui.showNotification(error.message, 'error');
        }
    }

    async showCloseModal() {
        // Refresh current shift data to get expected totals
        await this.checkCurrentShift();

        if (!this.currentShift) return;

        // expectedCash is in USD from backend, convert to Bs for display
        const expectedInBs = (this.currentShift.expectedCash || 0) * (this.pos.exchangeRate || 1);
        document.getElementById('expected-cash-display').textContent = formatBs(expectedInBs);
        document.getElementById('close-cash-actual').value = '';

        ui.toggleModal('close-cash-modal', true);
        document.getElementById('close-cash-actual').focus();
    }

    async handleCloseShift() {
        const actualInput = document.getElementById('close-cash-actual');
        const actual = parseFloat(actualInput.value);

        if (isNaN(actual) || actual < 0) {
            ui.showNotification('Ingrese un monto válido', 'error');
            return;
        }

        try {
            const result = await api.cash.closeShift(actual);
            ui.toggleModal('close-cash-modal', false);

            // Show Z-Report Summary
            this.showZReport(result);

            this.currentShift = null;
            this.updateUI();
        } catch (error) {
            console.error('Error closing shift:', error);
            ui.showNotification(error.message, 'error');
        }
    }

    showZReport(shiftData) {
        const diff = shiftData.difference;
        const diffClass = diff === 0 ? 'text-green-600' : (diff > 0 ? 'text-blue-600' : 'text-red-600');

        const html = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div class="text-slate-500">Inicio:</div>
                    <div class="text-right font-medium">${new Date(shiftData.openedAt).toLocaleString()}</div>
                    
                    <div class="text-slate-500">Cierre:</div>
                    <div class="text-right font-medium">${new Date(shiftData.closedAt).toLocaleString()}</div>
                    
                    <div class="col-span-2 border-t border-slate-200 my-2"></div>
                    
                    <div class="text-slate-500">Monto Inicial:</div>
                    <div class="text-right font-medium">${formatBs(shiftData.startingCash)}</div>
                    
                    <div class="text-slate-500">Ventas (Est.):</div>
                    <div class="text-right font-medium">${formatBs(shiftData.expectedCash - shiftData.startingCash)}</div>
                    
                    <div class="text-slate-900 font-bold">Esperado en Caja:</div>
                    <div class="text-right font-bold text-slate-900">${formatBs(shiftData.expectedCash)}</div>
                    
                    <div class="text-slate-900 font-bold">Real en Caja:</div>
                    <div class="text-right font-bold text-slate-900">${formatBs(shiftData.actualCash)}</div>
                    
                    <div class="col-span-2 border-t border-slate-200 my-2"></div>
                    
                    <div class="text-slate-900 font-bold">Diferencia:</div>
                    <div class="text-right font-bold ${diffClass}">${formatBs(diff)}</div>
                </div>
            </div>
        `;

        // For now, let's just show notification with difference
        ui.showNotification(`Caja cerrada. Diferencia: ${formatBs(diff)}`);
    }

    showMovementModal() {
        ui.toggleModal('cash-movement-modal', true);
        document.getElementById('movement-amount').value = '';
        document.getElementById('movement-reason').value = '';
    }

    async handleMovement() {
        const type = document.getElementById('movement-type').value;
        const amount = parseFloat(document.getElementById('movement-amount').value);
        const reason = document.getElementById('movement-reason').value;

        if (isNaN(amount) || amount <= 0) {
            ui.showNotification('Monto inválido', 'error');
            return;
        }
        if (!reason) {
            ui.showNotification('Ingrese una razón', 'error');
            return;
        }

        try {
            await api.cash.addMovement(type, amount, reason);
            ui.toggleModal('cash-movement-modal', false);
            ui.showNotification('Movimiento registrado');
            this.checkCurrentShift(); // Update totals
        } catch (error) {
            console.error('Error adding movement:', error);
            ui.showNotification(error.message, 'error');
        }
    }
}
