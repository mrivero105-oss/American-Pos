import { api } from './api.js';
import { formatCurrency, formatBs } from './utils.js';
import { ui } from './ui.js';

export class Dashboard {
    constructor() {
        this.charts = {
            trend: null,
            topProducts: null,
            paymentMethods: null
        };
        this.currentRange = 'day'; // hour, day, week, month
        this.salesData = [];
        this.currentExchangeRate = 1;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
    }

    cacheDOM() {
        this.dom = {
            totalRevenue: document.getElementById('total-revenue'),
            totalSales: document.getElementById('total-sales'),
            avgTicket: document.getElementById('avg-ticket'),
            lowStockList: document.getElementById('low-stock-list'),
            trendCanvas: document.getElementById('sales-trend-chart'),
            topProductsCanvas: document.getElementById('top-products-chart'),
            paymentMethodsCanvas: document.getElementById('payment-methods-chart'),
            categoryCanvas: document.getElementById('category-sales-chart'),
            exportBtn: document.getElementById('export-report-btn'),
            filterBtns: document.querySelectorAll('.dashboard-filter-btn')
        };
    }

    bindEvents() {
        this.dom.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.target.dataset.range;
                this.setRange(range);
            });
        });

        if (this.dom.exportBtn) {
            this.dom.exportBtn.addEventListener('click', () => this.exportToExcel());
        }

        // Listen for theme changes to update charts
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    this.updateChartsTheme();
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
    }

    setRange(range) {
        this.currentRange = range;

        // Update buttons UI
        this.dom.filterBtns.forEach(btn => {
            if (btn.dataset.range === range) {
                btn.className = 'dashboard-filter-btn px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-slate-900 text-white dark:bg-blue-600';
            } else {
                btn.className = 'dashboard-filter-btn px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700';
            }
        });

        this.processAndRender();
    }

    async loadData() {
        try {
            // Fetch business info for exchange rate
            const businessInfo = await api.settings.getBusinessInfo();
            this.currentExchangeRate = businessInfo.exchangeRate || 1;

            // Fetch all sales for client-side processing
            const sales = await api.sales.getAll();
            this.salesData = sales;

            // Also get low stock items
            const summary = await api.dashboard.getSummary();
            this.renderLowStock(summary.lowStockItems);

            this.processAndRender();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            ui.showNotification('Error loading dashboard data', 'error');
        }
    }

    renderLowStock(items) {
        if (!this.dom.lowStockList) return;

        if (items.length === 0) {
            this.dom.lowStockList.innerHTML = '<p class="text-gray-500 dark:text-gray-300 text-center py-4">Todo el inventario está bien.</p>';
            return;
        }

        this.dom.lowStockList.innerHTML = items.map(item => `
            <li class="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
                <span class="font-medium text-gray-800 dark:text-gray-200">${item.name}</span>
                <span class="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-bold px-2 py-1 rounded-full">${item.stock} restan</span>
            </li>
        `).join('');
    }

    getSaleAmountBs(sale) {
        // Use stored exchange rate if available, otherwise current
        const rate = sale.exchangeRate || this.currentExchangeRate;
        return sale.total * rate;
    }

    processAndRender() {
        if (!this.salesData) return;

        const now = new Date();
        let filteredSales = [];
        let labels = [];
        let trendData = [];

        // 1. Filter Data based on Range
        switch (this.currentRange) {
            case 'hour': // Today, grouped by hour
                filteredSales = this.salesData.filter(s => {
                    const d = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                    return d.toDateString() === now.toDateString();
                });
                // Generate labels 00:00 - 23:00
                for (let i = 0; i < 24; i++) {
                    labels.push(`${i}:00`);
                    trendData.push(0);
                }
                filteredSales.forEach(s => {
                    const d = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                    const hour = d.getHours();
                    trendData[hour] += this.getSaleAmountBs(s);
                });
                break;

            case 'day': // This Week (Last 7 days), grouped by day
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(now.getDate() - 6);
                sevenDaysAgo.setHours(0, 0, 0, 0);

                filteredSales = this.salesData.filter(s => {
                    const d = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                    return d >= sevenDaysAgo;
                });

                for (let i = 0; i < 7; i++) {
                    const d = new Date(sevenDaysAgo);
                    d.setDate(d.getDate() + i);
                    const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
                    labels.push(dayName);

                    const dayTotal = filteredSales
                        .filter(s => {
                            const sd = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                            return sd.toDateString() === d.toDateString();
                        })
                        .reduce((sum, s) => sum + this.getSaleAmountBs(s), 0);
                    trendData.push(dayTotal);
                }
                break;

            case 'week': // This Month, grouped by week
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                filteredSales = this.salesData.filter(s => {
                    const d = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                    return d >= startOfMonth;
                });

                // Simple 4 weeks approximation
                labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
                trendData = [0, 0, 0, 0, 0];

                filteredSales.forEach(s => {
                    const d = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                    const week = Math.floor((d.getDate() - 1) / 7);
                    if (week < 5) trendData[week] += this.getSaleAmountBs(s);
                });
                break;

            case 'month': // This Year, grouped by month
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                filteredSales = this.salesData.filter(s => {
                    const d = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                    return d >= startOfYear;
                });

                const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                labels = monthNames;
                trendData = new Array(12).fill(0);

                filteredSales.forEach(s => {
                    const d = s.timestamp.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                    trendData[d.getMonth()] += this.getSaleAmountBs(s);
                });
                break;
        }

        // 2. Calculate Stats
        const totalRevenue = filteredSales.reduce((sum, s) => sum + this.getSaleAmountBs(s), 0);
        const totalSalesCount = filteredSales.length;
        const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

        if (this.dom.totalRevenue) this.dom.totalRevenue.textContent = formatBs(totalRevenue);
        if (this.dom.totalSales) this.dom.totalSales.textContent = totalSalesCount;
        if (this.dom.avgTicket) this.dom.avgTicket.textContent = formatBs(avgTicket);

        // 3. Top Products
        const productMap = {};
        filteredSales.forEach(s => {
            s.items.forEach(item => {
                if (!productMap[item.name]) productMap[item.name] = 0;
                productMap[item.name] += item.quantity;
            });
        });
        const sortedProducts = Object.entries(productMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5

        // 4. Payment Methods
        const paymentMap = {};
        filteredSales.forEach(s => {
            const method = s.paymentMethod || 'cash'; // Default to cash if missing
            if (!paymentMap[method]) paymentMap[method] = 0;
            paymentMap[method] += this.getSaleAmountBs(s);
        });

        // 5. Categories (Client-side aggregation for now)
        const categoryMap = {};
        filteredSales.forEach(s => {
            const rate = s.exchangeRate || this.currentExchangeRate;
            s.items.forEach(item => {
                // We need to look up category from products list if not in item
                // Assuming item has category or we default to 'Otros'
                const cat = item.category || 'Otros';
                if (!categoryMap[cat]) categoryMap[cat] = 0;
                categoryMap[cat] += (item.price * item.quantity * rate);
            });
        });
        const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

        // Map method IDs to readable names (simplified)
        const methodLabels = Object.keys(paymentMap).map(k => {
            if (k === 'cash') return 'Efectivo';
            if (k === 'debit') return 'Débito';
            if (k === 'pago_movil') return 'Pago Móvil';
            if (k === 'zelle') return 'Zelle';
            return k.charAt(0).toUpperCase() + k.slice(1);
        });
        const methodData = Object.values(paymentMap);

        // Render Charts
        this.renderTrendChart(labels, trendData);
        this.renderTopProductsChart(sortedProducts.map(p => p[0]), sortedProducts.map(p => p[1]));
        this.renderPaymentMethodsChart(methodLabels, methodData);
        this.renderCategoryChart(sortedCategories.map(c => c[0]), sortedCategories.map(c => c[1]));
    }

    renderCategoryChart(labels, data) {
        if (!this.dom.categoryCanvas) return;

        const existingChart = Chart.getChart(this.dom.categoryCanvas);
        if (existingChart) existingChart.destroy();

        const ctx = this.dom.categoryCanvas.getContext('2d');
        const colors = this.getThemeColors();

        this.charts.category = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: colors.textColor,
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const total = context.chart._metasets[context.datasetIndex].total;
                                const percentage = ((value / total) * 100).toFixed(1) + '%';
                                return `${context.label}: ${formatBs(value)} (${percentage})`;
                            }
                        }
                    }
                }
            }
        });
    }

    exportToExcel() {
        if (!this.salesData || this.salesData.length === 0) {
            ui.showNotification('No hay datos para exportar', 'warning');
            return;
        }

        // Prepare data for Excel
        const data = this.salesData.map(s => ({
            ID: s.id,
            Fecha: new Date(s.timestamp).toLocaleString(),
            Cliente: s.customer ? s.customer.name : 'Casual',
            Documento: s.customer ? s.customer.idDocument : '',
            TotalBs: this.getSaleAmountBs(s),
            TotalUSD: s.total,
            Tasa: s.exchangeRate || this.currentExchangeRate,
            MetodoPago: s.paymentMethod,
            Items: s.items.map(i => `${i.quantity}x ${i.name}`).join(', ')
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");

        XLSX.writeFile(wb, `Reporte_Ventas_${new Date().toISOString().split('T')[0]}.xlsx`);
        ui.showNotification('Reporte exportado exitosamente');
    }

    getThemeColors() {
        const isDark = document.documentElement.classList.contains('dark');
        return {
            textColor: isDark ? '#cbd5e1' : '#64748b', // slate-300 : slate-500
            gridColor: isDark ? '#334155' : '#e2e8f0', // slate-700 : slate-200
            tooltipBg: isDark ? '#1e293b' : '#ffffff', // slate-800 : white
            tooltipText: isDark ? '#f1f5f9' : '#0f172a', // slate-100 : slate-900
            borderColor: isDark ? '#3b82f6' : '#2563eb' // blue-500 : blue-600
        };
    }

    updateChartsTheme() {
        const colors = this.getThemeColors();

        [this.charts.trend, this.charts.topProducts, this.charts.paymentMethods, this.charts.category].forEach(chart => {
            if (chart) {
                if (chart.options.scales && chart.options.scales.x) {
                    chart.options.scales.x.ticks.color = colors.textColor;
                    chart.options.scales.x.grid.color = 'transparent';
                }
                if (chart.options.scales && chart.options.scales.y) {
                    chart.options.scales.y.ticks.color = colors.textColor;
                    chart.options.scales.y.grid.color = colors.gridColor;
                }
                if (chart.options.plugins && chart.options.plugins.tooltip) {
                    chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                    chart.options.plugins.tooltip.titleColor = colors.tooltipText;
                    chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
                }
                if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
                    chart.options.plugins.legend.labels.color = colors.textColor;
                }
                chart.update();
            }
        });
    }

    renderTrendChart(labels, data) {
        if (!this.dom.trendCanvas) return;

        // Destroy existing chart on this canvas if it exists
        const existingChart = Chart.getChart(this.dom.trendCanvas);
        if (existingChart) existingChart.destroy();

        const ctx = this.dom.trendCanvas.getContext('2d');
        const colors = this.getThemeColors();

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas (Bs)',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                        return gradient;
                    },
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (context) => formatBs(context.raw)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: colors.gridColor, borderDash: [5, 5] },
                        ticks: { color: colors.textColor, callback: (value) => 'Bs ' + value }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: colors.textColor }
                    }
                }
            }
        });
    }

    renderTopProductsChart(labels, data) {
        if (!this.dom.topProductsCanvas) return;

        const existingChart = Chart.getChart(this.dom.topProductsCanvas);
        if (existingChart) existingChart.destroy();

        const ctx = this.dom.topProductsCanvas.getContext('2d');
        const colors = this.getThemeColors();

        this.charts.topProducts = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cantidad',
                    data: data,
                    backgroundColor: [
                        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef'
                    ],
                    borderRadius: 6,
                    barThickness: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: colors.gridColor, borderDash: [5, 5] },
                        ticks: { color: colors.textColor }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: colors.textColor }
                    }
                }
            }
        });
    }

    renderPaymentMethodsChart(labels, data) {
        if (!this.dom.paymentMethodsCanvas) return;

        const existingChart = Chart.getChart(this.dom.paymentMethodsCanvas);
        if (existingChart) existingChart.destroy();

        const ctx = this.dom.paymentMethodsCanvas.getContext('2d');
        const colors = this.getThemeColors();

        this.charts.paymentMethods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: colors.textColor,
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const total = context.chart._metasets[context.datasetIndex].total;
                                const percentage = ((value / total) * 100).toFixed(1) + '%';
                                return context.label + ': ' + formatBs(value) + ' (' + percentage + ')';
                            }
                        }
                    }
                }
            }
        });
    }

    getThemeColors() {
        const isDark = document.documentElement.classList.contains('dark');
        return {
            textColor: isDark ? '#e2e8f0' : '#1e293b',
            gridColor: isDark ? '#334155' : '#e2e8f0',
            tooltipBg: isDark ? '#1e293b' : '#ffffff',
            tooltipText: isDark ? '#f8fafc' : '#1e293b'
        };
    }
}

// Initialize Dashboard if on dashboard page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dashboard-view')) {
        window.dashboard = new Dashboard();
    }
});

