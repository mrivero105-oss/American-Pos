// API Configuration
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.');
export const API_BASE_URL = isLocal ? `http://${window.location.hostname}:3000` : 'https://american-pos-backend.pages.dev';
