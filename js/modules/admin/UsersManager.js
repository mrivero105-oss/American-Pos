import { api } from '../../api.js';
import { ui } from '../../ui.js';

export class UsersManager {
    constructor() {
        this.dom = {
            view: document.getElementById('view-users'),
            tableBody: document.getElementById('users-table-body'),
            addBtn: document.getElementById('add-user-btn'),

            // User Modal
            modal: document.getElementById('user-modal'),
            modalForm: document.getElementById('user-form'),
            closeModalBtn: document.getElementById('close-user-modal'),
            cancelModalBtn: document.getElementById('cancel-user-modal'),
            modalTitle: document.querySelector('#user-modal h3'),

            // Trial Modal
            trialModal: document.getElementById('trial-modal'),
            trialForm: document.getElementById('trial-form'),
            closeTrialBtn: document.getElementById('close-trial-modal'),
            cancelTrialBtn: document.getElementById('cancel-trial-btn'),
            // save button is inside the form, handled by submit event
        };
        this.users = [];
        this.editingUserId = null;
        this.currentTrialUserId = null;
        this.activeDropdown = null;
        this.scrollBound = false;

        this.bindEvents();

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-actions-dropdown') && !e.target.closest('.user-actions-btn')) {
                this.closeAllDropdowns();
            }
        });
    }

    bindEvents() {
        // User Modal Events
        if (this.dom.addBtn) {
            this.dom.addBtn.addEventListener('click', () => this.openModal());
        }
        if (this.dom.closeModalBtn) this.dom.closeModalBtn.addEventListener('click', () => this.closeModal());
        if (this.dom.cancelModalBtn) this.dom.cancelModalBtn.addEventListener('click', () => this.closeModal());
        if (this.dom.modalForm) {
            this.dom.modalForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Trial Modal Events
        if (this.dom.closeTrialBtn) this.dom.closeTrialBtn.addEventListener('click', () => this.closeTrialModal());
        if (this.dom.cancelTrialBtn) this.dom.cancelTrialBtn.addEventListener('click', () => this.closeTrialModal());
        if (this.dom.trialForm) {
            this.dom.trialForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveTrial();
            });
        }

        // Global scroll listener to close dropdowns
        if (!this.scrollBound) {
            window.addEventListener('scroll', () => this.closeAllDropdowns(), true);
            this.scrollBound = true;
        }
    }

    async load() {
        try {
            this.users = await api.users.getAll();
            this.renderTable(this.users);
        } catch (e) {
            console.error('Error loading users:', e);
            ui.showNotification(
                `Error loading users: ${e.message || 'Unknown error'}`,
                'error'
            );
        }
    }

    renderTable(list) {
        if (!this.dom.tableBody) return;

        // Switch to card-based layout for better visual presentation

        // Check if we already have the card grid or need to find the table
        let container = document.getElementById('users-card-grid');
        let isReplacement = false;

        if (!container) {
            // First run: Find table and prepare to replace it
            container = this.dom.tableBody.closest('table');
            if (!container) return;
            isReplacement = true;
        } else {
            // Subsequent runs: Clear existing grid
            container.innerHTML = '';
        }

        // Create new card container with FLEXBOX if starting from scratch
        const cardGrid = isReplacement ? document.createElement('div') : container;
        if (isReplacement) {
            cardGrid.className = 'flex flex-wrap gap-4 p-4';
            cardGrid.id = 'users-card-grid';
        }

        // Generate content
        const content = list.map(u => {
            const isBlocked = u.status === 'blocked';
            const isAdmin = u.role === 'admin';
            const trialInfo = u.trial_expires_at ? new Date(u.trial_expires_at).toLocaleDateString() : null;
            // ... (rest of parsing) ...
            let currencies = 'USD'; // Default currency
            try {
                if (u.businessInfo) {
                    const info = typeof u.businessInfo === 'string' ? JSON.parse(u.businessInfo) : u.businessInfo;
                    if (info.currencies && Array.isArray(info.currencies)) {
                        currencies = info.currencies.join(', ');
                    } else if (info.currency) {
                        currencies = info.currency;
                    }
                }
            } catch (e) { currencies = 'USD'; }

            // Generate avatar initials from email
            const initials = u.email.substring(0, 2).toUpperCase();
            const avatarColors = isAdmin
                ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                : 'bg-gradient-to-br from-blue-500 to-cyan-600';

            return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300" style="width: 350px; flex-shrink: 0;">
                <!-- Header with Avatar -->
                <div class="p-5 flex items-start gap-4">
                    <div class="${avatarColors} w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0">
                        ${initials}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-semibold text-slate-900 dark:text-white text-sm truncate" title="${u.email}">
                            ${u.email}
                        </h3>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                            <!-- Role Badge -->
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${isAdmin ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}">
                                ${isAdmin ? `
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                                Admin` : `
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path></svg>
                                Cajero`}
                            </span>
                            
                            ${isBlocked ? `
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"></path></svg>
                                Bloqueado
                            </span>` : ''}
                            
                            ${trialInfo ? `
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path></svg>
                                Prueba: ${trialInfo}
                            </span>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Info Section -->
                <div class="px-5 pb-4">
                    <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>Moneda: <span class="font-medium text-slate-700 dark:text-slate-300">${currencies}</span></span>
                    </div>
                </div>
                
                <!-- Actions Footer -->
                <div class="mt-auto px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                    <button onclick="window.app.views.users.handleEdit('${u.id}')" 
                        class="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="Editar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button onclick="window.app.views.users.openTrialModal('${u.id}')" 
                        class="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors" title="Modo Prueba">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                    <button onclick="window.app.views.users.toggleBlock('${u.id}', ${isBlocked})" 
                        class="p-2 rounded-lg ${isBlocked ? 'text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30' : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'} transition-colors" title="${isBlocked ? 'Desbloquear' : 'Bloquear'}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                    </button>
                    <button onclick="window.app.views.users.handleDelete('${u.id}')" 
                        class="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Eliminar">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>`;
        }).join('');

        if (isReplacement) {
            cardGrid.innerHTML = content;
            container.parentNode.replaceChild(cardGrid, container);
        } else {
            container.innerHTML = content;
        }

        // Log card rendering
        setTimeout(() => {
            const grid = document.getElementById('users-card-grid');
            if (grid) {
                const cards = grid.querySelectorAll(':scope > div');
                console.log(`[UsersManager] Rendered ${cards.length} user cards`);
            }
        }, 100);

        // Update DOM reference
        this.dom.tableBody = isReplacement ? cardGrid : container;
    }

    closeAllDropdowns() {
        document.querySelectorAll('.user-actions-dropdown').forEach(d => {
            d.classList.add('hidden');
            d.style.display = 'none';
        });
        this.activeDropdown = null;
    }

    toggleDropdown(id, btn) {
        const dropdown = document.getElementById(`dropdown-${id}`);
        // Close others
        if (this.activeDropdown && this.activeDropdown !== id) {
            this.closeAllDropdowns();
        }
        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            dropdown.style.display = 'block';
            this.activeDropdown = id;
            if (btn) {
                const rect = btn.getBoundingClientRect();
                const dropdownWidth = 192;
                let top = rect.bottom + 5;
                let left = rect.right - dropdownWidth;
                if (top + 200 > window.innerHeight) top = rect.top - 200;
                dropdown.style.position = 'fixed';
                dropdown.style.top = `${top}px`;
                dropdown.style.left = `${left}px`;
            }
        } else {
            dropdown.classList.add('hidden');
            dropdown.style.display = 'none';
            this.activeDropdown = null;
        }
    }

    openModal(userId = null) {
        if (this.dom.modal) {
            this.dom.modal.classList.remove('hidden');
            this.dom.modal.style.display = 'flex';
            this.editingUserId = userId;

            if (userId) {
                this.dom.modalTitle.textContent = 'Editar Usuario';
                const user = this.users.find(u => u.id === userId);
                if (user) {
                    document.getElementById('user-email').value = user.email;
                    document.getElementById('user-password').value = '';
                    document.getElementById('user-password').placeholder = 'Dejar en blanco para mantener';
                    document.getElementById('user-password').required = false;
                    document.getElementById('user-role').value = user.role;
                    if (user.businessInfo) {
                        try {
                            const info = typeof user.businessInfo === 'string' ? JSON.parse(user.businessInfo) : user.businessInfo;
                            // Clear first
                            document.querySelectorAll('input[name="user_currency"]').forEach(cb => cb.checked = false);

                            if (info.currencies && Array.isArray(info.currencies)) {
                                info.currencies.forEach(curr => {
                                    const cb = document.querySelector(`input[name = "user_currency"][value = "${curr}"]`);
                                    if (cb) cb.checked = true;
                                });
                            } else if (info.currency) {
                                // Legacy fallback
                                const cb = document.querySelector(`input[name = "user_currency"][value = "${info.currency}"]`);
                                if (cb) cb.checked = true;
                            }
                        } catch (e) {
                            console.warn('Error parsing businessInfo', e);
                        }
                    }
                }

                // Populate Data Scope
                const shareCb = document.getElementById('user-share-data');
                if (shareCb) {
                    // If tenantId equals user.id, they are their own tenant (Isolated).
                    // Otherwise they share (or are legacy admin-1).
                    const isIsolated = user.tenantId && user.tenantId === user.id;
                    shareCb.checked = !isIsolated;
                }
            }
        } else {
            this.dom.modalTitle.textContent = 'Nuevo Usuario';
            this.dom.modalForm.reset();
            document.getElementById('user-password').required = true;
            document.getElementById('user-password').placeholder = '';

            // Reset Share Data
            const shareCb = document.getElementById('user-share-data');
            if (shareCb) {
                shareCb.checked = true;
                shareCb.disabled = false;
            }
        }
    }


    closeModal() {
        if (this.dom.modal) {
            this.dom.modal.classList.add('hidden');
            this.dom.modal.style.display = 'none';
            this.editingUserId = null;
        }
        if (this.dom.modalForm) this.dom.modalForm.reset();
    }

    handleEdit(id) {
        this.closeAllDropdowns();
        this.openModal(id);
    }

    async toggleBlock(id, isBlocked) {
        this.closeAllDropdowns();
        const action = isBlocked ? 'desbloquear' : 'bloquear';
        if (confirm(`¿Estás seguro de que deseas ${action} a este usuario ? `)) {
            try {
                await api.users.update(id, { status: isBlocked ? 'active' : 'blocked' });
                this.load();
                ui.showNotification(`Usuario ${isBlocked ? 'desbloqueado' : 'bloqueado'} exitosamente`);
            } catch (e) {
                ui.showNotification(e.message, 'error');
            }
        }
    }

    // Trial Mode Logic
    openTrialModal(id) {
        this.closeAllDropdowns();
        this.currentTrialUserId = id;
        if (this.dom.trialModal) {
            this.dom.trialModal.classList.remove('hidden');
            this.dom.trialModal.style.display = 'flex';
            // Reset form if needed, though simpler to keep last values or reset
            document.getElementById('trial-duration').value = '';
        }
    }

    closeTrialModal() {
        if (this.dom.trialModal) {
            this.dom.trialModal.classList.add('hidden');
            this.dom.trialModal.style.display = 'none';
        }
        this.currentTrialUserId = null;
    }

    async saveTrial() {
        if (!this.currentTrialUserId) return;

        const durationInput = document.getElementById('trial-duration');
        if (!durationInput) return;

        const days = parseInt(durationInput.value) || 0;

        if (days <= 0) {
            ui.showNotification('Por favor selecciona una duración válida', 'warning');
            return;
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        try {
            await api.users.update(this.currentTrialUserId, {
                trial_expires_at: expiresAt.toISOString(),
                status: 'active'
            });

            ui.showNotification(`Prueba activada por ${days} días`, 'success');
            this.closeTrialModal();
            this.load();
        } catch (e) {
            console.error('Error saving trial:', e);
            ui.showNotification('Error al guardar modo prueba', 'error');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;

        // Multi-currency handling
        const currencies = Array.from(document.querySelectorAll('input[name="user_currency"]:checked')).map(cb => cb.value);
        if (currencies.length === 0) {
            ui.showNotification('Seleccione al menos una moneda', 'warning');
            return;
        }

        const data = {
            email,
            role,
            dataScope: document.getElementById('user-share-data')?.checked ? 'shared' : 'isolated',
            businessInfo: {
                currencies: currencies,
                currency: currencies[0]
            }
        };

        if (password) data.password = password;

        try {
            if (this.editingUserId) {
                await api.users.update(this.editingUserId, data);
                ui.showNotification('Usuario actualizado exitosamente');
            } else {
                await api.users.create({ ...data, password });
                ui.showNotification('Usuario creado exitosamente');
            }
            this.closeModal();
            this.load();
        } catch (err) {
            console.error(err);
            ui.showNotification(err.message, 'error');
        }
    }


    async handleDelete(id) {
        this.closeAllDropdowns();
        if (confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.')) {
            try {
                await api.users.delete(id);
                ui.showNotification('Usuario eliminado correctamente');
                this.load();
            } catch (e) {
                console.error(e);
                ui.showNotification(e.message, 'error');
            }
        }
    }
}
