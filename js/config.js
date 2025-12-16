// API Configuration
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.');
export const API_BASE_URL = isLocal ? `http://${window.location.hostname}:3000` : 'https://american-pos-backend.pages.dev';

// Image Base URL - for serving product images
export const IMAGE_BASE_URL = isLocal ? 'http://localhost:3000' : 'https://american-pos.pages.dev';

// Helper function to get the correct image URL
export function getImageUrl(imageUri) {
    // Inline SVG placeholder that works offline
    const NO_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect fill='%23e2e8f0' width='150' height='150'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%2364748b'%3ESin imagen%3C/text%3E%3C/svg%3E";
    if (!imageUri) return NO_IMAGE_PLACEHOLDER;

    // Si ya es una URL completa externa (producción)
    if (imageUri.startsWith('http')) {
        // En local, convertir a URL local
        if (isLocal) {
            const filename = imageUri.split('/').pop();
            return `${IMAGE_BASE_URL}/product_images/${filename}`;
        }
        return imageUri;
    }

    // Si es path relativo
    return `${IMAGE_BASE_URL}${imageUri}`;
}
