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
        const diff = shiftData.difference || 0;
        const diffClass = diff === 0 ? 'text-emerald-500' : (diff > 0 ? 'text-blue-500' : 'text-red-500');
        const diffStatus = diff === 0 ? '✓ CUADRADO' : (diff > 0 ? '▲ SOBRANTE' : '▼ FALTANTE');

        // Calculate shift duration
        const openTime = new Date(shiftData.openedAt);
        const closeTime = new Date(shiftData.closedAt);
        const durationMs = closeTime - openTime;
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const durationStr = `${hours}h ${minutes}m`;

        const paymentLabels = {
            'cash': 'Efectivo USD', 'cash_bs': 'Efectivo Bs', 'cash_ves': 'Efectivo Bs',
            'card': 'Tarjeta', 'zelle': 'Zelle', 'pago_movil': 'Pago Móvil', 'transfer': 'Transferencia'
        };

        let breakdownRows = '';
        if (shiftData.paymentBreakdown && Object.keys(shiftData.paymentBreakdown).length > 0) {
            breakdownRows = Object.entries(shiftData.paymentBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => `
                    <tr><td class="py-1.5 text-slate-600 dark:text-slate-400">${paymentLabels[method] || method}</td>
                    <td class="py-1.5 text-right font-mono font-medium">$${amount.toFixed(2)}</td></tr>
                `).join('');
        }

        const avgTicket = shiftData.salesCount > 0 ? (shiftData.totalSalesAmount / shiftData.salesCount) : 0;

        const html = `
            <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="z-report-modal">
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-hidden flex flex-col">
                    <!-- Header -->
                    <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-center relative">
                        <div class="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold mb-3">
                            <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                            CORTE Z - CIERRE OFICIAL
                        </div>
                        <h2 class="text-2xl font-bold text-white">Resumen de Caja</h2>
                        <p class="text-slate-400 text-sm mt-1">${closeTime.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    
                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto p-5 space-y-4" id="z-report-content">
                        <!-- Time Info -->
                        <div class="flex justify-between items-center text-sm bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                            <div class="text-center flex-1">
                                <div class="text-[10px] text-slate-500 uppercase">Apertura</div>
                                <div class="font-bold text-slate-800 dark:text-white">${openTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            <div class="text-center flex-1 border-x border-slate-200 dark:border-slate-600">
                                <div class="text-[10px] text-slate-500 uppercase">Duración</div>
                                <div class="font-bold text-blue-600">${durationStr}</div>
                            </div>
                            <div class="text-center flex-1">
                                <div class="text-[10px] text-slate-500 uppercase">Cierre</div>
                                <div class="font-bold text-slate-800 dark:text-white">${closeTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>

                        <!-- Stats Cards -->
                        <div class="grid grid-cols-3 gap-2">
                            <div class="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl text-center text-white shadow-lg shadow-blue-500/20">
                                <div class="text-2xl font-bold">${shiftData.salesCount || 0}</div>
                                <div class="text-[10px] opacity-80 uppercase">Ventas</div>
                            </div>
                            <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 rounded-xl text-center text-white shadow-lg shadow-emerald-500/20">
                                <div class="text-lg font-bold">$${(shiftData.totalSalesAmount || 0).toFixed(2)}</div>
                                <div class="text-[10px] opacity-80 uppercase">Total</div>
                            </div>
                            <div class="bg-gradient-to-br from-violet-500 to-violet-600 p-3 rounded-xl text-center text-white shadow-lg shadow-violet-500/20">
                                <div class="text-lg font-bold">$${avgTicket.toFixed(2)}</div>
                                <div class="text-[10px] opacity-80 uppercase">Promedio</div>
                            </div>
                        </div>

                        <!-- Payment Breakdown -->
                        ${breakdownRows ? `
                        <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <div class="bg-slate-100 dark:bg-slate-700 px-4 py-2">
                                <span class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Desglose por Método</span>
                            </div>
                            <table class="w-full text-sm px-4"><tbody class="divide-y divide-slate-100 dark:divide-slate-700">${breakdownRows}</tbody></table>
                        </div>
                        ` : ''}

                        <!-- Cash Flow -->
                        <div class="space-y-1 text-sm font-mono">
                            <div class="flex justify-between py-1.5 border-b border-dashed border-slate-200 dark:border-slate-700">
                                <span class="text-slate-600 dark:text-slate-400">Fondo Inicial</span>
                                <span class="font-medium">$${(shiftData.startingCash || 0).toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-dashed border-slate-200 dark:border-slate-700">
                                <span class="text-slate-600 dark:text-slate-400">+ Ventas Efectivo</span>
                                <span class="font-medium text-emerald-600">$${(shiftData.cashSalesTotal || 0).toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-dashed border-slate-200 dark:border-slate-700">
                                <span class="text-slate-600 dark:text-slate-400">+ Depósitos</span>
                                <span class="font-medium text-emerald-600">$${(shiftData.totalIn || 0).toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-dashed border-slate-200 dark:border-slate-700">
                                <span class="text-slate-600 dark:text-slate-400">- Retiros</span>
                                <span class="font-medium text-red-600">$${(shiftData.totalOut || 0).toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between py-1.5">
                                <span class="text-slate-600 dark:text-slate-400">- Gastos</span>
                                <span class="font-medium text-orange-600">$${(shiftData.totalExpenses || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <!-- Final Summary -->
                        <div class="bg-slate-900 dark:bg-black rounded-xl p-4 text-white space-y-3">
                            <div class="flex justify-between items-center">
                                <span class="text-slate-400">Esperado en Caja</span>
                                <span class="text-xl font-bold font-mono">$${(shiftData.expectedCash || 0).toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-slate-400">Real Contado</span>
                                <span class="text-xl font-bold font-mono text-blue-400">$${(shiftData.actualCash || 0).toFixed(2)}</span>
                            </div>
                            <div class="border-t border-slate-700 pt-3 flex justify-between items-center">
                                <div>
                                    <span class="text-slate-400 text-sm">Diferencia</span>
                                    <div class="text-xs ${diffClass} font-bold">${diffStatus}</div>
                                </div>
                                <span class="text-3xl font-bold font-mono ${diffClass}">
                                    ${diff >= 0 ? '+' : '-'}$${Math.abs(diff).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 bg-slate-50 dark:bg-slate-900">
                        <button onclick="window.printZReport()" class="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            Imprimir
                        </button>
                        <button onclick="document.getElementById('z-report-modal').remove()" class="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        // Print function
        window.printZReport = () => {
            const printWindow = window.open('', '_blank');
            const printHtml = '<html><head><title>Corte Z</title><style>body{font-family:Courier New,monospace;padding:20px;max-width:300px;margin:0 auto}h2{text-align:center;margin:0}hr{border:none;border-top:1px dashed #000;margin:10px 0}.b{font-weight:bold}</style></head><body>' +
                '<h2>CORTE Z</h2>' +
                '<p style="text-align:center">' + new Date().toLocaleString() + '</p><hr>' +
                '<p>Ventas: ' + (shiftData.salesCount || 0) + '</p>' +
                '<p>Total: $' + (shiftData.totalSalesAmount || 0).toFixed(2) + '</p>' +
                '<p>Duracion: ' + durationStr + '</p><hr>' +
                '<p>Fondo: $' + (shiftData.startingCash || 0).toFixed(2) + '</p>' +
                '<p>+ Efectivo: $' + (shiftData.cashSalesTotal || 0).toFixed(2) + '</p>' +
                '<p>+ Depositos: $' + (shiftData.totalIn || 0).toFixed(2) + '</p>' +
                '<p>- Retiros: $' + (shiftData.totalOut || 0).toFixed(2) + '</p>' +
                '<p>- Gastos: $' + (shiftData.totalExpenses || 0).toFixed(2) + '</p><hr>' +
                '<p class="b">ESPERADO: $' + (shiftData.expectedCash || 0).toFixed(2) + '</p>' +
                '<p class="b">REAL: $' + (shiftData.actualCash || 0).toFixed(2) + '</p>' +
                '<p class="b">DIFERENCIA: ' + (diff >= 0 ? '+' : '') + '$' + diff.toFixed(2) + '</p><hr>' +
                '<p style="text-align:center">*** FIN DEL CORTE ***</p></body></html>';
            printWindow.document.write(printHtml);
            printWindow.document.close();
            printWindow.print();
        };
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
                < div class= "flex justify-between py-1" >
                        <span class="text-slate-500">${paymentLabels[method] || method}</span>
                        <span class="font-medium">$${amount.toFixed(2)}</span>
                    </div >
                `).join('');
        }

        const html = `
                < div class= "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" >
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
            </div >
                `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    showHistoryModal(shifts) {
        const rows = shifts.map(s => {
            const diff = s.difference || 0;
            const diffClass = diff === 0 ? 'text-green-600' : (diff > 0 ? 'text-blue-600' : 'text-red-600');
            return `
                < tr class= "border-b border-slate-100 dark:border-slate-700" >
                    <td class="py-2 text-sm">${new Date(s.closedAt).toLocaleDateString()}</td>
                    <td class="py-2 text-sm">${new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="py-2 text-sm font-medium">$${(s.expectedCash || 0).toFixed(2)}</td>
                    <td class="py-2 text-sm font-medium ${diffClass}">$${diff.toFixed(2)}</td>
                </tr >
                `;
        }).join('');

        const html = `
                < div class= "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" >
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
            </div >
                `;
        document.body.insertAdjacentHTML('beforeend', html);
    }
}
