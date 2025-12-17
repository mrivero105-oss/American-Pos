import { API_BASE_URL } from './config.js';

// Helper function to get auth headers
async function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
}

// Helper function to handle auth errors
function handleAuthError(response) {
    if (response.status === 401) {
        // Dispatch event so UI can show Re-Login Modal
        window.dispatchEvent(new CustomEvent('session-expired'));
        throw new Error('Unauthorized');
    }
}
// Helper for fetch with timeout
async function fetchWithTimeout(url, options = {}) {
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout}ms`);
        }
        throw error;
    }
}

export const api = {
    // Generic POST helper
    post: async (endpoint, data) => {
        const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify(data)
        });
        handleAuthError(response);
        if (!response.ok) throw new Error('API Error');
        return await response.json();
    },

    refunds: {
        create: async (data) => {
            return api.post('/refunds', data);
        }
    },

    products: {
        getAll: async (page = null, limit = null, category = null, search = null) => {
            // Add timestamp to prevent browser caching
            const params = new URLSearchParams();
            params.append('_t', Date.now());

            if (page) params.append('page', page);
            if (limit) params.append('limit', limit);
            if (category && category !== 'Todas') params.append('category', category);
            if (search) params.append('search', search);

            const url = `${API_BASE_URL}/products?${params.toString()}`;
            console.log('DEBUG API URL:', url);

            const response = await fetchWithTimeout(url, {
                headers: await getAuthHeaders(),
                cache: 'no-store' // Explicitly request no cache
            });
            handleAuthError(response);
            if (!response.ok) throw new Error(`Error fetching products: ${response.status} ${response.statusText}`);
            return response.json();
        },

        getCategories: async () => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/products/categories`, {
                headers: await getAuthHeaders(),
                cache: 'no-store'
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error fetching categories');
            return response.json();
        },

        create: async (product) => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(product)
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error creating product');
            return response.json();
        },
        update: async (id, product) => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify(product)
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error updating product');
            return response.json();
        },
        delete: async (id) => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/products/${id}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error deleting product');
            return response.json();
        }
    },
    sales: {
        create: async (saleData) => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/sales`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(saleData)
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error creating sale');
            return response.json();
        },
        getAll: async (date = null) => {
            let url = `${API_BASE_URL}/sales`;
            if (date) url += `?date=${date}`;
            const response = await fetchWithTimeout(url, {
                headers: await getAuthHeaders()
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error fetching sales');
            return response.json();
        },
        emailReceipt: async (saleId, email, receiptHtml) => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/sales/${saleId}/email`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ email, receiptHtml })
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error sending email');
            return response.json();
        }
    },
    dashboard: {
        getSummary: async (date = null) => {
            let url = `${API_BASE_URL}/dashboard-summary`;
            if (date) url += `?date=${date}`;
            const response = await fetchWithTimeout(url, {
                headers: await getAuthHeaders()
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error fetching dashboard summary');
            return response.json();
        }
    },
    settings: {
        getRate: async () => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/settings/rate`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error fetching rate');
            return response.json();
        },
        updateRate: async (rate) => {
            const response = await fetchWithTimeout(`${API_BASE_URL}/settings/rate`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ rate })
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Error updating rate');
            return response.json();
        },
        getBusinessInfo: async () => {
            const headers = await getAuthHeaders();
            const response = await fetchWithTimeout(`${API_BASE_URL}/settings/business`, { headers });
            handleAuthError(response);
            if (!response.ok) throw new Error('Failed to fetch business info');
            return response.json();
        },
        updateBusinessInfo: async (info) => {
            const headers = await getAuthHeaders();
            const response = await fetchWithTimeout(`${API_BASE_URL}/settings/business`, {
                method: 'POST',
                headers,
                body: JSON.stringify(info)
            });
            handleAuthError(response);
            if (!response.ok) throw new Error('Failed to update business info');
            return response.json();
        },
        getPaymentMethods: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/settings/payment-methods`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener métodos de pago');
            return res.json();
        },
        updatePaymentMethods: async (paymentMethods) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/settings/payment-methods`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ paymentMethods })
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al actualizar métodos de pago');
            return res.json();
        }
    },
    backup: {
        download: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/backup`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error downloading backup');
            return res.json();
        },
        restore: async (backupData) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/backup`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(backupData)
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error restoring backup');
            return res.json();
        },
        history: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/backup/history`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error fetching backup history');
            return res.json();
        }
    },
    customers: {
        getAll: async (page = 1, limit = 0, search = '') => { // Default to 0 (all) for backwards compatibility if not used
            let url = `${API_BASE_URL}/customers`;
            const params = new URLSearchParams();
            if (page) params.append('page', page);
            if (limit) params.append('limit', limit);
            if (search) params.append('search', search);

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const res = await fetchWithTimeout(url, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener clientes');
            return res.json();
        },
        getById: async (id) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/customers/${id}`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener cliente');
            return res.json();
        },
        create: async (customerData) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/customers`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(customerData)
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al crear cliente');
            return res.json();
        },
        update: async (id, customerData) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/customers/${id}`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify(customerData)
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al actualizar cliente');
            return res.json();
        },
        delete: async (id) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/customers/${id}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al borrar cliente');
            return res.json();
        },
        getSales: async (id) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/customers/${id}/sales`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener ventas del cliente');
            return res.json();
        },
        // Credit system methods
        getCreditHistory: async (id) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/customers/${id}/credit-history`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener historial de crédito');
            return res.json();
        },
        registerCreditPayment: async (id, amount, description = '', paymentMethod = 'cash') => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/customers/${id}/credit-payment`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ amount, description, paymentMethod })
            });
            handleAuthError(res);
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Error al registrar abono');
            }
            return res.json();
        },
        getDelinquentCustomers: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/reports/delinquent-customers`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener clientes morosos');
            return res.json();
        }
    },
    users: {
        getAll: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/users`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error loading users');
            return res.json();
        },
        create: async (data) => {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error creating user');
            }
            return res.json();
        },
        delete: async (id) => {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error deleting user');
            }
            return res.json();
        },
        update: async (id, data) => {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error updating user');
            }
            return res.json();
        }
    },
    suppliers: {
        getAll: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/suppliers`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener proveedores');
            return res.json();
        },
        create: async (data) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/suppliers`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(data)
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al crear proveedor');
            return res.json();
        },
        update: async (id, data) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/suppliers/${id}`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify(data)
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al actualizar proveedor');
            return res.json();
        },
        delete: async (id) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/suppliers/${id}`, {
                method: 'DELETE',
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al eliminar proveedor');
            return res.json();
        }
    },
    purchaseOrders: {
        getAll: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/purchase-orders`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener órdenes');
            return res.json();
        },
        create: async (data) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/purchase-orders`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify(data)
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al crear orden');
            return res.json();
        },
        update: async (id, data) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/purchase-orders/${id}`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify(data)
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al actualizar orden');
            return res.json();
        },
        receive: async (id) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/purchase-orders/${id}/receive`, {
                method: 'POST',
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Error al recibir orden');
            }
            return res.json();
        },
        cancel: async (id) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/purchase-orders/${id}/cancel`, {
                method: 'POST',
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            return res.json();
        }
    },
    cash: {
        getCurrentShift: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/cash/current`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            // 404 or null means no open shift, but our backend returns null with 200 if no shift
            if (!res.ok) throw new Error('Error al obtener turno actual');
            return res.json();
        },
        openShift: async (amount, userId) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/cash/open`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ amount, userId })
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al abrir caja');
            return res.json();
        },
        closeShift: async (actualCash) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/cash/close`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ actualCash })
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al cerrar caja');
            return res.json();
        },
        addMovement: async (type, amount, reason) => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/cash/movement`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({ type, amount, reason })
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al registrar movimiento');
            return res.json();
        },
        getDailyReport: async (date) => {
            let url = `${API_BASE_URL}/reports/daily`;
            if (date) url += `?date=${date}`;
            const res = await fetchWithTimeout(url, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener reporte diario');
            return res.json();
        },
        getXReport: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/cash/x-report`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener corte X');
            return res.json();
        },
        getHistory: async () => {
            const res = await fetchWithTimeout(`${API_BASE_URL}/cash/history`, {
                headers: await getAuthHeaders()
            });
            handleAuthError(res);
            if (!res.ok) throw new Error('Error al obtener historial');
            return res.json();
        }
    },
    dashboard: {
        getSummary: async () => {
            // Client-side calculation to avoid backend dependency for now
            try {
                const products = await api.products.getAll();
                const lowStockItems = products.filter(p => {
                    const stock = parseFloat(p.stock || 0);
                    const minStock = parseFloat(p.min_stock || 0); // Assuming min_stock field exists
                    return stock <= minStock && p.track_inventory;
                });
                return { lowStockItems };
            } catch (error) {
                console.warn('Error calculating dashboard summary:', error);
                return { lowStockItems: [] };
            }
        }
    }
};
