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
            ui.showNotification('Error loading users', 'error');
        }
    }

    renderTable(list) {
        if (!this.dom.tableBody) return;
        this.dom.tableBody.innerHTML = list.map(u => {
            const isBlocked = u.status === 'blocked';
            const trialInfo = u.trial_expires_at ? `<div class="text-xs text-indigo-500 font-medium">Prueba hasta: ${new Date(u.trial_expires_at).toLocaleString()}</div>` : '';

            return `
            <tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="p-3 text-sm font-medium text-slate-900 dark:text-white">
                    ${u.email}
                    ${isBlocked ? '<span class="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">Bloqueado</span>' : ''}
                    ${trialInfo}
                </td>
                <td class="p-3 text-sm text-slate-500">${u.role}</td>
                <td class="p-3 text-sm text-slate-500">
                    ${(() => {
                    try {
                        if (!u.businessInfo) return 'Default';
                        const info = typeof u.businessInfo === 'string' ? JSON.parse(u.businessInfo) : u.businessInfo;
                        if (info.currencies && Array.isArray(info.currencies)) {
                            return info.currencies.join(', ');
                        }
                        return info.currency || 'Default';
                    } catch (e) { return 'Error'; }
                })()}
                </td>
                <td class="p-3 text-right relative">
                    <button class="user-actions-btn p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400" data-id="${u.id}">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                    <!-- Dropdown Menu -->
                    <div id="dropdown-${u.id}" class="user-actions-dropdown hidden absolute w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-[9999] overflow-hidden" onclick="event.stopPropagation()">
                        <button class="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2" onclick="window.app.views.users.handleEdit('${u.id}')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            Editar
                        </button>
                        <button class="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2" onclick="window.app.views.users.openTrialModal('${u.id}')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Modo Prueba
                        </button>
                        <button class="w-full text-left px-4 py-3 text-sm ${isBlocked ? 'text-green-600' : 'text-amber-600'} hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2" onclick="window.app.views.users.toggleBlock('${u.id}', ${isBlocked})">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                            ${isBlocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                        <button class="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2" onclick="window.app.views.users.handleDelete('${u.id}')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        this.dom.tableBody.querySelectorAll('.user-actions-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                this.toggleDropdown(id, e.currentTarget);
            });
        });
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
                                    const cb = document.querySelector(`input[name="user_currency"][value="${curr}"]`);
                                    if (cb) cb.checked = true;
                                });
                            } else if (info.currency) {
                                // Legacy fallback
                                const cb = document.querySelector(`input[name="user_currency"][value="${info.currency}"]`);
                                if (cb) cb.checked = true;
                            }
                        } catch (e) {
                            console.warn('Error parsing businessInfo', e);
                        }
                    }
                }
            } else {
                this.dom.modalTitle.textContent = 'Nuevo Usuario';
                this.dom.modalForm.reset();
                document.getElementById('user-password').required = true;
                document.getElementById('user-password').placeholder = '';
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
        if (confirm(`¿Estás seguro de que deseas ${action} a este usuario?`)) {
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
            businessInfo: {
                currencies: currencies,
                currency: currencies[0] // Backwards compatibility
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
