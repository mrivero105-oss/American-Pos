import { ui } from '../../ui.js';

export class Scanner {
    constructor(pos) {
        this.pos = pos;
        this.html5QrCode = null;
        this.lastScanTime = 0;
    }

    startScanner() {
        if (this.html5QrCode) return;

        const modal = document.getElementById('pos-scanner-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }

        this.html5QrCode = new Html5Qrcode("pos-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        this.html5QrCode.start({ facingMode: "environment" }, config, (decodedText, decodedResult) => {
            console.log(`Code matched = ${decodedText}`, decodedResult);
            this.handleScan(decodedText);
            // Optional: Beep sound
            const audio = new Audio('assets/beep.mp3'); // Ensure this exists or remove
            audio.play().catch(e => console.log('Audio play failed', e));

            // Close scanner after successful scan? Or keep open for multiple?
            // Let's keep it open but debounce
        }, (errorMessage) => {
            // parse error, ignore it.
        }).catch(err => {
            console.error(`Unable to start scanning, error: ${err}`);
            ui.showNotification('Error al iniciar cámara', 'error');
        });
    }

    async stopScanner() {
        if (this.html5QrCode) {
            try {
                await this.html5QrCode.stop();
                this.html5QrCode = null;
            } catch (err) {
                console.error('Failed to stop scanner', err);
            }
        }
        const modal = document.getElementById('pos-scanner-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    handleScan(barcode) {
        const now = Date.now();
        if (now - this.lastScanTime < 3000) {
            return; // Ignore repetitive scans (3 seconds delay)
        }
        this.lastScanTime = now;

        const product = this.pos.products.find(p => p.barcode === barcode);

        if (product) {
            this.pos.cartManager.addToCart(product);
            const feedback = document.getElementById('scan-feedback');
            if (feedback) {
                feedback.classList.remove('opacity-0');
                setTimeout(() => feedback.classList.add('opacity-0'), 1500);
            }
        } else {
            ui.showNotification(`Producto no encontrado: ${barcode}`, 'warning');
        }
    }
}
