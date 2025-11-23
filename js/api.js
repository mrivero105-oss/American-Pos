const API_BASE_URL = 'https://american-pos-backend.onrender.com';

export const api = {
    products: {
        getAll: async () => {
            const response = await fetch(`${API_BASE_URL}/products`);
            if (!response.ok) throw new Error('Error fetching products');
            return response.json();
        },
        create: async (product) => {
            const response = await fetch(`${API_BASE_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            if (!response.ok) throw new Error('Error creating product');
            return response.json();
        },
        update: async (id, product) => {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            if (!response.ok) throw new Error('Error updating product');
            return response.json();
        },
        delete: async (id) => {
            const response = await fetch(`${API_BASE_URL}/products/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Error deleting product');
            return response.json();
        }
    },
    sales: {
        create: async (saleData) => {
            const response = await fetch(`${API_BASE_URL}/sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saleData)
            });
            if (!response.ok) throw new Error('Error creating sale');
            return response.json();
        },
        getAll: async (date = null) => {
            let url = `${API_BASE_URL}/sales`;
            if (date) url += `?date=${date}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error fetching sales');
            return response.json();
        },
        emailReceipt: async (saleId, email) => {
            const response = await fetch(`${API_BASE_URL}/sales/${saleId}/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (!response.ok) throw new Error('Error sending email');
            return response.json();
        }
    },
    dashboard: {
        getSummary: async (date = null) => {
            let url = `${API_BASE_URL}/dashboard-summary`;
            if (date) url += `?date=${date}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error fetching dashboard summary');
            return response.json();
        }
    },
    settings: {
        getRate: async () => {
            const response = await fetch(`${API_BASE_URL}/settings/rate`);
            if (!response.ok) throw new Error('Error fetching rate');
            return response.json();
        },
        updateRate: async (rate) => {
            const response = await fetch(`${API_BASE_URL}/settings/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rate })
            });
            if (!response.ok) throw new Error('Error updating rate');
            return response.json();
        }
    },
    customers: {
        getAll: async () => {
            const res = await fetch(`${API_BASE_URL}/customers`);
            if (!res.ok) throw new Error('Error al obtener clientes');
            return res.json();
        },
        getById: async (id) => {
            const res = await fetch(`${API_BASE_URL}/customers/${id}`);
            if (!res.ok) throw new Error('Error al obtener cliente');
            return res.json();
        },
        create: async (customerData) => {
            const res = await fetch(`${API_BASE_URL}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });
            if (!res.ok) throw new Error('Error al crear cliente');
            return res.json();
        },
        update: async (id, customerData) => {
            const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData)
            });
            if (!res.ok) throw new Error('Error al actualizar cliente');
            return res.json();
        },
        delete: async (id) => {
            const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Error al borrar cliente');
            return res.json();
        },
        getSales: async (id) => {
            const res = await fetch(`${API_BASE_URL}/customers/${id}/sales`);
            if (!res.ok) throw new Error('Error al obtener ventas del cliente');
            return res.json();
        }
    }
};
