/* ============================================================
   MEGAWATT ACADEMY - Module Firebase (Synchronisation Cloud)
   ============================================================ */

const MWFirebase = (() => {
    'use strict';

    let db = null;
    let isInitialized = false;

    // Votre configuration Firebase
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
            const { initializeApp } = firebase;
            const { getFirestore } = firebase.firestore;
            
            const app = initializeApp(config);
            db = getFirestore(app);
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
            const { collection, doc, getDoc } = firebase.firestore;
            const keys = ['mw_users', 'mw_questions', 'mw_exams', 'mw_results', 'mw_certificates', 'mw_settings', 'mw_incidents'];
            
            for (const key of keys) {
                const collectionName = key.replace('mw_', '');
                const docRef = doc(db, collectionName, 'all');
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    // Le cloud a des données : on met à jour le navigateur
                    localStorage.setItem(key, JSON.stringify(docSnap.data().data));
                } else {
                    // Le cloud est vide : on garde les données locales (pour la migration)
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
            const { doc, setDoc } = firebase.firestore;
            const collectionName = key.replace('mw_', '');
            
            await setDoc(doc(db, collectionName, 'all'), { 
                data: data, 
                updatedAt: new Date().toISOString() 
            });
        } catch (error) {
            console.error(`❌ Erreur de synchronisation vers Firestore (${key}):`, error);
        }
    }

    return { init, syncFromFirestore, syncToFirestore };
})();