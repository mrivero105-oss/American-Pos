import { api } from './api.js';
import { formatCurrency, formatDate, formatBs, currencySettings } from './utils.js';
import { ui } from './ui.js';

export class SalesHistory {
    constructor() {
        this.init();
    }

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await this.loadSettings();
    }

    async loadSettings() {
        try {
            const [rateData, businessData, paymentMethods] = await Promise.all([
                api.settings.getRate(),
                api.settings.getBusinessInfo(),
                api.settings.getPaymentMethods()
            ]);
            this.exchangeRate = rateData.rate || 1.0;
            this.businessInfo = businessData || {};
            this.paymentMethods = paymentMethods || [];
        } catch (error) {
            console.error('Error loading settings', error);
        }
    }

    cacheDOM() {
        this.dom = {
            salesTableBody: document.getElementById('sales-table-body'),
            dateFilter: document.getElementById('sales-date-filter'),
            searchInput: document.getElementById('sales-search-input'),
            modal: document.getElementById('sale-details-modal'),
            modalContent: document.getElementById('sale-details-content'),
            closeModalBtn: document.getElementById('close-sale-modal')
        };
    }

    bindEvents() {
        this.dom.dateFilter?.addEventListener('change', (e) => this.loadSales(e.target.value));
        this.dom.searchInput?.addEventListener('input', (e) => this.filterSales(e.target.value));
        this.dom.closeModalBtn?.addEventListener('click', () => ui.toggleModal('sale-details-modal', false));

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.dom.modal) {
                ui.toggleModal('sale-details-modal', false);
            }
        });

        // Event delegation for table actions
        this.dom.salesTableBody?.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-receipt-btn');

            if (btn) {
                e.stopPropagation();
                const saleId = btn.dataset.id;
                const sale = this.sales.find(s => String(s.id) === String(saleId));
                if (sale) this.showDetails(sale);
            }
        });
    }

    async loadSales(date = null) {
        try {
            this.sales = await api.sales.getAll(date);
            this.currentFilteredSales = this.sales; // Store for filtering
            this.renderSales(this.sales);
        } catch (error) {
            console.error('Error loading sales:', error);
            ui.showNotification('Error loading sales history', 'error');
        }
    }

    renderSales(sales) {
        if (!this.dom.salesTableBody) return;

        // Filter out invalid sales (0 items, 0 total)
        const validSales = sales.filter(s => s.items && s.items.length > 0 && s.total > 0);

        if (validSales.length === 0) {
            this.dom.salesTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500 dark:text-gray-400">No se encontraron ventas.</td></tr>';
            this.renderSummary([], 0, 0);
            return;
        }

        // Calculate summary
        const totalUsd = validSales.reduce((sum, s) => sum + s.total, 0);
        const totalBs = validSales.reduce((sum, s) => {
            const rate = s.exchangeRate || this.exchangeRate || 1;
            return sum + (s.total * rate);
        }, 0);

        this.dom.salesTableBody.innerHTML = validSales.map(sale => {
            const rate = sale.exchangeRate || this.exchangeRate || 1;
            const totalInBs = sale.total * rate;
            const methodInfo = this.getPaymentMethodInfo(sale);

            return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" data-id="${sale.id || ''}">
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    ${formatDate(sale.timestamp.toDate ? sale.timestamp.toDate() : sale.timestamp)}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-gray-300">
                    #${(sale.id || '-----').slice(-6)}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm font-medium text-slate-900 dark:text-white">${sale.customer?.name || 'Cliente Casual'}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">${sale.customer?.idDocument || ''}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${methodInfo.color}">
                        ${methodInfo.icon} ${methodInfo.name}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                    ${sale.items.length}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right">
                    <div class="text-sm font-bold text-indigo-600 dark:text-indigo-400">${formatCurrency(sale.total)}</div>
                    ${currencySettings.isBsEnabled() ? `<div class="text-xs text-slate-500 dark:text-slate-400">${formatBs(totalInBs)}</div>` : ''}
                    ${sale.status === 'REFUNDED' ? '<span class="block mt-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] dark:bg-red-900/30 dark:text-red-400">Reemb.</span>' : ''}
                    ${sale.status === 'PARTIAL_REFUNDED' ? '<span class="block mt-1 px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-[10px] dark:bg-yellow-900/30 dark:text-yellow-400">Parcial</span>' : ''}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button data-id="${sale.id}" class="view-receipt-btn text-slate-400 dark:text-slate-300 hover:text-blue-600 transition-colors p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Ver Recibo">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
        }).join('');

        this.renderSummary(validSales, totalUsd, totalBs);
    }

    // Get payment method display info
    getPaymentMethodInfo(sale) {
        const methodMap = {
            'cash': { name: 'Efectivo', icon: '💵', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            'cash_usd': { name: 'USD', icon: '💵', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            'cash_ves': { name: 'Bs', icon: '💵', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            'tarjeta-de-debito': { name: 'Débito', icon: '💳', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
            'debit': { name: 'Débito', icon: '💳', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
            'biopago': { name: 'Biopago', icon: '📱', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
            'pago_movil': { name: 'P. Móvil', icon: '📱', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
            'pago-movil': { name: 'P. Móvil', icon: '📱', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
            'zelle': { name: 'Zelle', icon: '💸', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
            'fiado': { name: 'Fiado', icon: '📋', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' }
        };

        if (sale.paymentMethods && Array.isArray(sale.paymentMethods) && sale.paymentMethods.length > 0) {
            const primaryMethod = sale.paymentMethods[0].method;
            return methodMap[primaryMethod] || { name: primaryMethod, icon: '💰', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
        }
        if (sale.paymentMethod) {
            return methodMap[sale.paymentMethod] || { name: sale.paymentMethod, icon: '💰', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
        }
        return { name: 'Efectivo', icon: '💵', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    }

    // Render period summary at bottom of table
    renderSummary(sales, totalUsd, totalBs) {
        let summaryEl = document.getElementById('sales-period-summary');
        if (!summaryEl) {
            summaryEl = document.createElement('div');
            summaryEl.id = 'sales-period-summary';
            summaryEl.className = 'mt-4 p-4 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700';
            const tableContainer = this.dom.salesTableBody?.closest('.overflow-x-auto');
            if (tableContainer) {
                tableContainer.after(summaryEl);
            }
        }

        if (sales.length === 0) {
            summaryEl.innerHTML = '';
            return;
        }

        summaryEl.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center gap-6">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <span class="text-sm">📊</span>
                        </div>
                        <div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">Ventas</div>
                            <div class="font-bold text-slate-900 dark:text-white">${sales.length}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <span class="text-sm">💵</span>
                        </div>
                        <div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">Total USD</div>
                            <div class="font-bold text-green-600 dark:text-green-400">${formatCurrency(totalUsd)}</div>
                        </div>
                    </div>
                    ${currencySettings.isBsEnabled() ? `
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <span class="text-sm">💰</span>
                        </div>
                        <div>
                            <div class="text-xs text-slate-500 dark:text-slate-400">Total Bs</div>
                            <div class="font-bold text-indigo-600 dark:text-indigo-400">${formatBs(totalBs)}</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    showDetails(sale) {
        if (!this.dom.modalContent) return;

        const canRefund = sale.status !== 'REFUNDED';
        const refundBtn = canRefund ? `
            <div class="mt-4 flex justify-end border-t border-gray-200 dark:border-gray-700 pt-4">
                <button onclick="window.pos.refundManager.initModal(window.pos.salesManager.sales.find(s => s.id === '${sale.id}'))" 
                    class="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors text-sm font-medium flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                    Devolver Productos
                </button>
            </div>` : '';

        // Hack: We need to find the sale object globally or pass it correctly. 
        // Since `this.sales` exists here, we can assume window.pos.salesManager might not be the right place if SalesHistory is separate.
        // Let's attach the sale to window temporarily or use the ID look up.
        // Actually, SalesHistory instance is likely not global. But POS has many managers. 
        // Let's try to expose sales history or just use the button with a global lookup.

        this.dom.modalContent.innerHTML = this.generateReceiptHtml(sale) + refundBtn;

        // We need to ensure the button works. 
        // We will make the onclick access the sale via a global lookup.
        // Let's ensure `window.salesHistory` is available or similar.
        // Better yet, just attach event listener after innerHTML set.

        ui.toggleModal('sale-details-modal', true);

        // Re-attach listener cleanly
        const btn = this.dom.modalContent.querySelector('button[onclick*="refundManager"]');
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                if (window.pos && window.pos.refundManager) {
                    window.pos.refundManager.initModal(sale);
                    ui.toggleModal('sale-details-modal', false); // Close detail modal
                }
            };
        }
    }

    generateReceiptHtml(saleData) {
        // Premium Receipt Design
        const styles = {
            container: "font-family: 'Courier New', Courier, monospace; max-width: 380px; margin: 0 auto; background-color: #fff; color: #000000; padding: 20px; border: 1px solid #eee;",
            header: "text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 15px;",
            title: "font-size: 24px; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; color: #000000;",
            subtitle: "font-size: 12px; color: #555; margin: 2px 0;",
            info: "font-size: 12px; margin-bottom: 15px; color: #000000;",
            row: "display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #000000;",
            itemRow: "display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; color: #000000;",
            divider: "border-top: 1px dashed #000; margin: 10px 0;",
            totalRow: "display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 5px; color: #000000;",
            footer: "text-align: center; margin-top: 20px; font-size: 10px; color: #555; border-top: 1px dashed #000; padding-top: 10px;"
        };

        const dateStr = saleData.timestamp ? new Date(saleData.timestamp.toDate ? saleData.timestamp.toDate() : saleData.timestamp).toLocaleString('es-VE') : new Date().toLocaleString('es-VE');
        const saleIdShort = saleData.id ? saleData.id.slice(0, 8).toUpperCase() : 'N/A';

        // Helper to get method name
        const getMethodName = (id) => {
            const method = this.paymentMethods.find(m => m.id === id);
            return method ? method.name : (id === 'cash' ? 'Efectivo' : id);
        };

        return `
            <div style="${styles.container}">
                <div style="${styles.header}">
                    <h1 style="${styles.title}">${this.businessInfo?.name || 'AMERICAN POS'}</h1>
                    ${this.businessInfo?.address ? `<p style="${styles.subtitle}">${this.businessInfo.address}</p>` : ''}
                    ${this.businessInfo?.phone ? `<p style="${styles.subtitle}">Tel: ${this.businessInfo.phone}</p>` : ''}
                    ${this.businessInfo?.taxId ? `<p style="${styles.subtitle}">RIF: ${this.businessInfo.taxId}</p>` : ''}
                </div>

                <div style="${styles.info}">
                    <div style="${styles.row}"><span>Fecha:</span> <span>${dateStr}</span></div>
                    <div style="${styles.row}"><span>Orden #:</span> <span>${saleIdShort}</span></div>
                    ${saleData.customer ? `
                        <div style="${styles.divider}"></div>
                        <div style="${styles.row}"><span>Cliente:</span> <span>${saleData.customer.name}</span></div>
                        ${saleData.customer.idDocument ? `<div style="${styles.row}"><span>CI/RIF:</span> <span>${saleData.customer.idDocument}</span></div>` : ''}
                    ` : ''}
                </div>

                <div style="${styles.divider}"></div>
                <div style="margin-bottom: 10px;">
                    <div style="${styles.row}; font-weight: bold; margin-bottom: 8px;">
                        <span>CANT / DESCRIPCION</span>
                        <span>TOTAL</span>
                    </div>
                    ${saleData.items.map(item => `
                        <div style="${styles.itemRow}">
                            <span style="flex: 1;">${item.quantity} x ${item.name}</span>
                            <span>Bs ${(item.price * item.quantity * this.exchangeRate).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>

                <div style="${styles.divider}"></div>
                
                <div style="${styles.totalRow}">
                    <span>TOTAL PAGADO</span>
                    <span>Bs ${(saleData.total * this.exchangeRate).toFixed(2)}</span>
                </div>

                <div style="${styles.divider}"></div>
                
                <div style="margin-bottom: 10px;">
                    <p style="font-weight: bold; font-size: 11px; margin-bottom: 5px;">MÉTODOS DE PAGO:</p>
                    ${(() => {
                const pm = saleData.paymentMethods;
                const pd = saleData.paymentDetails;
                // Robust check: Ensure it is actually an array
                const paymentList = Array.isArray(pm) ? pm : (Array.isArray(pd) ? pd : []);

                if (paymentList.length === 0) return '<p style="font-size:10px;">Detalles de pago no disponibles</p>';

                return paymentList.map(detail => `
                            <div style="${styles.row}">
                                <span>${getMethodName(detail.method)}</span>
                                <span>Bs ${(detail.amount * (detail.currency === 'USD' ? this.exchangeRate : 1)).toFixed(2)}</span>
                            </div>
                        `).join('');
            })()}
                </div>

                <div style="${styles.footer}">
                    <p>¡GRACIAS POR SU COMPRA!</p>
                    <p>Por favor conserve este recibo</p>
                    <p style="margin-top: 5px;">Powered by American POS</p>
                </div>
            </div>
        `;
    }

    filterSales(query) {
        if (!query) {
            this.renderSales(this.sales);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = this.sales.filter(sale => {
            const docMatch = sale.customer?.idDocument?.toLowerCase().includes(lowerQuery);
            const nameMatch = sale.customer?.name?.toLowerCase().includes(lowerQuery);
            const itemMatch = sale.items.some(item => item.name.toLowerCase().includes(lowerQuery));
            const idMatch = sale.id.toLowerCase().includes(lowerQuery);

            return docMatch || nameMatch || itemMatch || idMatch;
        });

        this.renderSales(filtered);
    }
}
