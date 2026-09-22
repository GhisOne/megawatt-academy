/* ============================================================
   MEGAWATT ACADEMY - Module Sauvegarde & Restauration
   Export/Import complet, sauvegarde automatique, historique
   ============================================================ */

const MWBackup = (() => {
    'use strict';

    // ============ CONSTANTES ============
    const BACKUP_KEY = 'mw_local_backups';
    const AUTO_BACKUP_KEY = 'mw_last_auto_backup';
    const MAX_LOCAL_BACKUPS = 5;              // Nombre max de sauvegardes locales
    const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures
    const APP_VERSION = '1.0.0';

    // ============ INITIALISATION ============

    /**
     * Initialise le module de sauvegarde
     */
    function init() {
        bindEvents();
        renderBackupSection();
        checkAutoBackup();
    }

    /**
     * Lie les événements de l'interface
     */
    function bindEvents() {
        const btnExport = document.getElementById('btn-backup-export');
        const btnImport = document.getElementById('btn-backup-import');
        const btnClearLocal = document.getElementById('btn-backup-clear-local');

        if (btnExport) btnExport.addEventListener('click', exportAllData);
        if (btnImport) btnImport.addEventListener('click', importFromFile);
        if (btnClearLocal) btnClearLocal.addEventListener('click', clearLocalBackups);
    }

    // ============ EXPORT COMPLET ============

    /**
     * Exporte toutes les données dans un fichier JSON
     */
    function exportAllData() {
        try {
            const data = buildBackupObject();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            
            const date = new Date().toISOString().split('T')[0];
            const filename = `megawatt-backup-${date}.json`;
            
            downloadBlob(blob, filename);

            // Sauvegarder dans l'historique local
            saveToLocalHistory(data);

            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Sauvegarde réussie', `Fichier "${filename}" téléchargé.`);
            }

            renderBackupSection();
            return { success: true, filename };
        } catch (error) {
            console.error('Erreur export:', error);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Impossible de créer la sauvegarde : ' + error.message);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Construit l'objet de sauvegarde complet
     */
    function buildBackupObject() {
        return {
            metadata: {
                app: 'MEGAWATT ACADEMY',
                version: APP_VERSION,
                exportedAt: new Date().toISOString(),
                exportedBy: getCurrentUser(),
                dataSize: 0
            },
            data: MWStorage.exportAll()
        };
    }

    /**
     * Récupère l'utilisateur courant
     */
    function getCurrentUser() {
        if (typeof MWApp !== 'undefined' && MWApp.getCurrentUser) {
            const user = MWApp.getCurrentUser();
            return user ? user.username : 'unknown';
        }
        return 'unknown';
    }

    /**
     * Télécharge un blob
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============ IMPORT / RESTAURATION ============

    /**
     * Ouvre le sélecteur de fichier pour importer
     */
    function importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    const backup = JSON.parse(content);
                    
                    // Valider le format
                    if (!validateBackup(backup)) {
                        throw new Error('Format de sauvegarde invalide');
                    }

                    // Confirmer avant restauration
                    const confirmMsg = `⚠️ ATTENTION ⚠️\n\n` +
                        `Cette action va REMPLACER toutes vos données actuelles par celles du fichier.\n\n` +
                        `📅 Sauvegarde du : ${new Date(backup.metadata.exportedAt).toLocaleString('fr-FR')}\n` +
                        `👤 Créée par : ${backup.metadata.exportedBy}\n` +
                        `📦 Questions : ${backup.data.questions?.length || 0}\n` +
                        `📝 Examens : ${backup.data.exams?.length || 0}\n` +
                        `✅ Résultats : ${backup.data.results?.length || 0}\n\n` +
                        `Voulez-vous vraiment continuer ?`;

                    if (!confirm(confirmMsg)) {
                        return;
                    }

                    // Effectuer la restauration
                    restoreBackup(backup);

                } catch (error) {
                    console.error('Erreur import:', error);
                    if (typeof MWApp !== 'undefined') {
                        MWApp.showToast('danger', 'Erreur', 'Fichier invalide : ' + error.message);
                    }
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    /**
     * Valide le format d'une sauvegarde
     */
    function validateBackup(backup) {
        if (!backup || typeof backup !== 'object') return false;
        if (!backup.metadata || !backup.data) return false;
        if (backup.metadata.app !== 'MEGAWATT ACADEMY') return false;
        if (!backup.data.users || !Array.isArray(backup.data.users)) return false;
        
        return true;
    }

    /**
     * Restaure une sauvegarde
     */
    function restoreBackup(backup) {
        try {
            // Importer les données
            MWStorage.importAll(backup.data);

            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Restauration réussie', 'Toutes les données ont été restaurées. Rechargement...');
            }

            // Recharger la page pour appliquer les changements
            setTimeout(() => {
                window.location.reload();
            }, 1500);

            return { success: true };
        } catch (error) {
            console.error('Erreur restauration:', error);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Impossible de restaurer : ' + error.message);
            }
            return { success: false, error: error.message };
        }
    }

    // ============ SAUVEGARDES LOCALES ============

    /**
     * Sauvegarde dans l'historique local (localStorage)
     */
    function saveToLocalHistory(backup) {
        try {
            const history = getLocalBackups();
            
            // Ajouter au début
            history.unshift({
                id: Date.now(),
                date: new Date().toISOString(),
                size: JSON.stringify(backup).length,
                preview: {
                    questions: backup.data.questions?.length || 0,
                    exams: backup.data.exams?.length || 0,
                    results: backup.data.results?.length || 0,
                    users: backup.data.users?.length || 0
                },
                data: backup
            });

            // Limiter à MAX_LOCAL_BACKUPS
            if (history.length > MAX_LOCAL_BACKUPS) {
                history.splice(MAX_LOCAL_BACKUPS);
            }

            localStorage.setItem(BACKUP_KEY, JSON.stringify(history));
            return true;
        } catch (error) {
            console.warn('Sauvegarde locale impossible (quota dépassé ?):', error);
            return false;
        }
    }

    /**
     * Récupère l'historique local
     */
    function getLocalBackups() {
        try {
            const data = localStorage.getItem(BACKUP_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Restaure depuis l'historique local
     */
    function restoreFromLocal(id) {
        const history = getLocalBackups();
        const backup = history.find(b => b.id === id);
        
        if (!backup) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Sauvegarde introuvable.');
            }
            return;
        }

        const confirmMsg = `⚠️ Restaurer cette sauvegarde du ${new Date(backup.date).toLocaleString('fr-FR')} ?\n\n` +
            `Toutes vos données actuelles seront remplacées.`;

        if (!confirm(confirmMsg)) return;

        restoreBackup(backup.data);
    }

    /**
     * Exporte une sauvegarde locale en fichier
     */
    function exportLocalBackup(id) {
        const history = getLocalBackups();
        const backup = history.find(b => b.id === id);
        
        if (!backup) return;

        const json = JSON.stringify(backup.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const date = new Date(backup.date).toISOString().split('T')[0];
        downloadBlob(blob, `megawatt-backup-${date}.json`);

        if (typeof MWApp !== 'undefined') {
            MWApp.showToast('success', 'Export réussi', 'Fichier téléchargé.');
        }
    }

    /**
     * Supprime une sauvegarde locale
     */
    function deleteLocalBackup(id) {
        if (!confirm('Supprimer cette sauvegarde locale ?')) return;

        const history = getLocalBackups().filter(b => b.id !== id);
        localStorage.setItem(BACKUP_KEY, JSON.stringify(history));
        
        renderBackupSection();
        
        if (typeof MWApp !== 'undefined') {
            MWApp.showToast('success', 'Supprimé', 'Sauvegarde locale supprimée.');
        }
    }

    /**
     * Vide toutes les sauvegardes locales
     */
    function clearLocalBackups() {
        if (!confirm('Supprimer TOUTES les sauvegardes locales ?')) return;

        localStorage.removeItem(BACKUP_KEY);
        renderBackupSection();
        
        if (typeof MWApp !== 'undefined') {
            MWApp.showToast('success', 'Vidé', 'Toutes les sauvegardes locales ont été supprimées.');
        }
    }

    // ============ SAUVEGARDE AUTOMATIQUE ============

    /**
     * Vérifie si une sauvegarde automatique est nécessaire
     */
    function checkAutoBackup() {
        const lastBackup = localStorage.getItem(AUTO_BACKUP_KEY);
        const now = Date.now();

        if (!lastBackup || (now - parseInt(lastBackup)) > AUTO_BACKUP_INTERVAL) {
            performAutoBackup();
        }
    }

    /**
     * Effectue une sauvegarde automatique silencieuse
     */
    function performAutoBackup() {
        try {
            const backup = buildBackupObject();
            saveToLocalHistory(backup);
            localStorage.setItem(AUTO_BACKUP_KEY, Date.now().toString());
            console.log('✅ Sauvegarde automatique effectuée');
        } catch (error) {
            console.warn('Sauvegarde automatique échouée:', error);
        }
    }

    // ============ AFFICHAGE ============

    /**
     * Affiche la section sauvegarde dans les paramètres
     */
    function renderBackupSection() {
        const container = document.getElementById('backup-section');
        if (!container) return;

        const history = getLocalBackups();
        const lastAutoBackup = localStorage.getItem(AUTO_BACKUP_KEY);
        const currentData = MWStorage.exportAll();
        const dataSize = (JSON.stringify(currentData).length / 1024).toFixed(1);

        container.innerHTML = `
            <!-- Statistiques -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem;">
                <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);text-align:center;">
                    <div style="font-size:0.8rem;color:var(--color-text-muted);">Taille des données</div>
                    <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${dataSize} Ko</div>
                </div>
                <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);text-align:center;">
                    <div style="font-size:0.8rem;color:var(--color-text-muted);">Sauvegardes locales</div>
                    <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${history.length}/${MAX_LOCAL_BACKUPS}</div>
                </div>
                <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);text-align:center;">
                    <div style="font-size:0.8rem;color:var(--color-text-muted);">Dernière auto-sauvegarde</div>
                    <div style="font-size:1rem;font-weight:600;color:var(--color-text);">
                        ${lastAutoBackup ? getTimeAgo(new Date(parseInt(lastAutoBackup))) : 'Jamais'}
                    </div>
                </div>
            </div>

            <!-- Actions principales -->
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.5rem;">
                <button type="button" id="btn-backup-export" class="btn btn-primary">
                    💾 Sauvegarder maintenant
                </button>
                <button type="button" id="btn-backup-import" class="btn btn-outline">
                    📥 Restaurer depuis un fichier
                </button>
                ${history.length > 0 ? `
                    <button type="button" id="btn-backup-clear-local" class="btn btn-danger">
                        🗑️ Vider l'historique
                    </button>
                ` : ''}
            </div>

            <!-- Info -->
            <div style="padding:1rem;background:rgba(59,130,246,0.08);border-left:4px solid var(--color-info);border-radius:var(--radius-md);margin-bottom:1.5rem;font-size:0.9rem;">
                <strong>💡 Comment ça marche ?</strong><br>
                • <strong>Sauvegarder</strong> : télécharge un fichier JSON avec toutes vos données (questions, examens, résultats, utilisateurs...).<br>
                • <strong>Restaurer</strong> : remplace toutes les données actuelles par celles d'un fichier de sauvegarde.<br>
                • <strong>Auto-sauvegarde</strong> : une sauvegarde locale est créée automatiquement toutes les 24h.
            </div>

            <!-- Historique local -->
            ${history.length > 0 ? `
                <h4 style="margin-bottom:0.75rem;">📚 Historique des sauvegardes locales</h4>
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                    ${history.map(b => `
                        <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                            <div style="flex:1;min-width:200px;">
                                <div style="font-weight:600;">${new Date(b.date).toLocaleString('fr-FR')}</div>
                                <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.25rem;">
                                    ${b.preview.questions} questions • ${b.preview.exams} examens • ${b.preview.results} résultats
                                </div>
                            </div>
                            <div style="display:flex;gap:0.25rem;">
                                <button type="button" class="btn btn-sm btn-outline" onclick="MWBackup.restoreFromLocal(${b.id})" title="Restaurer">
                                    🔄
                                </button>
                                <button type="button" class="btn btn-sm btn-outline" onclick="MWBackup.exportLocalBackup(${b.id})" title="Exporter en fichier">
                                    📥
                                </button>
                                <button type="button" class="btn btn-sm btn-danger" onclick="MWBackup.deleteLocalBackup(${b.id})" title="Supprimer">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="empty-state" style="padding:2rem;">
                    <div class="empty-state-icon">💾</div>
                    <div class="empty-state-title">Aucune sauvegarde locale</div>
                    <div class="empty-state-text">Cliquez sur "Sauvegarder maintenant" pour créer votre première sauvegarde.</div>
                </div>
            `}
        `;

        // Rebind les événements (car l'innerHTML a remplacé les boutons)
        bindEvents();
    }

    /**
     * Retourne une durée relative
     */
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'À l\'instant';
        if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
        return `Il y a ${Math.floor(seconds / 86400)} j`;
    }

    // ============ API PUBLIQUE ============

    return {
        init,
        exportAllData,
        importFromFile,
        restoreFromLocal,
        exportLocalBackup,
        deleteLocalBackup,
        clearLocalBackups,
        getLocalBackups,
        renderBackupSection
    };
})();