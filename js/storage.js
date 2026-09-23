/* ============================================================
   MEGAWATT ACADEMY - Gestionnaire de stockage local
   Gère la persistance des données via localStorage
   ============================================================ */

const MWStorage = (() => {
    'use strict';

    // ============ CLÉS DE STOCKAGE ============
    const KEYS = {
        USERS: 'mw_users',
        QUESTIONS: 'mw_questions',
        EXAMS: 'mw_exams',
        RESULTS: 'mw_results',
        CERTIFICATES: 'mw_certificates',
        SETTINGS: 'mw_settings',
        INCIDENTS: 'mw_incidents',
        SESSION: 'mw_session',
        INITIALIZED: 'mw_initialized'
    };

    // ============ PARAMÈTRES PAR DÉFAUT ============
    const DEFAULT_SETTINGS = {
        bareme: 60,                    // Seuil de réussite (%)
        maxTabChanges: 3,              // Changements d'onglet max
        sessionTimeout: 60,            // Expiration session (minutes)
        web3formsKey: '',              // Clé API Web3Forms
        emailjsService: '',            // EmailJS Service ID
        emailjsTemplate: '',           // EmailJS Template ID
        emailjsUser: '',               // EmailJS User ID
        emailDest: '',                 // Email destinataire RH
        whatsapp: '',                  // Numéro WhatsApp
        logo: 'assets/logo-megawatt.png',      // Logo MEGAWATT
        signature: 'assets/signature-formateur.png' // Signature formateur
    };

    // ============ COMPTE ADMIN PAR DÉFAUT ============
    const DEFAULT_ADMIN = {
        id: 'admin',
        username: 'admin',
        password: hashPassword('Mega2026@'),
        fullname: 'Administrateur',
        email: 'admin@megawatt.com',
        role: 'admin',
        createdAt: new Date().toISOString()
    };

    // ============ UTILITAIRES ============

    /**
     * Génère un ID unique
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Hashage du mot de passe avec CryptoJS
     */
    function hashPassword(password) {
        if (typeof CryptoJS === 'undefined') {
            console.warn('CryptoJS non chargé, hashage basique utilisé');
            return btoa(password);
        }
        return CryptoJS.SHA256(password).toString();
    }

    /**
     * Vérifie un mot de passe
     */
    function verifyPassword(password, hash) {
        return hashPassword(password) === hash;
    }

    /**
     * Génère une référence de certificat unique
     * Format : MW-AAAA-XXXXX
     */
    function generateCertificateRef() {
        const year = new Date().getFullYear();
        const random = Math.floor(10000 + Math.random() * 90000);
        return `MW-${year}-${random}`;
    }

    // ============ MÉTHODES GÉNÉRIQUES DE STOCKAGE ============

    /**
     * Récupère des données depuis localStorage
     */
    function get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Erreur lecture storage [${key}]:`, error);
            return null;
        }
    }

        /**
     * Sauvegarde des données dans localStorage et synchronise avec le cloud
     */
    function set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            
            // ⬇️ EMPÊCHER la synchronisation des données purement locales
            const noSyncKeys = [
                'mw_session', 
                'mw_initialized', 
                'mw_fingerprint', 
                'mw_login_attempts', 
                'mw_tab_changes', 
                'mw_exam_context',
                'mw_local_backups',
                'mw_last_auto_backup'
            ];
            
            if (typeof MWFirebase !== 'undefined' && !noSyncKeys.includes(key)) {
                MWFirebase.syncToFirestore(key, data);
            }
            // ⬆️ FIN DE L'EMPÊCHEMENT
            
            return true;
        } catch (error) {
            console.error(`Erreur écriture storage [${key}]:`, error);
            return false;
        }
    }
    /**
     * Supprime des données du localStorage
     */
    function remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Erreur suppression storage [${key}]:`, error);
            return false;
        }
    }

    // ============ GESTION DES UTILISATEURS ============

    const Users = {
        /**
         * Récupère tous les utilisateurs
         */
        getAll() {
            return get(KEYS.USERS) || [];
        },

        /**
         * Récupère un utilisateur par ID
         */
        getById(id) {
            const users = this.getAll();
            return users.find(u => u.id === id) || null;
        },

        /**
         * Récupère un utilisateur par username
         */
        getByUsername(username) {
            const users = this.getAll();
            return users.find(u => u.username === username) || null;
        },

        /**
         * Crée un nouvel utilisateur
         */
        create(userData) {
            const users = this.getAll();
            
            // Vérifier unicité username
            if (users.some(u => u.username === userData.username)) {
                throw new Error('Cet identifiant existe déjà');
            }

            const newUser = {
                id: generateId(),
                username: userData.username,
                password: hashPassword(userData.password),
                fullname: userData.fullname || '',
                email: userData.email || '',
                role: userData.role || 'apprenant',
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            set(KEYS.USERS, users);
            return newUser;
        },

        /**
         * Met à jour un utilisateur
         */
        update(id, updates) {
            const users = this.getAll();
            const index = users.findIndex(u => u.id === id);
            
            if (index === -1) {
                throw new Error('Utilisateur non trouvé');
            }

            // Si mot de passe modifié, le hasher
            if (updates.password) {
                updates.password = hashPassword(updates.password);
            }

            users[index] = { ...users[index], ...updates };
            set(KEYS.USERS, users);
            return users[index];
        },

        /**
         * Supprime un utilisateur
         */
        delete(id) {
            const users = this.getAll();
            const filtered = users.filter(u => u.id !== id);
            
            if (filtered.length === users.length) {
                throw new Error('Utilisateur non trouvé');
            }

            set(KEYS.USERS, filtered);
            return true;
        },

        /**
         * Authentifie un utilisateur
         */
        authenticate(username, password, role) {
            const user = this.getByUsername(username);
            
            if (!user) {
                return { success: false, error: 'Identifiant incorrect' };
            }

            if (!verifyPassword(password, user.password)) {
                return { success: false, error: 'Mot de passe incorrect' };
            }

            if (role && user.role !== role) {
                return { success: false, error: 'Rôle incorrect' };
            }

            return { success: true, user };
        },

        /**
         * Récupère les utilisateurs par rôle
         */
        getByRole(role) {
            return this.getAll().filter(u => u.role === role);
        }
    };

    // ============ GESTION DES QUESTIONS ============

    const Questions = {
        /**
         * Récupère toutes les questions
         */
        getAll() {
            return get(KEYS.QUESTIONS) || [];
        },

        /**
         * Récupère une question par ID
         */
        getById(id) {
            const questions = this.getAll();
            return questions.find(q => q.id === id) || null;
        },

        /**
         * Crée une nouvelle question
         */
        create(questionData) {
            const questions = this.getAll();
            
            const newQuestion = {
                id: generateId(),
                type: questionData.type || 'single',      // 'single' ou 'multiple'
                question: questionData.question,
                options: questionData.options || [],
                correct: questionData.correct || [],       // Index des bonnes réponses
                points: questionData.points || 1,
                explanation: questionData.explanation || '',
                createdAt: new Date().toISOString()
            };

            questions.push(newQuestion);
            set(KEYS.QUESTIONS, questions);
            return newQuestion;
        },

        /**
         * Met à jour une question
         */
        update(id, updates) {
            const questions = this.getAll();
            const index = questions.findIndex(q => q.id === id);
            
            if (index === -1) {
                throw new Error('Question non trouvée');
            }

            questions[index] = { ...questions[index], ...updates };
            set(KEYS.QUESTIONS, questions);
            return questions[index];
        },

        /**
         * Supprime une question
         */
        delete(id) {
            const questions = this.getAll();
            const filtered = questions.filter(q => q.id !== id);
            
            if (filtered.length === questions.length) {
                throw new Error('Question non trouvée');
            }

            set(KEYS.QUESTIONS, filtered);
            return true;
        },

        /**
         * Importe des questions depuis JSON
         */
        importJSON(jsonData) {
            const questions = this.getAll();
            let imported = 0;

            jsonData.forEach(q => {
                if (q.question && Array.isArray(q.options) && Array.isArray(q.correct)) {
                    questions.push({
                        id: q.id || generateId(),
                        type: q.type || 'single',
                        question: q.question,
                        options: q.options,
                        correct: q.correct,
                        points: q.points || 1,
                        explanation: q.explanation || '',
                        createdAt: q.createdAt || new Date().toISOString()
                    });
                    imported++;
                }
            });

            set(KEYS.QUESTIONS, questions);
            return imported;
        },

        /**
         * Exporte toutes les questions en JSON
         */
        exportJSON() {
            return this.getAll();
        },

        /**
         * Récupère des questions aléatoires
         */
        getRandom(count) {
            const questions = this.getAll();
            const shuffled = [...questions].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, count);
        }
    };

    // ============ GESTION DES EXAMENS ============

    const Exams = {
        /**
         * Récupère tous les examens
         */
        getAll() {
            return get(KEYS.EXAMS) || [];
        },

        /**
         * Récupère un examen par ID
         */
        getById(id) {
            const exams = this.getAll();
            return exams.find(e => e.id === id) || null;
        },

        /**
         * Crée un nouvel examen
         */
        create(examData) {
            const exams = this.getAll();
            
            const newExam = {
                id: generateId(),
                title: examData.title,
                description: examData.description || '',
                duration: examData.duration || 60,          // Durée en minutes
                passingScore: examData.passingScore || 60,  // Seuil de réussite (%)
                questionCount: examData.questionCount || 10,
                shuffleQuestions: examData.shuffleQuestions !== false,
                shuffleAnswers: examData.shuffleAnswers !== false,
                createdAt: new Date().toISOString()
            };

            exams.push(newExam);
            set(KEYS.EXAMS, exams);
            return newExam;
        },

        /**
         * Met à jour un examen
         */
        update(id, updates) {
            const exams = this.getAll();
            const index = exams.findIndex(e => e.id === id);
            
            if (index === -1) {
                throw new Error('Examen non trouvé');
            }

            exams[index] = { ...exams[index], ...updates };
            set(KEYS.EXAMS, exams);
            return exams[index];
        },

        /**
         * Supprime un examen
         */
        delete(id) {
            const exams = this.getAll();
            const filtered = exams.filter(e => e.id !== id);
            
            if (filtered.length === exams.length) {
                throw new Error('Examen non trouvé');
            }

            set(KEYS.EXAMS, filtered);
            return true;
        }
    };

    // ============ GESTION DES RÉSULTATS ============

    const Results = {
        /**
         * Récupère tous les résultats
         */
        getAll() {
            return get(KEYS.RESULTS) || [];
        },

        /**
         * Récupère un résultat par ID
         */
        getById(id) {
            const results = this.getAll();
            return results.find(r => r.id === id) || null;
        },

        /**
         * Enregistre un nouveau résultat
         */
        create(resultData) {
            const results = this.getAll();
            
            const newResult = {
                id: generateId(),
                examId: resultData.examId,
                examTitle: resultData.examTitle,
                candidateId: resultData.candidateId || null,
                candidateName: resultData.candidateName,
                candidateEmail: resultData.candidateEmail,
                candidateService: resultData.candidateService || '',
                candidateFunction: resultData.candidateFunction || '',
                score: resultData.score,
                maxScore: resultData.maxScore,
                percentage: resultData.percentage,
                grade: resultData.grade,                   // Note sur 20
                passed: resultData.passed,
                answers: resultData.answers || [],
                tabChanges: resultData.tabChanges || 0,
                fingerprint: resultData.fingerprint || '',
                signature: resultData.signature || '',
                duration: resultData.duration || 0,
                createdAt: new Date().toISOString()
            };

            results.push(newResult);
            set(KEYS.RESULTS, results);
            return newResult;
        },

        /**
         * Récupère les résultats par examen
         */
        getByExam(examId) {
            return this.getAll().filter(r => r.examId === examId);
        },

        /**
         * Récupère les résultats par candidat
         */
        getByCandidate(candidateEmail) {
            return this.getAll().filter(r => r.candidateEmail === candidateEmail);
        },

        /**
         * Vérifie si un candidat a déjà passé un examen
         */
        hasAttempted(examId, candidateEmail) {
            return this.getAll().some(r => 
                r.examId === examId && r.candidateEmail === candidateEmail
            );
        },

        /**
         * Statistiques globales
         */
        getStats() {
            const results = this.getAll();
            const total = results.length;
            const passed = results.filter(r => r.passed).length;
            const failed = total - passed;
            const average = total > 0 
                ? results.reduce((sum, r) => sum + r.grade, 0) / total 
                : 0;

            return { total, passed, failed, average };
        }
    };

    // ============ GESTION DES CERTIFICATS ============

    const Certificates = {
        /**
         * Récupère tous les certificats
         */
        getAll() {
            return get(KEYS.CERTIFICATES) || [];
        },

        /**
         * Récupère un certificat par référence
         */
        getByRef(ref) {
            const certificates = this.getAll();
            return certificates.find(c => c.reference === ref) || null;
        },

        /**
         * Crée un nouveau certificat
         */
        create(certificateData) {
            const certificates = this.getAll();
            
            const newCertificate = {
                id: generateId(),
                reference: generateCertificateRef(),
                resultId: certificateData.resultId,
                candidateName: certificateData.candidateName,
                candidateEmail: certificateData.candidateEmail,
                examTitle: certificateData.examTitle,
                grade: certificateData.grade,
                percentage: certificateData.percentage,
                signature: certificateData.signature || '',
                issuedAt: new Date().toISOString()
            };

            certificates.push(newCertificate);
            set(KEYS.CERTIFICATES, certificates);
            return newCertificate;
        },

        /**
         * Supprime un certificat
         */
        delete(id) {
            const certificates = this.getAll();
            const filtered = certificates.filter(c => c.id !== id);
            set(KEYS.CERTIFICATES, filtered);
            return true;
        },

        /**
         * Vérifie si un certificat existe
         */
        verify(reference) {
            return this.getByRef(reference);
        }
    };

    // ============ GESTION DES PARAMÈTRES ============

    const Settings = {
        /**
         * Récupère tous les paramètres
         */
        getAll() {
            return get(KEYS.SETTINGS) || { ...DEFAULT_SETTINGS };
        },

        /**
         * Récupère un paramètre spécifique
         */
        get(key) {
            const settings = this.getAll();
            return settings[key];
        },

        /**
         * Met à jour les paramètres
         */
        update(updates) {
            const settings = this.getAll();
            const newSettings = { ...settings, ...updates };
            set(KEYS.SETTINGS, newSettings);
            return newSettings;
        },

        /**
         * Réinitialise aux valeurs par défaut
         */
        reset() {
            set(KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
            return { ...DEFAULT_SETTINGS };
        }
    };

    // ============ GESTION DES INCIDENTS ============

    const Incidents = {
        /**
         * Récupère tous les incidents
         */
        getAll() {
            return get(KEYS.INCIDENTS) || [];
        },

        /**
         * Enregistre un incident
         */
        log(incidentData) {
            const incidents = this.getAll();
            
            const newIncident = {
                id: generateId(),
                type: incidentData.type,                  // 'tab_change', 'fingerprint_mismatch', etc.
                candidateName: incidentData.candidateName,
                candidateEmail: incidentData.candidateEmail,
                examId: incidentData.examId,
                details: incidentData.details || '',
                fingerprint: incidentData.fingerprint || '',
                createdAt: new Date().toISOString()
            };

            incidents.push(newIncident);
            set(KEYS.INCIDENTS, incidents);
            return newIncident;
        },

        /**
         * Récupère les incidents par candidat
         */
        getByCandidate(candidateEmail) {
            return this.getAll().filter(i => i.candidateEmail === candidateEmail);
        },

        /**
         * Compte total d'incidents
         */
        count() {
            return this.getAll().length;
        }
    };

    // ============ GESTION DE LA SESSION ============

    const Session = {
        /**
         * Crée une session
         */
        create(user) {
            const session = {
                userId: user.id,
                username: user.username,
                fullname: user.fullname,
                role: user.role,
                email: user.email,
                loginAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };
            set(KEYS.SESSION, session);
            return session;
        },

        /**
         * Récupère la session active
         */
        get() {
            const session = get(KEYS.SESSION);
            
            if (!session) {
                return null;
            }

            // Vérifier expiration
            const settings = Settings.getAll();
            const timeout = settings.sessionTimeout * 60 * 1000; // Convertir en ms
            const lastActivity = new Date(session.lastActivity).getTime();
            const now = Date.now();

            if (now - lastActivity > timeout) {
                this.destroy();
                return null;
            }

            return session;
        },

        /**
         * Met à jour l'activité de la session
         */
        updateActivity() {
            const session = this.get();
            if (session) {
                session.lastActivity = new Date().toISOString();
                set(KEYS.SESSION, session);
            }
        },

        /**
         * Détruit la session
         */
        destroy() {
            remove(KEYS.SESSION);
        },

        /**
         * Vérifie si une session est active
         */
        isActive() {
            return this.get() !== null;
        }
    };

      /**
     * Initialise le stockage avec les données par défaut et synchronise avec le cloud
     */
    async function initialize() { // ⬅️ AJOUT DU MOT "async" ICI
        
        // ⬇️ AJOUT : Synchronisation depuis le cloud au démarrage
        if (typeof MWFirebase !== 'undefined') {
            await MWFirebase.init();
            await MWFirebase.syncFromFirestore();
        }
        // ⬆️ FIN AJOUT

        // Vérifier si déjà initialisé (après la synchro cloud)
        if (get(KEYS.INITIALIZED)) {
            return;
        }

        // Créer compte admin par défaut
        const users = [DEFAULT_ADMIN];
        set(KEYS.USERS, users);

        // Initialiser paramètres par défaut
        set(KEYS.SETTINGS, { ...DEFAULT_SETTINGS });

        // Initialiser collections vides
        set(KEYS.QUESTIONS, []);
        set(KEYS.EXAMS, []);
        set(KEYS.RESULTS, []);
        set(KEYS.CERTIFICATES, []);
        set(KEYS.INCIDENTS, []);

        // Marquer comme initialisé
        set(KEYS.INITIALIZED, true);

        // ⬇️ AJOUT : Pousser les données par défaut vers le cloud si c'est la toute première fois
        if (typeof MWFirebase !== 'undefined') {
            await MWFirebase.syncToFirestore(KEYS.USERS, users);
            await MWFirebase.syncToFirestore(KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
        }
        // ⬆️ FIN AJOUT

        console.log('✅ MEGAWATT ACADEMY - Stockage initialisé et synchronisé');
    }

    // ============ EXPORT / IMPORT GLOBAL ============

    /**
     * Exporte toutes les données
     */
    function exportAll() {
        return {
            users: Users.getAll(),
            questions: Questions.getAll(),
            exams: Exams.getAll(),
            results: Results.getAll(),
            certificates: Certificates.getAll(),
            settings: Settings.getAll(),
            incidents: Incidents.getAll(),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Importe toutes les données
     */
    function importAll(data) {
        if (data.users) set(KEYS.USERS, data.users);
        if (data.questions) set(KEYS.QUESTIONS, data.questions);
        if (data.exams) set(KEYS.EXAMS, data.exams);
        if (data.results) set(KEYS.RESULTS, data.results);
        if (data.certificates) set(KEYS.CERTIFICATES, data.certificates);
        if (data.settings) set(KEYS.SETTINGS, data.settings);
        if (data.incidents) set(KEYS.INCIDENTS, data.incidents);
        return true;
    }

    /**
     * Réinitialise complètement le stockage
     */
    function resetAll() {
        Object.values(KEYS).forEach(key => remove(key));
        initialize();
    }

    // ============ API PUBLIQUE ============

    return {
        // Utilitaires
        generateId,
        hashPassword,
        verifyPassword,
        generateCertificateRef,

        // Entités
        Users,
        Questions,
        Exams,
        Results,
        Certificates,
        Settings,
        Incidents,
        Session,

        // Global
        initialize,
        exportAll,
        importAll,
        resetAll,

        // Keys (pour debug)
        KEYS
    };
})();

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    MWStorage.initialize();
});