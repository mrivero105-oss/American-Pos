// API Configuration
const isBackendHost = window.location.hostname.includes('onrender.com') || window.location.port === '3000';
export const API_BASE_URL = isBackendHost ? '' : 'https://american-pos-backend.pages.dev';
