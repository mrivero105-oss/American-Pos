import { API_BASE_URL } from './config.js';

export const authService = {
    // Login with email and password
    login: async (email, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error de autenticación');
            }

            if (data.success && data.token) {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                return { success: true, user: data.user };
            } else {
                return { success: false, error: 'Respuesta inválida del servidor' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    },

    // Logout
    logout: async () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    },

    // Reset Password (Not implemented in D1 yet)
    resetPassword: async (email) => {
        return { success: false, error: "Contacte al administrador para restablecer su contraseña." };
    },

    // Get current auth token
    getToken: async () => {
        return localStorage.getItem('authToken');
    },

    // Check if user is authenticated
    isAuthenticated: () => {
        return !!localStorage.getItem('authToken');
    },

    // Listen to auth state changes (Simulated for compatibility)
    onAuthChange: (callback) => {
        const token = localStorage.getItem('authToken');
        const user = JSON.parse(localStorage.getItem('user') || 'null');

        if (token && user) {
            callback(user);
        } else {
            callback(null);
        }

        // Return unsubscribe function (no-op)
        return () => { };
    }
};
