/* ============================================================
   MEGAWATT ACADEMY - Module Firebase (Synchronisation Cloud)
   Version COMPAT (compatible chargement script classique)
   ============================================================ */

const MWFirebase = (() => {
    'use strict';

    let db = null;
    let isInitialized = false;

    // Configuration Firebase
    const config = {
        apiKey: "AIzaSyAaebeeDHzfX06gnYdSB2vzhLBPgVY9REQ",
        authDomain: "megawatt-academy.firebaseapp.com",
        projectId: "megawatt-academy",
        storageBucket: "megawatt-academy.firebasestorage.app",
        messagingSenderId: "1086733973171",
        appId: "1:1086733973171:web:68900214fc7b38e8fea2c6"
    };

    /**
     * Initialise Firebase
     */
    async function init() {
        if (isInitialized) return;
        try {
            // Vérifier que Firebase est chargé
            if (typeof firebase === 'undefined') {
                throw new Error('SDK Firebase non chargé');
            }

            // Initialiser l'app Firebase (API compat)
            firebase.initializeApp(config);
            db = firebase.firestore();
            isInitialized = true;
            console.log('✅ Firebase initialisé avec succès');
        } catch (error) {
            console.error('❌ Erreur initialisation Firebase:', error);
        }
    }

    /**
     * Synchronise les données DU cloud VERS le navigateur (au démarrage)
     */
    async function syncFromFirestore() {
        if (!db) return;
        try {
            const keys = [
                'mw_users',
                'mw_questions',
                'mw_exams',
                'mw_results',
                'mw_certificates',
                'mw_settings',
                'mw_incidents'
            ];

            for (const key of keys) {
                const collectionName = key.replace('mw_', '');
                const docRef = db.collection(collectionName).doc('all');
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                    // Le cloud a des données : on met à jour le navigateur
                    const cloudData = docSnap.data().data;
                    localStorage.setItem(key, JSON.stringify(cloudData));
                    console.log(`📥 ${key} synchronisé depuis le cloud (${Array.isArray(cloudData) ? cloudData.length : 0} éléments)`);
                } else {
                    // Le cloud est vide : on garde les données locales
                    if (!localStorage.getItem(key)) {
                        localStorage.setItem(key, JSON.stringify([]));
                    }
                }
            }
            localStorage.setItem('mw_initialized', 'true');
            console.log('✅ Données synchronisées depuis le cloud');
        } catch (error) {
            console.error('❌ Erreur de synchronisation depuis Firestore:', error);
        }
    }

    /**
     * Synchronise les données DU navigateur VERS le cloud (à chaque modification)
     */
    async function syncToFirestore(key, data) {
        if (!db) return;
        try {
            const collectionName = key.replace('mw_', '');
            await db.collection(collectionName).doc('all').set({
                data: data,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error(`❌ Erreur sync vers Firestore (${key}):`, error);
        }
    }

    return {
        init,
        syncFromFirestore,
        syncToFirestore
    };
})();