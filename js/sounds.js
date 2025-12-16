// Sound Effects Module
// Uses Web Audio API for instant, lightweight sounds

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.enabled = localStorage.getItem('sounds_enabled') !== 'false'; // Default ON
    }

    getContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    // Short beep for adding items
    beep(frequency = 800, duration = 0.08) {
        if (!this.enabled) return;
        try {
            const ctx = this.getContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('Sound error:', e);
        }
    }

    // Success sound (two-tone chime)
    success() {
        if (!this.enabled) return;
        this.beep(523, 0.1); // C5
        setTimeout(() => this.beep(659, 0.15), 100); // E5
    }

    // Warning sound
    warning() {
        if (!this.enabled) return;
        this.beep(300, 0.15);
    }

    // Error sound
    error() {
        if (!this.enabled) return;
        this.beep(200, 0.2);
        setTimeout(() => this.beep(200, 0.2), 150);
    }

    // Toggle sounds
    toggle(enabled) {
        this.enabled = enabled;
        localStorage.setItem('sounds_enabled', enabled);
    }
}

export const sounds = new SoundManager();
