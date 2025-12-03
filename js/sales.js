import { api } from './api.js';
import { formatCurrency, formatDate } from './utils.js';
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

        if (sales.length === 0) {
            this.dom.salesTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No se encontraron ventas.</td></tr>';
            return;
        }

        this.dom.salesTableBody.innerHTML = sales.map(sale => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" data-id="${sale.id || ''}">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formatDate(sale.timestamp.toDate ? sale.timestamp.toDate() : sale.timestamp)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${(sale.id || '-----').slice(0, 8)}...
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-slate-900 dark:text-white">${sale.customer?.name || 'Cliente Casual'}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">${sale.customer?.idDocument || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${sale.items.length} items
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">
                    ${formatCurrency(sale.total)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-id="${sale.id}" class="view-receipt-btn text-slate-400 dark:text-slate-300 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50" title="Ver Recibo">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    showDetails(sale) {
        if (!this.dom.modalContent) return;
        this.dom.modalContent.innerHTML = this.generateReceiptHtml(sale);
        ui.toggleModal('sale-details-modal', true);
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
                    ${saleData.paymentDetails ? saleData.paymentDetails.map(detail => `
                        <div style="${styles.row}">
                            <span>${getMethodName(detail.method)}</span>
                            <span>Bs ${(detail.amount * (detail.currency === 'USD' ? this.exchangeRate : 1)).toFixed(2)}</span>
                        </div>
                    `).join('') : '<p style="font-size:10px;">Detalles de pago no disponibles</p>'}
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
