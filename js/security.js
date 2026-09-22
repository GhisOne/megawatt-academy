/* ============================================================
   MEGAWATT ACADEMY - Module de sécurité
   Gestion fingerprint, anti-fraude, protection tentatives
   ============================================================ */

const MWSecurity = (() => {
    'use strict';

    // ============ CONSTANTES ============
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    const FINGERPRINT_KEY = 'mw_fingerprint';
    const LOGIN_ATTEMPTS_KEY = 'mw_login_attempts';
    const TAB_CHANGES_KEY = 'mw_tab_changes';

    // ============ GESTION FINGERPRINT ============

    /**
     * Génère une empreinte unique du navigateur
     * Combine plusieurs caractéristiques pour créer un ID unique
     */
    function generateFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('MEGAWATT-FP', 2, 2);

        const components = {
            // Informations navigateur
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            deviceMemory: navigator.deviceMemory || 0,
            
            // Écran
            screenWidth: screen.width,
            screenHeight: screen.height,
            screenColorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio || 1,
            
            // Fuseau horaire
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            
            // Canvas fingerprint
            canvas: canvas.toDataURL(),
            
            // WebGL (si disponible)
            webglVendor: getWebGLVendor(),
            
            // Touch support
            touchSupport: getTouchSupport(),
            
            // Plugins (limité dans les navigateurs modernes)
            pluginsCount: navigator.plugins ? navigator.plugins.length : 0
        };

        // Créer un hash de tous les composants
        const fingerprintString = JSON.stringify(components);
        const hash = hashString(fingerprintString);

        return {
            id: hash,
            components: components,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Récupère le vendor WebGL
     */
    function getWebGLVendor() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    return gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                }
            }
        } catch (e) {
            // WebGL non disponible
        }
        return 'unknown';
    }

    /**
     * Détecte le support tactile
     */
    function getTouchSupport() {
        let maxTouchPoints = 0;
        let touchEvent = false;
        
        if (typeof navigator.maxTouchPoints !== 'undefined') {
            maxTouchPoints = navigator.maxTouchPoints;
        } else if (typeof navigator.msMaxTouchPoints !== 'undefined') {
            maxTouchPoints = navigator.msMaxTouchPoints;
        }
        
        try {
            document.createEvent('TouchEvent');
            touchEvent = true;
        } catch (e) {
            touchEvent = false;
        }

        const touchStart = 'ontouchstart' in window;
        
        return {
            maxTouchPoints,
            touchEvent,
            touchStart
        };
    }

    /**
     * Hash simple d'une chaîne (FNV-1a)
     */
    function hashString(str) {
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    /**
     * Sauvegarde le fingerprint actuel
     */
    function saveFingerprint() {
        const fp = generateFingerprint();
        localStorage.setItem(FINGERPRINT_KEY, JSON.stringify(fp));
        return fp;
    }

    /**
     * Récupère le fingerprint sauvegardé
     */
    function getSavedFingerprint() {
        const data = localStorage.getItem(FINGERPRINT_KEY);
        return data ? JSON.parse(data) : null;
    }

    /**
     * Vérifie si le fingerprint a changé
     */
    function verifyFingerprint() {
        const saved = getSavedFingerprint();
        if (!saved) {
            return { valid: false, reason: 'Aucun fingerprint sauvegardé' };
        }

        const current = generateFingerprint();
        
        if (current.id !== saved.id) {
            return {
                valid: false,
                reason: 'Empreinte navigateur modifiée',
                saved: saved.id,
                current: current.id
            };
        }

        return { valid: true };
    }

    // ============ GESTION TENTATIVES DE CONNEXION ============

    /**
     * Récupère les tentatives de connexion
     */
    function getLoginAttempts() {
        const data = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
        return data ? JSON.parse(data) : { count: 0, lockedUntil: null };
    }

    /**
     * Enregistre une tentative échouée
     */
    function recordFailedAttempt(username) {
        const attempts = getLoginAttempts();
        attempts.count++;
        
        // Bloquer si max atteint
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
            attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
            
            // Logger l'incident
            MWStorage.Incidents.log({
                type: 'login_lockout',
                candidateName: username,
                candidateEmail: '',
                examId: '',
                details: `Compte bloqué après ${MAX_LOGIN_ATTEMPTS} tentatives échouées`,
                fingerprint: getSavedFingerprint()?.id || ''
            });
        }
        
        localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
        return attempts;
    }

    /**
     * Réinitialise les tentatives après connexion réussie
     */
    function resetLoginAttempts() {
        localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    }

    /**
     * Vérifie si le compte est bloqué
     */
    function isAccountLocked() {
        const attempts = getLoginAttempts();
        
        if (!attempts.lockedUntil) {
            return { locked: false };
        }

        const now = Date.now();
        if (now < attempts.lockedUntil) {
            const remainingMs = attempts.lockedUntil - now;
            const remainingMin = Math.ceil(remainingMs / 60000);
            return {
                locked: true,
                remainingMinutes: remainingMin,
                lockedUntil: new Date(attempts.lockedUntil).toISOString()
            };
        }

        // Déblocage automatique
        resetLoginAttempts();
        return { locked: false };
    }

    /**
     * Authentification sécurisée
     */
    function secureLogin(username, password, role) {
        // Vérifier blocage
        const lockStatus = isAccountLocked();
        if (lockStatus.locked) {
            return {
                success: false,
                error: `Compte temporairement bloqué. Réessayez dans ${lockStatus.remainingMinutes} minute(s).`
            };
        }

        // Tenter l'authentification
        const authResult = MWStorage.Users.authenticate(username, password, role);
        
        if (!authResult.success) {
            // Enregistrer tentative échouée
            recordFailedAttempt(username);
            
            // Logger l'incident
            MWStorage.Incidents.log({
                type: 'login_failed',
                candidateName: username,
                candidateEmail: '',
                examId: '',
                details: `Tentative de connexion échouée: ${authResult.error}`,
                fingerprint: getSavedFingerprint()?.id || ''
            });
            
            const attempts = getLoginAttempts();
            const remaining = MAX_LOGIN_ATTEMPTS - attempts.count;
            
            return {
                success: false,
                error: authResult.error,
                attemptsRemaining: remaining
            };
        }

        // Connexion réussie
        resetLoginAttempts();
        saveFingerprint();
        
        return {
            success: true,
            user: authResult.user
        };
    }

    // ============ DÉTECTION CHANGEMENT D'ONGLET ============

    let tabChangeCount = 0;
    let tabChangeCallback = null;
    let isExamActive = false;

    /**
     * Démarre la surveillance des changements d'onglet
     */
    function startTabMonitoring(callback) {
        tabChangeCallback = callback;
        tabChangeCount = 0;
        isExamActive = true;
        
        // Sauvegarder le compteur
        localStorage.setItem(TAB_CHANGES_KEY, JSON.stringify({
            count: 0,
            examStartedAt: new Date().toISOString()
        }));

        // Écouter les événements de visibilité
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Écouter blur/focus (backup)
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);
    }

    /**
     * Arrête la surveillance
     */
    function stopTabMonitoring() {
        isExamActive = false;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        localStorage.removeItem(TAB_CHANGES_KEY);
    }

    /**
     * Gère le changement de visibilité
     */
    function handleVisibilityChange() {
        if (!isExamActive) return;

        if (document.hidden) {
            registerTabChange('visibilitychange');
        }
    }

    /**
     * Gère la perte de focus
     */
    function handleWindowBlur() {
        if (!isExamActive) return;
        registerTabChange('blur');
    }

    /**
     * Gère le regain de focus
     */
    function handleWindowFocus() {
        // Rien à faire, juste pour tracker
    }

    /**
     * Enregistre un changement d'onglet
     */
    function registerTabChange(source) {
        tabChangeCount++;
        
        // Sauvegarder
        localStorage.setItem(TAB_CHANGES_KEY, JSON.stringify({
            count: tabChangeCount,
            lastChange: new Date().toISOString(),
            source: source
        }));

        // Logger l'incident
        const session = MWStorage.Session.get();
        if (session) {
            MWStorage.Incidents.log({
                type: 'tab_change',
                candidateName: session.fullname,
                candidateEmail: session.email,
                examId: '',
                details: `Changement d'onglet détecté (${source}). Total: ${tabChangeCount}`,
                fingerprint: getSavedFingerprint()?.id || ''
            });
        }

        // Callback
        if (tabChangeCallback) {
            const maxChanges = MWStorage.Settings.get('maxTabChanges') || 3;
            tabChangeCallback({
                count: tabChangeCount,
                max: maxChanges,
                exceeded: tabChangeCount > maxChanges,
                source: source
            });
        }
    }

    /**
     * Récupère le nombre de changements d'onglet
     */
    function getTabChangeCount() {
        const data = localStorage.getItem(TAB_CHANGES_KEY);
        return data ? JSON.parse(data).count : 0;
    }

    /**
     * Réinitialise le compteur de changements d'onglet
     */
    function resetTabChangeCount() {
        tabChangeCount = 0;
        localStorage.removeItem(TAB_CHANGES_KEY);
    }

    // ============ PROTECTION CONTEXTE EXAMEN ============

    /**
     * Active les protections pendant un examen
     */
    function enableExamProtections(examId, candidateEmail) {
        // Désactiver copier-coller
        document.addEventListener('copy', preventCopyPaste);
        document.addEventListener('cut', preventCopyPaste);
        document.addEventListener('paste', preventCopyPaste);
        
        // Désactiver clic droit
        document.addEventListener('contextmenu', preventContextMenu);
        
        // Désactiver raccourcis clavier suspects
        document.addEventListener('keydown', preventShortcuts);

        // Sauvegarder le contexte
        localStorage.setItem('mw_exam_context', JSON.stringify({
            examId,
            candidateEmail,
            startedAt: new Date().toISOString(),
            fingerprint: getSavedFingerprint()?.id
        }));
    }

    /**
     * Désactive les protections
     */
    function disableExamProtections() {
        document.removeEventListener('copy', preventCopyPaste);
        document.removeEventListener('cut', preventCopyPaste);
        document.removeEventListener('paste', preventCopyPaste);
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('keydown', preventShortcuts);
        localStorage.removeItem('mw_exam_context');
    }

    /**
     * Empêche copier-coller
     */
    function preventCopyPaste(e) {
        e.preventDefault();
        showToast('warning', 'Copier-coller désactivé', 'Cette action n\'est pas autorisée pendant l\'examen.');
    }

    /**
     * Empêche le clic droit
     */
    function preventContextMenu(e) {
        e.preventDefault();
        showToast('warning', 'Menu contextuel désactivé', 'Le clic droit n\'est pas autorisé pendant l\'examen.');
    }

    /**
     * Empêche les raccourcis clavier suspects
     */
    function preventShortcuts(e) {
        // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+P, Ctrl+S, F12
        if (
            (e.ctrlKey && ['c', 'v', 'x', 'p', 's', 'u'].includes(e.key.toLowerCase())) ||
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
        ) {
            e.preventDefault();
            showToast('warning', 'Raccourci bloqué', 'Ce raccourci n\'est pas autorisé pendant l\'examen.');
        }
    }

    /**
     * Affiche un toast (helper)
     */
    function showToast(type, title, message) {
        // Sera implémenté dans app.js
        if (typeof window.MWApp !== 'undefined' && window.MWApp.showToast) {
            window.MWApp.showToast(type, title, message);
        } else {
            console.warn(`[${type}] ${title}: ${message}`);
        }
    }

    // ============ VÉRIFICATION INTÉGRITÉ ============

    /**
     * Vérifie l'intégrité du contexte d'examen
     */
    function verifyExamContext() {
        const context = localStorage.getItem('mw_exam_context');
        if (!context) {
            return { valid: false, reason: 'Aucun contexte d\'examen trouvé' };
        }

        const ctx = JSON.parse(context);
        const currentFp = getSavedFingerprint();

        if (!currentFp || currentFp.id !== ctx.fingerprint) {
            return {
                valid: false,
                reason: 'Empreinte navigateur modifiée pendant l\'examen',
                context: ctx
            };
        }

        return { valid: true, context: ctx };
    }

    // ============ SÉCURITÉ URL ============

    /**
     * Échappe les caractères HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Valide un email
     */
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * Valide un mot de passe fort
     */
    function isStrongPassword(password) {
        // Minimum 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regex.test(password);
    }

    /**
     * Génère un token aléatoire
     */
    function generateToken(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            token += chars[array[i] % chars.length];
        }
        return token;
    }

    // ============ PROTECTION CSRF ============

    /**
     * Génère un token CSRF
     */
    function generateCSRFToken() {
        const token = generateToken(32);
        sessionStorage.setItem('mw_csrf_token', token);
        return token;
    }

    /**
     * Vérifie un token CSRF
     */
    function verifyCSRFToken(token) {
        const stored = sessionStorage.getItem('mw_csrf_token');
        return stored === token;
    }

    // ============ RATE LIMITING ============

    const rateLimitStore = new Map();

    /**
     * Vérifie le rate limiting
     */
    function checkRateLimit(action, maxRequests = 10, windowMs = 60000) {
        const now = Date.now();
        const key = `${action}_${getSavedFingerprint()?.id || 'unknown'}`;
        
        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, []);
        }

        const requests = rateLimitStore.get(key);
        
        // Nettoyer les anciennes requêtes
        const validRequests = requests.filter(time => now - time < windowMs);
        rateLimitStore.set(key, validRequests);

        if (validRequests.length >= maxRequests) {
            return {
                allowed: false,
                retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
            };
        }

        validRequests.push(now);
        return { allowed: true };
    }

    // ============ API PUBLIQUE ============

    return {
        // Fingerprint
        generateFingerprint,
        saveFingerprint,
        getSavedFingerprint,
        verifyFingerprint,

        // Tentatives de connexion
        secureLogin,
        isAccountLocked,
        resetLoginAttempts,
        getLoginAttempts,

        // Surveillance onglets
        startTabMonitoring,
        stopTabMonitoring,
        getTabChangeCount,
        resetTabChangeCount,

        // Protections examen
        enableExamProtections,
        disableExamProtections,
        verifyExamContext,

        // Utilitaires sécurité
        escapeHtml,
        isValidEmail,
        isStrongPassword,
        generateToken,
        generateCSRFToken,
        verifyCSRFToken,
        checkRateLimit,

        // Constantes
        MAX_LOGIN_ATTEMPTS,
        LOCKOUT_DURATION
    };
})();