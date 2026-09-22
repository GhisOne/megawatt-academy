/* ============================================================
   MEGAWATT ACADEMY - Module Principal (Orchestrateur)
   Navigation, authentification, modales, toasts, initialisation
   ============================================================ */

const MWApp = (() => {
    'use strict';

    // ============ CONSTANTES ============
    const SESSION_CHECK_INTERVAL = 60000; // Vérifier session toutes les minutes
    const TOAST_DURATION = 5000;          // Durée d'affichage toast (ms)

    // ============ ÉTAT INTERNE ============
    let currentUser = null;
    let sessionCheckInterval = null;
    let currentView = 'dashboard';

    // ============ PERMISSIONS PAR RÔLE ============
    const ROLE_PERMISSIONS = {
        admin: ['dashboard', 'questions', 'exams', 'learner', 'results', 'certificates', 'reports', 'users', 'settings'],
        formateur: ['dashboard', 'questions', 'exams', 'learner', 'results', 'certificates'],
        rh: ['dashboard', 'results', 'certificates', 'reports'],
        apprenant: ['dashboard', 'learner']
    };

    // ============ INITIALISATION ============

    /**
     * Initialise l'application
     */
    function init() {
        console.log('🚀 MEGAWATT ACADEMY - Initialisation...');

        // Vérifier la session existante
        const session = MWStorage.Session.get();
        
        if (session) {
            currentUser = session;
            showApp();
        } else {
            showAuth();
        }

        // Bind événements globaux
        bindGlobalEvents();

        // Masquer le loader
        hideLoader();

        // Démarrer la vérification de session
        startSessionCheck();

        console.log('✅ MEGAWATT ACADEMY - Prêt');
    }

    /**
     * Lie les événements globaux
     */
    function bindGlobalEvents() {
        // Formulaire de connexion
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        // Bouton déconnexion
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', handleLogout);
        }

        // Toggle sidebar mobile
        const btnToggle = document.getElementById('btn-toggle-sidebar');
        if (btnToggle) {
            btnToggle.addEventListener('click', toggleSidebar);
        }

        // Navigation sidebar
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                if (view) navigateTo(view);
            });
        });

        // Fermer modale
        const btnModalClose = document.getElementById('btn-modal-close');
        if (btnModalClose) {
            btnModalClose.addEventListener('click', closeModal);
        }

        // Fermer modale en cliquant sur l'overlay
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });
        }

        // Touche Echap pour fermer modale
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Toggle password
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                    btn.textContent = input.type === 'password' ? '👁' : '🙈';
                }
            });
        });

        // Boutons paramètres
        const btnSaveSettings = document.getElementById('btn-save-settings');
        if (btnSaveSettings) {
            btnSaveSettings.addEventListener('click', saveSettings);
        }

        // Upload logo
        const settingLogo = document.getElementById('setting-logo');
        if (settingLogo) {
            settingLogo.addEventListener('change', (e) => handleImageUpload(e, 'logo'));
        }

        // Upload signature
        const settingSignature = document.getElementById('setting-signature');
        if (settingSignature) {
            settingSignature.addEventListener('change', (e) => handleImageUpload(e, 'signature'));
        }

        // Activité utilisateur (mise à jour session)
        ['click', 'keydown', 'mousemove', 'scroll'].forEach(event => {
            document.addEventListener(event, () => {
                if (MWStorage.Session.isActive()) {
                    MWStorage.Session.updateActivity();
                }
            }, { passive: true });
        });

        // Export résultats CSV/PDF (vue Résultats)
        const btnExportResCsv = document.getElementById('btn-export-results-csv');
        const btnExportResPdf = document.getElementById('btn-export-results-pdf');
        if (btnExportResCsv) btnExportResCsv.addEventListener('click', () => MWReports.exportReportCSV());
        if (btnExportResPdf) btnExportResPdf.addEventListener('click', () => MWReports.exportReportPDF());
    }

    // ============ AUTHENTIFICATION ============

    /**
     * Gère la soumission du formulaire de connexion
     */
    function handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const role = document.getElementById('login-role').value;
        const errorEl = document.getElementById('login-error');

        if (!username || !password || !role) {
            errorEl.textContent = 'Veuillez remplir tous les champs.';
            return;
        }

        // Authentification sécurisée
        const result = MWSecurity.secureLogin(username, password, role);

        if (!result.success) {
            errorEl.textContent = result.error + (result.attemptsRemaining !== undefined 
                ? ` (${result.attemptsRemaining} tentative(s) restante(s))` 
                : '');
            return;
        }

        // Connexion réussie
        errorEl.textContent = '';
        currentUser = MWStorage.Session.create(result.user);
        
        showToast('success', 'Connexion réussie', `Bienvenue ${result.user.fullname || result.user.username} !`);
        
        // Logger l'incident de connexion réussie
        MWStorage.Incidents.log({
            type: 'login_success',
            candidateName: result.user.fullname || result.user.username,
            candidateEmail: result.user.email || '',
            examId: '',
            details: 'Connexion réussie',
            fingerprint: MWSecurity.getSavedFingerprint()?.id || ''
        });

        showApp();
    }

    /**
     * Gère la déconnexion
     */
    function handleLogout() {
        if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;

        MWStorage.Session.destroy();
        currentUser = null;
        
        // Réinitialiser le formulaire
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.reset();
        
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.textContent = '';

        showAuth();
        showToast('info', 'Déconnexion', 'Vous avez été déconnecté avec succès.');
    }

    // ============ AFFICHAGE ============

    /**
     * Affiche l'écran d'authentification
     */
    function showAuth() {
        const authScreen = document.getElementById('auth-screen');
        const app = document.getElementById('app');
        
        if (authScreen) authScreen.style.display = '';
        if (app) app.style.display = 'none';
    }

    /**
     * Affiche l'application principale
     */
    function showApp() {
        const authScreen = document.getElementById('auth-screen');
        const app = document.getElementById('app');
        
        if (authScreen) authScreen.style.display = 'none';
        if (app) app.style.display = '';

        // Mettre à jour les infos utilisateur
        updateUserDisplay();

        // Appliquer les permissions par rôle
        applyRolePermissions();

        // Initialiser les modules
        initializeModules();

        // Afficher la date actuelle
        updateCurrentDate();

        // Naviguer vers la première vue autorisée
        const firstView = ROLE_PERMISSIONS[currentUser.role]?.[0] || 'dashboard';
        navigateTo(firstView);
    }

    /**
     * Met à jour l'affichage des infos utilisateur
     */
    function updateUserDisplay() {
        if (!currentUser) return;

        const userName = document.getElementById('user-name');
        const userRole = document.getElementById('user-role');
        const userAvatar = document.getElementById('user-avatar');

        if (userName) userName.textContent = currentUser.fullname || currentUser.username;
        if (userRole) userRole.textContent = getRoleLabel(currentUser.role);
        if (userAvatar) userAvatar.textContent = (currentUser.fullname || currentUser.username).charAt(0).toUpperCase();
    }

    /**
     * Retourne le libellé d'un rôle
     */
    function getRoleLabel(role) {
        const labels = {
            admin: 'Administrateur',
            formateur: 'Formateur',
            rh: 'Ressources Humaines',
            apprenant: 'Apprenant'
        };
        return labels[role] || role;
    }

    /**
     * Applique les permissions selon le rôle
     */
    function applyRolePermissions() {
        if (!currentUser) return;

        const allowedViews = ROLE_PERMISSIONS[currentUser.role] || [];
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const view = item.dataset.view;
            if (allowedViews.includes(view)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * Initialise tous les modules
     */
    function initializeModules() {
        try {
            if (typeof MWTrainer !== 'undefined') MWTrainer.init();
            if (typeof MWExam !== 'undefined') MWExam.init();
            if (typeof MWCertificates !== 'undefined') MWCertificates.init();
            if (typeof MWReports !== 'undefined') MWReports.init();
            if (typeof MWMailer !== 'undefined') MWMailer.init();
            if (typeof MWBackup !== 'undefined') MWBackup.init();          
        } catch (error) {
            console.error('Erreur initialisation modules:', error);
        }
    }

    // ============ NAVIGATION ============

    /**
     * Navigue vers une vue
     */
    function navigateTo(viewName) {
        // Vérifier permission
        const allowedViews = ROLE_PERMISSIONS[currentUser?.role] || [];
        if (!allowedViews.includes(viewName)) {
            showToast('danger', 'Accès refusé', 'Vous n\'avez pas les permissions pour cette section.');
            return;
        }

        // Masquer toutes les vues
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');

        // Afficher la vue demandée
        const view = document.getElementById(`view-${viewName}`);
        if (view) {
            view.style.display = '';
            currentView = viewName;

            // Mettre à jour le titre
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) {
                const titles = {
                    dashboard: 'Tableau de bord',
                    questions: 'Banque de questions',
                    exams: 'Examens',
                    learner: 'Passer un examen',
                    results: 'Résultats',
                    certificates: 'Certificats',
                    reports: 'Rapports RH',
                    users: 'Utilisateurs',
                    settings: 'Paramètres'
                };
                pageTitle.textContent = titles[viewName] || viewName;
            }

            // Mettre à jour la navigation active
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.view === viewName);
            });

            // Rafraîchir les données de la vue
            refreshView(viewName);

            // Fermer la sidebar sur mobile
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.remove('open');
            }
        }
    }

    /**
     * Rafraîchit les données d'une vue
     */
    function refreshView(viewName) {
        try {
            switch (viewName) {
                case 'dashboard':
                    refreshDashboard();
                    break;
                case 'questions':
                    if (typeof MWTrainer !== 'undefined') MWTrainer.renderQuestions();
                    break;
                case 'exams':
                    if (typeof MWTrainer !== 'undefined') MWTrainer.renderExams();
                    break;
                case 'learner':
                    if (typeof MWExam !== 'undefined') MWExam.resetLearnerForm();
                    break;
                case 'results':
                    if (typeof MWReports !== 'undefined') MWReports.renderResults();
                    break;
                case 'certificates':
                    if (typeof MWCertificates !== 'undefined') MWCertificates.renderCertificates();
                    break;
                case 'reports':
                    if (typeof MWReports !== 'undefined') MWReports.refresh();
                    break;
                case 'users':
                    if (typeof MWTrainer !== 'undefined') MWTrainer.renderUsers();
                    break;
                case 'settings':
                    loadSettings();
                    renderIncidents();
                    break;
            }
        } catch (error) {
            console.error(`Erreur rafraîchissement vue ${viewName}:`, error);
        }
    }

    /**
     * Rafraîchit le tableau de bord
     */
    function refreshDashboard() {
        const stats = MWStorage.Results.getStats();
        const exams = MWStorage.Exams.getAll();

        updateElement('stat-exams', exams.length);
        updateElement('stat-candidates', stats.total);
        updateElement('stat-success', stats.passed);
        updateElement('stat-failures', stats.failed);

        // Activités récentes
        renderRecentActivities();

        // Graphiques dashboard
        if (typeof MWReports !== 'undefined') {
            MWReports.renderDashboard();
        }
    }

    /**
     * Affiche les activités récentes
     */
    function renderRecentActivities() {
        const list = document.getElementById('recent-activities');
        if (!list) return;

        const results = MWStorage.Results.getAll();
        const recent = [...results]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        if (recent.length === 0) {
            list.innerHTML = `
                <li class="empty-state" style="padding:2rem;">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">Aucune activité récente</div>
                </li>
            `;
            return;
        }

        list.innerHTML = recent.map(r => {
            const timeAgo = getTimeAgo(new Date(r.createdAt));
            return `
                <li class="activity-item">
                    <div class="activity-dot" style="background:${r.passed ? 'var(--color-success)' : 'var(--color-danger)'};"></div>
                    <div class="activity-content">
                        <strong>${MWSecurity.escapeHtml(r.candidateName)}</strong> a ${r.passed ? 'réussi' : 'échoué'} 
                        <em>${MWSecurity.escapeHtml(r.examTitle)}</em>
                        <div class="activity-time">${timeAgo} • ${r.grade}/20</div>
                    </div>
                </li>
            `;
        }).join('');
    }

    /**
     * Retourne une durée relative (il y a X minutes/heures)
     */
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'À l\'instant';
        if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
        if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)} j`;
        return date.toLocaleDateString('fr-FR');
    }

    // ============ SIDEBAR MOBILE ============

    /**
     * Bascule l'affichage de la sidebar
     */
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('open');
    }

    // ============ MODALES ============

    /**
     * Ouvre une modale
     */
    function openModal(title, bodyHTML, footerHTML = '') {
        const overlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');

        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = bodyHTML;
        if (modalFooter) modalFooter.innerHTML = footerHTML;
        if (overlay) overlay.style.display = '';

        // Empêcher le scroll du body
        document.body.style.overflow = 'hidden';
    }

    /**
     * Ferme la modale
     */
    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    // ============ TOASTS ============

    /**
     * Affiche une notification toast
     */
    function showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '✅',
            danger: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
            <div class="toast-content">
                <div class="toast-title">${MWSecurity.escapeHtml(title)}</div>
                <div class="toast-message">${MWSecurity.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Fermer">×</button>
        `;

        // Bouton fermer
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));

        container.appendChild(toast);

        // Suppression automatique
        setTimeout(() => removeToast(toast), TOAST_DURATION);
    }

    /**
     * Supprime un toast
     */
    function removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }

    // ============ LOADER ============

    /**
     * Masque le loader global
     */
    function hideLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.style.display = 'none', 400);
        }
    }

    /**
     * Affiche le loader
     */
    function showLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.display = '';
            loader.classList.remove('hidden');
        }
    }

    // ============ PARAMÈTRES ============

    /**
     * Charge les paramètres dans le formulaire
     */
    function loadSettings() {
        const settings = MWStorage.Settings.getAll();

        setInputValue('setting-bareme', settings.bareme);
        setInputValue('setting-max-tab-changes', settings.maxTabChanges);
        setInputValue('setting-session-timeout', settings.sessionTimeout);
        setInputValue('setting-web3forms-key', settings.web3formsKey);
        setInputValue('setting-emailjs-service', settings.emailjsService);
        setInputValue('setting-emailjs-template', settings.emailjsTemplate);
        setInputValue('setting-emailjs-user', settings.emailjsUser);
        setInputValue('setting-email-dest', settings.emailDest);
        setInputValue('setting-whatsapp', settings.whatsapp);
    }

    /**
     * Met à jour la valeur d'un input
     */
    function setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input && value !== undefined) input.value = value;
    }

    /**
     * Sauvegarde les paramètres
     */
    function saveSettings() {
        const settings = {
            bareme: parseInt(document.getElementById('setting-bareme').value) || 60,
            maxTabChanges: parseInt(document.getElementById('setting-max-tab-changes').value) || 3,
            sessionTimeout: parseInt(document.getElementById('setting-session-timeout').value) || 60,
            web3formsKey: document.getElementById('setting-web3forms-key').value.trim(),
            emailjsService: document.getElementById('setting-emailjs-service').value.trim(),
            emailjsTemplate: document.getElementById('setting-emailjs-template').value.trim(),
            emailjsUser: document.getElementById('setting-emailjs-user').value.trim(),
            emailDest: document.getElementById('setting-email-dest').value.trim(),
            whatsapp: document.getElementById('setting-whatsapp').value.trim()
        };

        // Validation email dest
        if (settings.emailDest && !MWSecurity.isValidEmail(settings.emailDest)) {
            showToast('danger', 'Erreur', 'Email destinataire invalide.');
            return;
        }

        MWStorage.Settings.update(settings);
        showToast('success', 'Paramètres enregistrés', 'Les paramètres ont été sauvegardés avec succès.');
    }

    /**
     * Gère l'upload d'image (logo, signature)
     */
    function handleImageUpload(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        // Vérifier type
        const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            showToast('danger', 'Format invalide', 'Formats acceptés : PNG, JPG, SVG.');
            return;
        }

        // Vérifier taille (max 2 Mo)
        if (file.size > 2 * 1024 * 1024) {
            showToast('danger', 'Fichier trop volumineux', 'Taille maximale : 2 Mo.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            
            // Sauvegarder dans les settings
            const settings = MWStorage.Settings.getAll();
            settings[type] = dataUrl;
            MWStorage.Settings.update(settings);

            // Mettre à jour l'affichage
            if (type === 'logo') {
                const authLogo = document.getElementById('auth-logo-img');
                const sidebarLogo = document.getElementById('sidebar-logo');
                if (authLogo) authLogo.src = dataUrl;
                if (sidebarLogo) sidebarLogo.src = dataUrl;
            }

            showToast('success', 'Image uploadée', `${type === 'logo' ? 'Le logo' : 'La signature'} a été mis(e) à jour.`);
        };
        reader.readAsDataURL(file);
    }

    // ============ INCIDENTS ============

    /**
     * Affiche la liste des incidents
     */
    function renderIncidents() {
        const tbody = document.getElementById('incidents-tbody');
        if (!tbody) return;

        const incidents = MWStorage.Incidents.getAll();

        if (incidents.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-state">
                            <div class="empty-state-icon">🛡️</div>
                            <div class="empty-state-title">Aucun incident</div>
                            <div class="empty-state-text">Le système de sécurité n'a détecté aucun incident.</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Trier par date décroissante
        const sorted = [...incidents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const typeLabels = {
            tab_change: '⚠️ Changement d\'onglet',
            login_failed: '🔒 Tentative échouée',
            login_lockout: '🚫 Compte bloqué',
            login_success: '✅ Connexion réussie',
            fingerprint_mismatch: '🔍 Empreinte modifiée'
        };

        tbody.innerHTML = sorted.map(i => `
            <tr>
                <td>${new Date(i.createdAt).toLocaleString('fr-FR')}</td>
                <td>${MWSecurity.escapeHtml(i.candidateName || '—')}</td>
                <td><span class="badge badge-warning">${typeLabels[i.type] || i.type}</span></td>
                <td style="max-width:400px;font-size:0.85rem;color:var(--color-text-muted);">
                    ${MWSecurity.escapeHtml(i.details || '')}
                </td>
            </tr>
        `).join('');
    }

    // ============ SESSION ============

    /**
     * Démarre la vérification périodique de session
     */
    function startSessionCheck() {
        if (sessionCheckInterval) clearInterval(sessionCheckInterval);
        
        sessionCheckInterval = setInterval(() => {
            if (currentUser && !MWStorage.Session.isActive()) {
                showToast('warning', 'Session expirée', 'Votre session a expiré. Veuillez vous reconnecter.');
                handleLogout();
            }
        }, SESSION_CHECK_INTERVAL);
    }

    /**
     * Met à jour la date affichée dans la topbar
     */
    function updateCurrentDate() {
        const dateEl = document.getElementById('current-date');
        if (dateEl) {
            const now = new Date();
            dateEl.textContent = now.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }

    // ============ UTILITAIRES ============

    /**
     * Met à jour un élément du DOM
     */
    function updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /**
     * Retourne l'utilisateur courant
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Retourne la vue courante
     */
    function getCurrentView() {
        return currentView;
    }

    // ============ API PUBLIQUE ============

    return {
        init,
        navigateTo,
        openModal,
        closeModal,
        showToast,
        hideLoader,
        showLoader,
        getCurrentUser,
        getCurrentView,
        toggleSidebar,
        refreshView,
        refreshDashboard
    };
})();

// ============ DÉMARRAGE DE L'APPLICATION ============
document.addEventListener('DOMContentLoaded', () => {
    // Petit délai pour laisser les modules se charger
    setTimeout(() => {
        MWApp.init();
    }, 100);
});