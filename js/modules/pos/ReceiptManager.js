import { api } from '../../api.js';
import { ui } from '../../ui.js';

export class ReceiptManager {
    constructor(pos) {
        this.pos = pos;
    }

    showReceipt(saleData) {
        console.log('POS: Showing receipt for sale:', saleData);
        this.pos.lastSale = saleData;
        if (this.pos.dom.paymentModal) this.pos.dom.paymentModal.classList.remove('hidden');
        if (this.pos.dom.paymentFormContent) this.pos.dom.paymentFormContent.classList.add('hidden');
        if (this.pos.dom.receiptModalContent) this.pos.dom.receiptModalContent.classList.remove('hidden');

        if (this.pos.dom.receiptContent) {
            this.pos.dom.receiptContent.innerHTML = this.generateReceiptHtml(saleData);
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

        const dateStr = saleData.date ? new Date(saleData.date).toLocaleString('es-VE') : new Date().toLocaleString('es-VE');
        const saleIdShort = saleData.id ? saleData.id.slice(0, 8).toUpperCase() : 'N/A';

        // Helper to get method name
        const getMethodName = (id) => {
            const method = this.pos.paymentMethods.find(m => m.id === id);
            return method ? method.name : (id === 'cash' ? 'Efectivo' : id);
        };

        return `
            <div style="${styles.container}">
                <div style="${styles.header}">
                    ${this.pos.businessInfo?.logoUrl ? `<img src="${this.pos.businessInfo.logoUrl}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />` : ''}
                    <h1 style="${styles.title}">${this.pos.businessInfo?.name || 'AMERICAN POS'}</h1>
                    ${this.pos.businessInfo?.address ? `<p style="${styles.subtitle}">${this.pos.businessInfo.address}</p>` : ''}
                    ${this.pos.businessInfo?.phone ? `<p style="${styles.subtitle}">Tel: ${this.pos.businessInfo.phone}</p>` : ''}
                    ${this.pos.businessInfo?.taxId ? `<p style="${styles.subtitle}">RIF: ${this.pos.businessInfo.taxId}</p>` : ''}
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
                    ${(saleData.items || []).map(item => `
                        <div style="${styles.itemRow}">
                            <span style="flex: 1;">${item.quantity} x ${item.name}</span>
                            <span>Bs ${(item.price * item.quantity * this.pos.exchangeRate).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>

                <div style="${styles.divider}"></div>
                
                <div style="${styles.totalRow}">
                    <span>TOTAL PAGADO</span>
                    <span>Bs ${(saleData.total * this.pos.exchangeRate).toFixed(2)}</span>
                </div>

                <div style="${styles.divider}"></div>
                
                <div style="margin-bottom: 10px;">
                    <p style="font-weight: bold; font-size: 11px; margin-bottom: 5px;">MÉTODOS DE PAGO:</p>
                    ${(saleData.paymentDetails || []).map(detail => `
                        <div style="${styles.row}">
                            <span>${getMethodName(detail.method)}</span>
                            <span>Bs ${(detail.amount * (detail.currency === 'USD' ? this.pos.exchangeRate : 1)).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>

                <div style="${styles.footer}">
                    <p>¡GRACIAS POR SU COMPRA!</p>
                    <p>Por favor conserve este recibo</p>
                    <p style="margin-top: 5px;">Powered by American POS</p>
                </div>
            </div>
        `;
    }

    hideReceipt() {
        this.pos.checkoutManager.hidePaymentModal();
        // Reset modal state for next time
        if (this.pos.dom.paymentFormContent) this.pos.dom.paymentFormContent.classList.remove('hidden');
        if (this.pos.dom.receiptModalContent) this.pos.dom.receiptModalContent.classList.add('hidden');
    }

    async emailReceipt() {
        if (!this.pos.lastSale) return;

        let email = this.pos.lastSale.customer?.email;

        if (!email) {
            this.showEmailInputModal((enteredEmail) => {
                if (enteredEmail) {
                    this.sendEmailInBackground(enteredEmail);
                }
            });
        } else {
            this.sendEmailInBackground(email);
        }
    }

    sendEmailInBackground(email) {
        ui.showNotification('Enviando recibo en segundo plano...', 'info');
        const html = this.generateReceiptHtml(this.pos.lastSale);

        // Fire and forget (but handle errors)
        api.sales.emailReceipt(this.pos.lastSale.id, email, html)
            .then(() => {
                ui.showNotification(`Recibo enviado a ${email}`, 'success');
                this.hideReceipt(); // Close modal on success
            })
            .catch(error => {
                console.error('Error sending email:', error);
                ui.showNotification('Error al enviar correo: ' + error.message, 'error');
            });
    }

    showEmailInputModal(callback) {
        const modal = document.getElementById('email-input-modal');
        const input = document.getElementById('email-input-field');
        const confirmBtn = document.getElementById('confirm-email-btn');
        const cancelBtn = document.getElementById('cancel-email-btn');

        if (!modal || !input || !confirmBtn || !cancelBtn) {
            console.error('Email modal elements not found');
            return;
        }

        input.value = '';
        modal.classList.remove('hidden');
        input.focus();

        const close = () => {
            modal.classList.add('hidden');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            input.onkeydown = null;
        };

        const confirm = () => {
            const email = input.value.trim();
            if (email && email.includes('@')) {
                close();
                callback(email);
            } else {
                ui.showNotification('Por favor ingrese un correo válido', 'warning');
                input.focus();
            }
        };

        confirmBtn.onclick = confirm;
        cancelBtn.onclick = close;

        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') close();
        };
    }

    printReceipt() {
        // Create a hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        // Get the receipt HTML
        const receiptHtml = this.pos.dom.receiptContent.innerHTML;

        doc.open();
        doc.write(`
            <html>
                <head>
                    <title>Recibo de Venta</title>
                    <style>
                        body { margin: 0; padding: 0; background-color: white; }
                        @media print {
                            @page { margin: 0; size: auto; }
                            body { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    ${receiptHtml}
                    <script>
                        window.onload = function() {
                            window.print();
                            // Optional: Close/remove iframe after printing is initiated
                            // We use a timeout in the parent to remove the iframe
                        }
                    </script>
                </body>
            </html>
        `);
        doc.close();

        // Remove the iframe after a delay to ensure print dialog has opened
        setTimeout(() => {
            document.body.removeChild(iframe);
            this.hideReceipt(); // Close modal after printing initiated
        }, 1000);
    }
}
