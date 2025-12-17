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
        const xReportBtn = document.getElementById('x-report-btn');
        const historyBtn = document.getElementById('cash-history-btn');

        if (openBtn) openBtn.addEventListener('click', () => this.showOpenModal());
        if (closeBtn) closeBtn.addEventListener('click', () => this.showCloseModal());
        if (movementBtn) movementBtn.addEventListener('click', () => this.showMovementModal());
        if (xReportBtn) xReportBtn.addEventListener('click', () => this.showXReport());
        if (historyBtn) historyBtn.addEventListener('click', () => this.showHistory());

        // Bind Modal Actions
        document.getElementById('confirm-open-cash')?.addEventListener('click', () => this.handleOpenShift());
        document.getElementById('confirm-close-cash')?.addEventListener('click', () => this.handleCloseShift());
        document.getElementById('confirm-cash-movement')?.addEventListener('click', () => this.handleMovement());
    }

    updateUI() {
        const openBtn = document.getElementById('open-cash-btn');
        const closeBtn = document.getElementById('close-cash-btn');
        const movementBtn = document.getElementById('cash-movement-btn');
        const xReportBtn = document.getElementById('x-report-btn');
        const statusIndicator = document.getElementById('cash-status-indicator');

        if (this.currentShift) {
            // Shift is OPEN
            if (openBtn) openBtn.classList.add('hidden');
            if (closeBtn) closeBtn.classList.remove('hidden');
            if (movementBtn) movementBtn.classList.remove('hidden');
            if (xReportBtn) xReportBtn.classList.remove('hidden');
            if (statusIndicator) {
                statusIndicator.textContent = 'ABIERTA';
                statusIndicator.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20';
            }
        } else {
            // Shift is CLOSED
            if (openBtn) openBtn.classList.remove('hidden');
            if (closeBtn) closeBtn.classList.add('hidden');
            if (movementBtn) movementBtn.classList.add('hidden');
            if (xReportBtn) xReportBtn.classList.add('hidden');
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

    async showXReport() {
        try {
            const report = await api.cash.getXReport();
            this.showReportModal(report, 'X');
        } catch (error) {
            console.error('Error getting X-Report:', error);
            ui.showNotification(error.message, 'error');
        }
    }

    async showHistory() {
        try {
            const shifts = await api.cash.getHistory();
            this.showHistoryModal(shifts);
        } catch (error) {
            console.error('Error getting history:', error);
            ui.showNotification(error.message, 'error');
        }
    }

    showReportModal(data, type = 'Z') {
        const paymentLabels = {
            'cash': 'Efectivo USD',
            'cash_bs': 'Efectivo Bs',
            'cash_ves': 'Efectivo Bs',
            'card': 'Tarjeta',
            'zelle': 'Zelle',
            'pago_movil': 'Pago Móvil',
            'transfer': 'Transferencia'
        };

        let breakdownHtml = '';
        if (data.paymentBreakdown) {
            breakdownHtml = Object.entries(data.paymentBreakdown)
                .map(([method, amount]) => `
                    <div class="flex justify-between py-1">
                        <span class="text-slate-500">${paymentLabels[method] || method}</span>
                        <span class="font-medium">$${amount.toFixed(2)}</span>
                    </div>
                `).join('');
        }

        const html = `
            <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                    <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 class="text-xl font-bold text-slate-900 dark:text-white">Corte ${type}</h3>
                        <button onclick="this.closest('.fixed').remove()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-4 space-y-4">
                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-center">
                                <div class="text-2xl font-bold text-blue-600">${data.salesCount || 0}</div>
                                <div class="text-xs text-slate-500">Ventas</div>
                            </div>
                            <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl text-center">
                                <div class="text-2xl font-bold text-green-600">$${(data.totalSalesAmount || 0).toFixed(2)}</div>
                                <div class="text-xs text-slate-500">Total Ventas</div>
                            </div>
                        </div>
                        
                        <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <div class="text-xs font-bold text-slate-500 uppercase mb-2">Desglose por Método</div>
                            ${breakdownHtml || '<div class="text-slate-400 text-sm">Sin ventas</div>'}
                        </div>

                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between"><span>Fondo Inicial</span><span class="font-medium">$${(data.shift?.startingCash || data.startingCash || 0).toFixed(2)}</span></div>
                            <div class="flex justify-between"><span>Ventas Efectivo</span><span class="font-medium text-green-600">+$${(data.cashSalesTotal || 0).toFixed(2)}</span></div>
                            <div class="flex justify-between"><span>Depósitos</span><span class="font-medium text-green-600">+$${(data.deposits || data.totalIn || 0).toFixed(2)}</span></div>
                            <div class="flex justify-between"><span>Retiros</span><span class="font-medium text-red-600">-$${(data.withdrawals || data.totalOut || 0).toFixed(2)}</span></div>
                            <div class="flex justify-between"><span>Gastos</span><span class="font-medium text-orange-600">-$${(data.expenses || data.totalExpenses || 0).toFixed(2)}</span></div>
                            <div class="border-t border-slate-200 dark:border-slate-600 pt-2 flex justify-between font-bold text-lg">
                                <span>Esperado en Caja</span>
                                <span class="text-emerald-600">$${(data.expectedCash || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    showHistoryModal(shifts) {
        const rows = shifts.map(s => {
            const diff = s.difference || 0;
            const diffClass = diff === 0 ? 'text-green-600' : (diff > 0 ? 'text-blue-600' : 'text-red-600');
            return `
                <tr class="border-b border-slate-100 dark:border-slate-700">
                    <td class="py-2 text-sm">${new Date(s.closedAt).toLocaleDateString()}</td>
                    <td class="py-2 text-sm">${new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="py-2 text-sm font-medium">$${(s.expectedCash || 0).toFixed(2)}</td>
                    <td class="py-2 text-sm font-medium ${diffClass}">$${diff.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 class="text-xl font-bold text-slate-900 dark:text-white">Historial de Cierres</h3>
                        <button onclick="this.closest('.fixed').remove()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-4">
                        <table class="w-full">
                            <thead>
                                <tr class="text-left text-xs text-slate-500 uppercase">
                                    <th class="pb-2">Fecha</th>
                                    <th class="pb-2">Horario</th>
                                    <th class="pb-2">Total</th>
                                    <th class="pb-2">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="4" class="text-center py-4 text-slate-400">Sin historial</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }
}
