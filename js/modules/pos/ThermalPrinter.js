// ThermalPrinter.js - Intelligent thermal printer module with ESC/POS support
// Supports: USB, Bluetooth, Network | 58mm & 80mm | All ESC/POS compatible printers

import { ui } from '../../ui.js';

export class ThermalPrinter {
    constructor() {
        this.config = {
            enabled: false,
            autoPrint: true,
            connectionType: 'usb', // 'usb', 'bluetooth', 'network'
            paperWidth: 58, // 58 or 80 (mm)
            logo: null, // Base64 image
            businessName: '',
            businessNIF: '',
            businessAddress: '',
            businessPhone: '',
            copies: 1,
            openCashDrawer: false,
            networkIP: '', // For network printers
            networkPort: 9100 // Default ESC/POS port
        };

        this.device = null;
        this.writer = null;
        this.loadConfig();
    }

    // ESC/POS Commands
    ESC = {
        INIT: [0x1B, 0x40], // Initialize printer
        LINE_FEED: [0x0A],
        CUT_PAPER: [0x1D, 0x56, 0x00], // Full cut
        CUT_PAPER_PARTIAL: [0x1D, 0x56, 0x01], // Partial cut

        // Text alignment
        ALIGN_LEFT: [0x1B, 0x61, 0x00],
        ALIGN_CENTER: [0x1B, 0x61, 0x01],
        ALIGN_RIGHT: [0x1B, 0x61, 0x02],

        // Text style
        BOLD_ON: [0x1B, 0x45, 0x01],
        BOLD_OFF: [0x1B, 0x45, 0x00],
        UNDERLINE_ON: [0x1B, 0x2D, 0x01],
        UNDERLINE_OFF: [0x1B, 0x2D, 0x00],

        // Font size
        NORMAL: [0x1D, 0x21, 0x00],
        DOUBLE_HEIGHT: [0x1D, 0x21, 0x01],
        DOUBLE_WIDTH: [0x1D, 0x21, 0x10],
        DOUBLE_BOTH: [0x1D, 0x21, 0x11],

        // Cash drawer
        OPEN_DRAWER: [0x1B, 0x70, 0x00, 0x19, 0xFA]
    };

    loadConfig() {
        const saved = localStorage.getItem('thermal_printer_config');
        if (saved) {
            this.config = { ...this.config, ...JSON.parse(saved) };
        }
    }

    saveConfig() {
        localStorage.setItem('thermal_printer_config', JSON.stringify(this.config));
    }

    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }

    // Connection Methods
    async connectUSB() {
        try {
            if (!navigator.serial) {
                throw new Error('Web Serial API no soportada. Usa Chrome, Edge o Opera.');
            }

            this.device = await navigator.serial.requestPort();
            await this.device.open({ baudRate: 9600 });

            this.writer = this.device.writable.getWriter();

            // Initialize printer
            await this.sendCommand(this.ESC.INIT);

            ui.showNotification('Impresora USB conectada correctamente', 'success');
            return true;
        } catch (error) {
            console.error('Error conectando impresora USB:', error);
            ui.showNotification('Error al conectar impresora USB: ' + error.message, 'error');
            return false;
        }
    }

    async connectBluetooth() {
        try {
            if (!navigator.bluetooth) {
                throw new Error('Bluetooth no soportado en este navegador');
            }

            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            const server = await this.device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            this.writer = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

            ui.showNotification('Impresora Bluetooth conectada', 'success');
            return true;
        } catch (error) {
            console.error('Error conectando Bluetooth:', error);
            ui.showNotification('Error al conectar Bluetooth: ' + error.message, 'error');
            return false;
        }
    }

    async connectNetwork() {
        try {
            const { networkIP, networkPort } = this.config;
            if (!networkIP) {
                throw new Error('Configura la dirección IP de la impresora');
            }

            // Note: Direct TCP connection from browser requires server proxy
            ui.showNotification('Impresora de red configurada. Asegúrate de que el servidor proxy esté activo.', 'info');
            return true;
        } catch (error) {
            console.error('Error con impresora de red:', error);
            ui.showNotification('Error: ' + error.message, 'error');
            return false;
        }
    }

    async connect() {
        const { connectionType } = this.config;

        switch (connectionType) {
            case 'usb':
                return await this.connectUSB();
            case 'bluetooth':
                return await this.connectBluetooth();
            case 'network':
                return await this.connectNetwork();
            default:
                ui.showNotification('Tipo de conexión no válido', 'error');
                return false;
        }
    }

    async disconnect() {
        try {
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
            if (this.device && this.device.close) {
                await this.device.close();
            }
            this.device = null;
            ui.showNotification('Impresora desconectada', 'info');
        } catch (error) {
            console.error('Error al desconectar:', error);
        }
    }

    async sendCommand(command) {
        if (!this.writer) {
            console.warn('No hay impresora conectada');
            return;
        }

        try {
            const data = new Uint8Array(command);

            if (this.config.connectionType === 'usb') {
                await this.writer.write(data);
            } else if (this.config.connectionType === 'bluetooth') {
                await this.writer.writeValue(data);
            }
        } catch (error) {
            console.error('Error enviando comando:', error);
            throw error;
        }
    }

    async printText(text, align = 'left', style = {}) {
        const encoder = new TextEncoder();

        // Set alignment
        if (align === 'center') await this.sendCommand(this.ESC.ALIGN_CENTER);
        else if (align === 'right') await this.sendCommand(this.ESC.ALIGN_RIGHT);
        else await this.sendCommand(this.ESC.ALIGN_LEFT);

        // Set style
        if (style.bold) await this.sendCommand(this.ESC.BOLD_ON);
        if (style.doubleHeight) await this.sendCommand(this.ESC.DOUBLE_HEIGHT);
        if (style.doubleWidth) await this.sendCommand(this.ESC.DOUBLE_WIDTH);
        if (style.doubleBoth) await this.sendCommand(this.ESC.DOUBLE_BOTH);

        // Print text
        await this.sendCommand([...encoder.encode(text)]);

        // Reset style
        if (style.bold) await this.sendCommand(this.ESC.BOLD_OFF);
        await this.sendCommand(this.ESC.NORMAL);
    }

    async printLine(char = '=', length = null) {
        const lineLength = length || (this.config.paperWidth === 58 ? 32 : 48);
        await this.printText(char.repeat(lineLength), 'center');
        await this.sendCommand(this.ESC.LINE_FEED);
    }

    async printLogo() {
        if (!this.config.logo) return;

        // TODO: Implement logo printing (requires image conversion to ESC/POS bitmap)
        // This is a complex feature that requires image processing
        await this.printText('[LOGO]', 'center', { bold: true });
        await this.sendCommand(this.ESC.LINE_FEED);
    }

    async printReceipt(sale) {
        if (!this.config.enabled) {
            console.log('Impresora deshabilitada');
            return;
        }

        try {
            // Auto-connect if not connected
            if (!this.writer && this.config.autoPrint) {
                const connected = await this.connect();
                if (!connected) {
                    throw new Error('No se pudo conectar a la impresora');
                }
            }

            if (!this.writer) {
                throw new Error('Impresora no conectada');
            }

            // Start printing
            await this.sendCommand(this.ESC.INIT);

            // Logo
            if (this.config.logo) {
                await this.printLogo();
            }

            // Business header
            await this.printLine('=');
            if (this.config.businessName) {
                await this.printText(this.config.businessName.toUpperCase(), 'center', { bold: true, doubleBoth: true });
                await this.sendCommand(this.ESC.LINE_FEED);
            }
            if (this.config.businessNIF) {
                await this.printText(`NIF: ${this.config.businessNIF}`, 'center');
                await this.sendCommand(this.ESC.LINE_FEED);
            }
            if (this.config.businessAddress) {
                await this.printText(this.config.businessAddress, 'center');
                await this.sendCommand(this.ESC.LINE_FEED);
            }
            if (this.config.businessPhone) {
                await this.printText(`Tel: ${this.config.businessPhone}`, 'center');
                await this.sendCommand(this.ESC.LINE_FEED);
            }
            await this.printLine('=');

            // Sale info
            const date = new Date(sale.timestamp || Date.now());
            await this.printText(`Fecha: ${date.toLocaleDateString('es-VE')} ${date.toLocaleTimeString('es-VE')}`, 'left');
            await this.sendCommand(this.ESC.LINE_FEED);

            if (sale.customerId) {
                await this.printText(`Cliente: ${sale.customer?.name || 'N/A'}`, 'left');
                await this.sendCommand(this.ESC.LINE_FEED);
            }

            await this.printText(`Ticket #${sale.id || 'N/A'}`, 'left');
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.printLine('-');

            // Items
            await this.printText('PRODUCTO', 'left', { bold: true });
            await this.printText('CANT   SUBTOTAL', 'right', { bold: true });
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.printLine('-');

            for (const item of sale.items) {
                const name = item.name.substring(0, this.config.paperWidth === 58 ? 20 : 30);
                const qty = `${item.quantity}x`;
                const subtotal = `$${(item.price * item.quantity).toFixed(2)}`;

                await this.printText(name, 'left');
                await this.sendCommand(this.ESC.LINE_FEED);
                await this.printText(`  ${qty.padEnd(6)}${subtotal.padStart(12)}`, 'left');
                await this.sendCommand(this.ESC.LINE_FEED);
            }

            await this.printLine('-');

            // Total
            const bsTotal = sale.total * (sale.exchangeRate || 40);
            await this.printText(`TOTAL USD:`, 'left', { bold: true });
            await this.printText(`$${sale.total.toFixed(2)}`, 'right', { bold: true, doubleHeight: true });
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.printText(`TOTAL BS:`, 'left', { bold: true });
            await this.printText(`Bs ${bsTotal.toFixed(2)}`, 'right', { bold: true, doubleHeight: true });
            await this.sendCommand(this.ESC.LINE_FEED);

            await this.printLine('=');

            // Payment method
            await this.printText('METODO DE PAGO', 'center', { bold: true });
            await this.sendCommand(this.ESC.LINE_FEED);

            if (sale.paymentMethods && sale.paymentMethods.length > 0) {
                for (const pm of sale.paymentMethods) {
                    const method = pm.method.replace('_', ' ').toUpperCase();
                    const amount = pm.currency === 'USD' ? `$${pm.amount.toFixed(2)}` : `Bs ${pm.amount.toFixed(2)}`;
                    await this.printText(`${method}:`.padEnd(20) + amount.padStart(12), 'left');
                    await this.sendCommand(this.ESC.LINE_FEED);
                }
            }

            await this.printLine('=');

            // Footer
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.printText('¡GRACIAS POR SU COMPRA!', 'center', { bold: true });
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.printText('www.american-pos.com', 'center');
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.printLine('=');

            // Cut paper
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.sendCommand(this.ESC.LINE_FEED);
            await this.sendCommand(this.ESC.CUT_PAPER);

            // Open cash drawer if configured
            if (this.config.openCashDrawer) {
                await this.sendCommand(this.ESC.OPEN_DRAWER);
            }

            ui.showNotification('Recibo impreso correctamente', 'success');

        } catch (error) {
            console.error('Error imprimiendo recibo:', error);
            ui.showNotification('Error al imprimir: ' + error.message, 'error');
        }
    }

    async printTestReceipt() {
        const testSale = {
            id: 'TEST-001',
            timestamp: new Date().toISOString(),
            items: [
                { name: 'Producto de Prueba 1', quantity: 2, price: 5.50 },
                { name: 'Producto de Prueba 2', quantity: 1, price: 12.00 }
            ],
            total: 23.00,
            exchangeRate: 40,
            paymentMethods: [
                { method: 'cash_usd', amount: 23.00, currency: 'USD' }
            ]
        };

        await this.printReceipt(testSale);
    }
}

// Export singleton instance
export const thermalPrinter = new ThermalPrinter();
