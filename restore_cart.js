const fs = require('fs');
const path = 'index.html';

const cartHtml = `
    <!-- Cart Container (Wrapper for Sidebar + Toggle) -->
    <div id="desktop-cart-container"
        class="fixed inset-y-0 right-0 z-50 w-80 md:w-auto flex items-center transform translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out h-full pointer-events-none">

        <!-- Desktop Cart Toggle Button -->
        <button id="desktop-cart-toggle"
            class="hidden md:flex pointer-events-auto bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-l-xl shadow-[-2px_0_10px_rgba(0,0,0,0.1)] hover:text-indigo-800 dark:hover:text-indigo-300 hover:pl-2.5 transition-all duration-300 items-center justify-center h-12 w-8 group border-y border-l border-indigo-600 dark:border-indigo-500 relative -mr-[1px]">
            <svg id="cart-toggle-icon" class="w-5 h-5 transform transition-transform duration-300" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7">
                </path>
            </svg>
        </button>

        <div id="cart-sidebar"
            class="pointer-events-auto w-80 md:w-80 lg:w-96 h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col">

            <div
                class="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                <h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <svg class="w-5 h-5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z">
                        </path>
                    </svg>
                    Carrito Actual
                </h2>
                <button id="close-cart-btn"
                    class="md:hidden p-2 text-slate-500 hover:text-slate-700 bg-slate-200 rounded-full">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12">
                        </path>
                    </svg>
                </button>
            </div>

            <!-- Customer Search Section -->
            <div class="px-3 md:px-4 pt-4">
                <div
                    class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div id="customer-search-container" class="relative">
                        <label
                            class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Cliente</label>
                        <div class="relative">
                            <input type="text" id="pos-customer-search"
                                class="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-white placeholder-slate-400 dark:placeholder-slate-400"
                                placeholder="Buscar cliente (Nombre/CI)...">
                            <svg class="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none"
                                stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <!-- Search Results Dropdown -->
                        <div id="pos-customer-results"
                            class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto hidden">
                            <!-- JS Injected -->
                        </div>
                    </div>

                    <!-- Selected Customer Display -->
                    <div id="pos-selected-customer" class="hidden">
                        <div
                            class="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div class="flex items-center gap-3">
                                <div class="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
                                    <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none"
                                        stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                                        </path>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-slate-800 dark:text-white"
                                        id="selected-customer-name">Nombre Cliente</p>
                                    <p class="text-xs text-slate-500 dark:text-slate-400"
                                        id="selected-customer-doc">CI:
                                        12345</p>
                                </div>
                            </div>
                            <button id="deselect-customer-btn"
                                class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                title="Quitar cliente">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16">
                                    </path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="cart-items" class="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
                <!-- JS Injected Cart Items -->
            </div>

            <div
                class="p-4 md:p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-bottom">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-slate-500 dark:text-slate-300">Total USD</span>
                    <span id="cart-total" class="text-2xl font-bold text-slate-900 dark:text-white">$0.00</span>
                </div>
                <div class="flex justify-between items-center mb-4">
                    <span class="text-slate-500 dark:text-slate-300 text-sm">Total BS</span>
                    <span id="cart-total-bs" class="text-lg font-semibold text-slate-700 dark:text-slate-300">Bs
                        0.00</span>
                </div>
                <div class="grid grid-cols-5 gap-2">
                    <button id="clear-cart-btn"
                        class="col-span-1 p-2 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center group/clear"
                        title="Vaciar Carrito">
                        <svg class="w-6 h-6 overflow-visible" fill="none" stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                class="origin-bottom transition-transform duration-300 group-hover/clear:-rotate-12 group-hover/clear:-translate-y-1"
                                stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6">
                            </path>
                            <path
                                class="origin-center transition-transform duration-300 group-hover/clear:-translate-y-2 group-hover/clear:rotate-12"
                                stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M9 7V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>

                    <button id="view-held-sales-btn"
                        class="col-span-1 relative p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 font-bold rounded-xl transition-colors flex justify-center items-center"
                        title="Ver Ventas en Espera">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span id="held-count-badge"
                            class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full hidden">0</span>
                    </button>

                    <button id="hold-sale-btn"
                        class="col-span-1 p-2 bg-yellow-100 text-yellow-600 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/40 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        title="Poner en Espera">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </button>

                    <button id="checkout-btn"
                        class="col-span-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        disabled>
                        Finalizar
                    </button>
                </div>
            </div>
        </div>
    </div>
`;

try {
    let data = fs.readFileSync(path, 'utf8');

    // Remove any malformed fragments if they exist at the end
    // We are looking for the closing tag we saw earlier
    const brokenEnd = '</div><!-- Closing desktop-cart-container -->';
    if (data.includes(brokenEnd)) {
        console.log('Found broken end fragment, removing...');
        data = data.replace(brokenEnd, '');
    }

    // Also look for just the closing divs that might be left over 
    // This is risky, so we will append BEFORE the <script> block we added for SW unregister

    const target = '<script>';
    // Find the LAST script tag (which is our SW unregister one)
    const lastScriptIndex = data.lastIndexOf('<script>');

    if (lastScriptIndex !== -1) {
        const part1 = data.substring(0, lastScriptIndex);
        const part2 = data.substring(lastScriptIndex);

        // Inject cart Html before the script
        const newData = part1 + '\n' + cartHtml + '\n' + part2;
        fs.writeFileSync(path, newData, 'utf8');
        console.log('Successfully re-injected Cart HTML.');
    } else {
        throw new Error('Could not find injection point (last <script> tag)');
    }

} catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
}
