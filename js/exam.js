/* ============================================================
   MEGAWATT ACADEMY - Module Examen (Apprenant)
   Flux complet : info → examen → signature → correction
   ============================================================ */

const MWExam = (() => {
    'use strict';

    // ============ ÉTAT INTERNE ============
    let currentExam = null;           // Examen en cours
    let currentQuestions = [];        // Questions tirées
    let currentAnswers = {};          // Réponses du candidat {questionId: [indexes]}
    let reviewList = new Set();       // Questions marquées à revoir
    let currentQuestionIndex = 0;     // Index question actuelle
    let timerInterval = null;         // Intervalle du chronomètre
    let timeRemaining = 0;            // Temps restant (secondes)
    let examStartTime = null;         // Début de l'examen
    let candidateInfo = null;         // Infos candidat
    let signatureData = '';           // Signature encodée (dataURL)
    let isDrawing = false;            // État du tracé signature
    let lastX = 0;
    let lastY = 0;
    let autoSaveInterval = null;      // Sauvegarde automatique

    // ============ INITIALISATION ============

    /**
     * Initialise le module examen
     */
    function init() {
        bindLearnerEvents();
        populateExamSelect();
    }

    /**
     * Lie les événements de l'apprenant
     */
    function bindLearnerEvents() {
        // Étape 1 : démarrage
        const btnStart = document.getElementById('btn-start-exam');
        if (btnStart) btnStart.addEventListener('click', startExam);

        // Étape 2 : navigation
        const btnPrev = document.getElementById('btn-prev-question');
        const btnNext = document.getElementById('btn-next-question');
        const btnSubmit = document.getElementById('btn-submit-exam');
        const btnMark = document.getElementById('btn-mark-review');

        if (btnPrev) btnPrev.addEventListener('click', prevQuestion);
        if (btnNext) btnNext.addEventListener('click', nextQuestion);
        if (btnSubmit) btnSubmit.addEventListener('click', goToSignature);
        if (btnMark) btnMark.addEventListener('click', toggleReview);

        // Étape 3 : signature
        const btnClear = document.getElementById('btn-clear-signature');
        const btnValidate = document.getElementById('btn-validate-signature');

        if (btnClear) btnClear.addEventListener('click', clearSignature);
        if (btnValidate) btnValidate.addEventListener('click', validateAndSubmit);

        // Canvas signature
        initSignatureCanvas();
    }

    /**
     * Remplit le select des examens disponibles
     */
    function populateExamSelect() {
        const select = document.getElementById('learner-exam');
        if (!select) return;

        const exams = MWStorage.Exams.getAll();
        select.innerHTML = '<option value="">-- Choisir un examen --</option>';
        
        exams.forEach(e => {
            const option = document.createElement('option');
            option.value = e.id;
            option.textContent = `${e.title} (${e.duration} min, ${e.questionCount} questions)`;
            select.appendChild(option);
        });
    }

    // ============ ÉTAPE 1 : DÉMARRAGE ============

    /**
     * Démarre l'examen après validation des infos candidat
     */
    function startExam() {
        // Récupérer les infos
        const lastname = document.getElementById('learner-lastname').value.trim();
        const firstname = document.getElementById('learner-firstname').value.trim();
        const email = document.getElementById('learner-email').value.trim();
        const service = document.getElementById('learner-service').value.trim();
        const func = document.getElementById('learner-function').value.trim();
        const examId = document.getElementById('learner-exam').value;

        // Validations
        if (!lastname || !firstname || !email || !examId) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Veuillez remplir tous les champs obligatoires.');
            }
            return;
        }

        if (!MWSecurity.isValidEmail(email)) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Adresse email invalide.');
            }
            return;
        }

        // Vérifier tentative unique
        if (MWStorage.Results.hasAttempted(examId, email)) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Tentative unique', 'Vous avez déjà passé cet examen.');
            }
            return;
        }

        // Récupérer l'examen
        const exam = MWStorage.Exams.getById(examId);
        if (!exam) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Examen introuvable.');
            }
            return;
        }

        // Vérifier qu'il y a assez de questions
        const totalQuestions = MWStorage.Questions.getAll().length;
        if (totalQuestions < exam.questionCount) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', `Banque de questions insuffisante (${totalQuestions}/${exam.questionCount}).`);
            }
            return;
        }

        // Sauvegarder les infos candidat
        candidateInfo = {
            lastname,
            firstname,
            email,
            service,
            function: func,
            fullname: `${firstname} ${lastname}`
        };

        currentExam = exam;

        // Tirer les questions
        let questions = exam.shuffleQuestions 
            ? MWStorage.Questions.getRandom(exam.questionCount)
            : MWStorage.Questions.getAll().slice(0, exam.questionCount);

        // Mélanger les réponses si demandé
        if (exam.shuffleAnswers) {
            questions = questions.map(q => shuffleQuestionAnswers(q));
        }

        currentQuestions = questions;
        currentAnswers = {};
        reviewList = new Set();
        currentQuestionIndex = 0;
        examStartTime = new Date();
        timeRemaining = exam.duration * 60;

        // Sauvegarder le contexte de sécurité
        MWSecurity.enableExamProtections(exam.id, email);

        // Démarrer la surveillance des onglets
        MWSecurity.startTabMonitoring(handleTabChange);

        // Passer à l'étape 2
        showStep(2);
        renderQuestion();
        startTimer();
        startAutoSave();

        if (typeof MWApp !== 'undefined') {
            MWApp.showToast('info', 'Examen démarré', `Vous avez ${exam.duration} minutes. Bonne chance !`);
        }
    }

    /**
     * Mélange les réponses d'une question (et ajuste les index corrects)
     */
    function shuffleQuestionAnswers(question) {
        const options = question.options.map((opt, idx) => ({
            text: opt,
            wasCorrect: question.correct.includes(idx)
        }));

        // Mélanger
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        // Recalculer les index corrects
        const newCorrect = [];
        const newOptions = [];
        options.forEach((opt, idx) => {
            newOptions.push(opt.text);
            if (opt.wasCorrect) newCorrect.push(idx);
        });

        return {
            ...question,
            options: newOptions,
            correct: newCorrect
        };
    }

    // ============ ÉTAPE 2 : EXAMEN EN COURS ============

    /**
     * Affiche la question courante
     */
    function renderQuestion() {
        const container = document.getElementById('exam-question-container');
        if (!container || !currentQuestions[currentQuestionIndex]) return;

        const q = currentQuestions[currentQuestionIndex];
        const answer = currentAnswers[q.id] || [];
        const isReview = reviewList.has(q.id);
        const inputType = q.type === 'single' ? 'radio' : 'checkbox';

        container.innerHTML = `
            <div class="question-points">${q.points} point${q.points > 1 ? 's' : ''}</div>
            <div class="question-text">
                ${currentQuestionIndex + 1}. ${MWSecurity.escapeHtml(q.question)}
                ${isReview ? ' <span class="badge badge-warning" style="vertical-align:middle;">🚩 À revoir</span>' : ''}
            </div>
            <ul class="options-list">
                ${q.options.map((opt, idx) => `
                    <li class="option-item ${answer.includes(idx) ? 'selected' : ''}" data-index="${idx}">
                        <input type="${inputType}" 
                               name="q-${q.id}" 
                               id="opt-${q.id}-${idx}"
                               value="${idx}"
                               ${answer.includes(idx) ? 'checked' : ''}
                               onchange="MWExam.selectAnswer(${idx})" />
                        <label for="opt-${q.id}-${idx}">${MWSecurity.escapeHtml(opt)}</label>
                    </li>
                `).join('')}
            </ul>
        `;

        // Mettre à jour la progression
        updateProgress();
        updateNavigationButtons();
    }

    /**
     * Sélectionne une réponse
     */
    function selectAnswer(optionIndex) {
        const q = currentQuestions[currentQuestionIndex];
        if (!q) return;

        if (q.type === 'single') {
            currentAnswers[q.id] = [optionIndex];
        } else {
            const current = currentAnswers[q.id] || [];
            const pos = current.indexOf(optionIndex);
            if (pos > -1) {
                current.splice(pos, 1);
            } else {
                current.push(optionIndex);
            }
            currentAnswers[q.id] = current;
        }

        renderQuestion();
    }

    /**
     * Question suivante
     */
    function nextQuestion() {
        if (currentQuestionIndex < currentQuestions.length - 1) {
            currentQuestionIndex++;
            renderQuestion();
        }
    }

    /**
     * Question précédente
     */
    function prevQuestion() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderQuestion();
        }
    }

    /**
     * Bascule le marquage à revoir
     */
    function toggleReview() {
        const q = currentQuestions[currentQuestionIndex];
        if (!q) return;

        if (reviewList.has(q.id)) {
            reviewList.delete(q.id);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('info', 'Marquage retiré', 'Question retirée de la liste à revoir.');
            }
        } else {
            reviewList.add(q.id);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Marquée à revoir', 'Vous pourrez y revenir plus tard.');
            }
        }
        renderQuestion();
    }

    /**
     * Met à jour la barre de progression
     */
    function updateProgress() {
        const progressText = document.getElementById('exam-progress-text');
        const progressFill = document.getElementById('exam-progress-fill');
        
        if (progressText) {
            progressText.textContent = `Question ${currentQuestionIndex + 1} / ${currentQuestions.length}`;
        }
        if (progressFill) {
            const percent = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
            progressFill.style.width = `${percent}%`;
        }
    }

    /**
     * Met à jour les boutons de navigation
     */
    function updateNavigationButtons() {
        const btnPrev = document.getElementById('btn-prev-question');
        const btnNext = document.getElementById('btn-next-question');
        const btnSubmit = document.getElementById('btn-submit-exam');

        if (btnPrev) btnPrev.disabled = currentQuestionIndex === 0;
        
        const isLast = currentQuestionIndex === currentQuestions.length - 1;
        if (btnNext) btnNext.style.display = isLast ? 'none' : '';
        if (btnSubmit) btnSubmit.style.display = isLast ? '' : 'none';
    }

    // ============ CHRONOMÈTRE ============

    /**
     * Démarre le chronomètre
     */
    function startTimer() {
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();

            // Alerte à 1 minute
            if (timeRemaining === 60) {
                if (typeof MWApp !== 'undefined') {
                    MWApp.showToast('warning', '⚠️ Attention', 'Il ne vous reste plus qu\'1 minute !');
                }
            }

            // Fin du temps
            if (timeRemaining <= 0) {
                stopTimer();
                if (typeof MWApp !== 'undefined') {
                    MWApp.showToast('danger', 'Temps écoulé', 'L\'examen va être soumis automatiquement.');
                }
                setTimeout(() => goToSignature(), 1500);
            }
        }, 1000);
    }

    /**
     * Arrête le chronomètre
     */
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    /**
     * Met à jour l'affichage du timer
     */
    function updateTimerDisplay() {
        const timerEl = document.getElementById('exam-timer');
        if (!timerEl) return;

        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Couleur rouge si < 1 min
        if (timeRemaining < 60) {
            timerEl.style.color = '#ff6b6b';
            timerEl.style.animation = 'pulse 1s ease infinite';
        }
    }

    // ============ SAUVEGARDE AUTOMATIQUE ============

    /**
     * Démarre la sauvegarde automatique
     */
    function startAutoSave() {
        autoSaveInterval = setInterval(() => {
            saveExamProgress();
        }, 10000); // Toutes les 10 secondes
    }

    /**
     * Arrête la sauvegarde automatique
     */
    function stopAutoSave() {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
            autoSaveInterval = null;
        }
    }

    /**
     * Sauvegarde la progression
     */
    function saveExamProgress() {
        const progress = {
            examId: currentExam?.id,
            candidateInfo,
            questions: currentQuestions,
            answers: currentAnswers,
            reviewList: Array.from(reviewList),
            currentIndex: currentQuestionIndex,
            timeRemaining,
            startedAt: examStartTime?.toISOString()
        };
        localStorage.setItem('mw_exam_progress', JSON.stringify(progress));
    }

    /**
     * Restaure la progression (si interruption)
     */
    function restoreExamProgress() {
        const data = localStorage.getItem('mw_exam_progress');
        if (!data) return false;

        try {
            const progress = JSON.parse(data);
            currentExam = MWStorage.Exams.getById(progress.examId);
            candidateInfo = progress.candidateInfo;
            currentQuestions = progress.questions;
            currentAnswers = progress.answers || {};
            reviewList = new Set(progress.reviewList || []);
            currentQuestionIndex = progress.currentIndex || 0;
            timeRemaining = progress.timeRemaining;
            examStartTime = new Date(progress.startedAt);

            if (!currentExam) return false;

            MWSecurity.enableExamProtections(currentExam.id, candidateInfo.email);
            MWSecurity.startTabMonitoring(handleTabChange);

            showStep(2);
            renderQuestion();
            startTimer();
            startAutoSave();

            localStorage.removeItem('mw_exam_progress');
            return true;
        } catch (e) {
            console.error('Erreur restauration:', e);
            return false;
        }
    }

    // ============ GESTION CHANGEMENT D'ONGLET ============

    /**
     * Callback quand un changement d'onglet est détecté
     */
    function handleTabChange(data) {
        const warning = document.getElementById('tab-change-warning');
        if (warning) {
            warning.style.display = 'inline-flex';
            warning.textContent = `⚠️ Changement d'onglet détecté (${data.count}/${data.max})`;
        }

        if (data.exceeded) {
            // Correction automatique (pénalité)
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', '🚨 Fraude détectée', 'Trop de changements d\'onglet. Votre copie sera pénalisée.');
            }
            // On soumet automatiquement
            setTimeout(() => {
                submitExam(true); // true = auto-submit pour fraude
            }, 2000);
        } else {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Attention', `Changement d'onglet détecté (${data.count}/${data.max}). Au-delà, votre copie sera corrigée automatiquement.`);
            }
        }
    }

    // ============ ÉTAPE 3 : SIGNATURE ============

    /**
     * Passe à l'étape de signature
     */
    function goToSignature() {
        // Vérifier qu'au moins une question est répondue
        const answeredCount = Object.keys(currentAnswers).length;
        if (answeredCount === 0) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Attention', 'Vous n\'avez répondu à aucune question.');
            }
            if (!confirm('Vous n\'avez répondu à aucune question. Voulez-vous vraiment terminer ?')) {
                return;
            }
        } else if (answeredCount < currentQuestions.length) {
            const unanswered = currentQuestions.length - answeredCount;
            if (!confirm(`Il reste ${unanswered} question(s) sans réponse. Continuer ?`)) {
                return;
            }
        }

        stopTimer();
        stopAutoSave();
        showStep(3);
        clearSignature();
    }

    /**
     * Initialise le canvas de signature
     */
    function initSignatureCanvas() {
        const canvas = document.getElementById('signature-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#056a30';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Souris
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        // Tactile
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            startDrawing({
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top
            });
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            draw({
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top
            });
        });
        canvas.addEventListener('touchend', stopDrawing);
    }

    /**
     * Démarre le tracé
     */
    function startDrawing(e) {
        isDrawing = true;
        const canvas = document.getElementById('signature-canvas');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        lastX = (e.offsetX || 0) * scaleX;
        lastY = (e.offsetY || 0) * scaleY;
    }

    /**
     * Trace
     */
    function draw(e) {
        if (!isDrawing) return;
        const canvas = document.getElementById('signature-canvas');
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.offsetX || 0) * scaleX;
        const y = (e.offsetY || 0) * scaleY;

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        lastX = x;
        lastY = y;
    }

    /**
     * Arrête le tracé
     */
    function stopDrawing() {
        isDrawing = false;
    }

    /**
     * Efface la signature
     */
    function clearSignature() {
        const canvas = document.getElementById('signature-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        signatureData = '';
    }

    /**
     * Vérifie si la signature est vide
     */
    function isSignatureEmpty() {
        const canvas = document.getElementById('signature-canvas');
        if (!canvas) return true;
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] !== 0) return false;
        }
        return true;
    }

    /**
     * Valide la signature et soumet l'examen
     */
    function validateAndSubmit() {
        if (isSignatureEmpty()) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Signature requise', 'Veuillez signer dans la zone prévue avant de valider.');
            }
            return;
        }

        const canvas = document.getElementById('signature-canvas');
        signatureData = canvas.toDataURL('image/png');
        submitExam(false);
    }

    // ============ SOUMISSION & CORRECTION ============

    /**
     * Soumet l'examen et calcule le résultat
     */
    function submitExam(isAutoSubmit = false) {
        stopTimer();
        stopAutoSave();

        // Désactiver les protections
        MWSecurity.disableExamProtections();
        MWSecurity.stopTabMonitoring();

        // Calculer le score
        const result = calculateScore();

        // Ajouter les métadonnées
        const endTime = new Date();
        const duration = Math.round((endTime - examStartTime) / 1000);
        const tabChanges = MWSecurity.getTabChangeCount();
        const fingerprint = MWSecurity.getSavedFingerprint()?.id || '';

        // Enregistrer le résultat
        const resultData = {
            examId: currentExam.id,
            examTitle: currentExam.title,
            candidateName: candidateInfo.fullname,
            candidateEmail: candidateInfo.email,
            candidateService: candidateInfo.service,
            candidateFunction: candidateInfo.function,
            score: result.score,
            maxScore: result.maxScore,
            percentage: result.percentage,
            grade: result.grade,
            passed: result.passed,
            answers: buildAnswersDetail(),
            tabChanges,
            fingerprint,
            signature: signatureData,
            duration,
            autoSubmitted: isAutoSubmit
        };

        const savedResult = MWStorage.Results.create(resultData);

        // Générer le certificat si réussi
        if (result.passed) {
            MWStorage.Certificates.create({
                resultId: savedResult.id,
                candidateName: candidateInfo.fullname,
                candidateEmail: candidateInfo.email,
                examTitle: currentExam.title,
                grade: result.grade,
                percentage: result.percentage,
                signature: signatureData
            });
        }

        // Nettoyer
        localStorage.removeItem('mw_exam_progress');
        resetExamState();

        // Afficher le résultat
        showResultScreen(savedResult, result);

        // Envoyer email si configuré
        if (typeof MWMailer !== 'undefined') {
            MWMailer.sendResultNotification(savedResult);
        }

        // Réinitialiser le compteur d'onglets
        MWSecurity.resetTabChangeCount();
    }

    /**
     * Calcule le score de l'examen
     */
    function calculateScore() {
        let score = 0;
        let maxScore = 0;

        currentQuestions.forEach(q => {
            maxScore += q.points;
            const answer = currentAnswers[q.id] || [];
            
            // Comparer avec les bonnes réponses
            const correct = [...q.correct].sort((a, b) => a - b);
            const given = [...answer].sort((a, b) => a - b);

            if (correct.length === given.length && 
                correct.every((v, i) => v === given[i])) {
                score += q.points;
            }
        });

        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        const grade = (percentage / 100) * 20;
        const passingScore = currentExam.passingScore || MWStorage.Settings.get('bareme') || 60;
        const passed = percentage >= passingScore;

        return {
            score,
            maxScore,
            percentage,
            grade: Math.round(grade * 100) / 100,
            passed,
            passingScore
        };
    }

    /**
     * Construit le détail des réponses pour le corrigé
     */
    function buildAnswersDetail() {
        return currentQuestions.map(q => ({
            questionId: q.id,
            question: q.question,
            options: q.options,
            correct: q.correct,
            given: currentAnswers[q.id] || [],
            points: q.points,
            isCorrect: arraysEqual(
                [...q.correct].sort((a, b) => a - b),
                [...(currentAnswers[q.id] || [])].sort((a, b) => a - b)
            ),
            explanation: q.explanation || ''
        }));
    }

    /**
     * Compare deux tableaux
     */
    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    /**
     * Affiche l'écran de résultat
     */
    function showResultScreen(result, calc) {
        const body = `
            <div style="text-align:center;padding:1rem 0;">
                <div style="font-size:4rem;margin-bottom:1rem;">
                    ${calc.passed ? '🎉' : '😔'}
                </div>
                <h2 style="color:${calc.passed ? 'var(--color-success)' : 'var(--color-danger)'};margin-bottom:0.5rem;">
                    ${calc.passed ? 'Félicitations !' : 'Examen non réussi'}
                </h2>
                <p style="color:var(--color-text-muted);margin-bottom:1.5rem;">
                    ${calc.passed 
                        ? 'Vous avez réussi votre examen. Votre certificat est disponible.' 
                        : 'Vous n\'avez pas atteint le seuil de réussite. Vous pouvez retenter votre chance.'}
                </p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;">
                    <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);">
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Score</div>
                        <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${calc.score}/${calc.maxScore}</div>
                    </div>
                    <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);">
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Pourcentage</div>
                        <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${calc.percentage}%</div>
                    </div>
                    <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);">
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Note /20</div>
                        <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${calc.grade}</div>
                    </div>
                </div>
                ${calc.passed ? `
                    <div style="padding:1rem;background:rgba(16,185,129,0.1);border-radius:var(--radius-md);margin-bottom:1rem;">
                        <strong style="color:var(--color-success);">✓ Certificat généré automatiquement</strong>
                    </div>
                ` : ''}
                <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline" onclick="MWExam.shareWhatsApp(${JSON.stringify(result.id).replace(/"/g, '&quot;')})">
                        📱 Partager sur WhatsApp
                    </button>
                    <button type="button" class="btn btn-primary" onclick="MWExam.showCorrection(${JSON.stringify(result.id).replace(/"/g, '&quot;')})">
                        📖 Voir le corrigé
                    </button>
                </div>
            </div>
        `;

        if (typeof MWApp !== 'undefined') {
            MWApp.openModal('Résultat de l\'examen', body, '');
        }
    }

    /**
     * Affiche le corrigé détaillé
     */
    function showCorrection(resultId) {
        const result = MWStorage.Results.getById(resultId);
        if (!result) return;

        if (typeof MWApp !== 'undefined') {
            MWApp.closeModal();
        }

        const body = `
            <div style="max-height:60vh;overflow-y:auto;">
                ${result.answers.map((a, i) => `
                    <div style="padding:1rem;margin-bottom:1rem;background:${a.isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border-radius:var(--radius-md);border-left:4px solid ${a.isCorrect ? 'var(--color-success)' : 'var(--color-danger)'};">
                        <div style="font-weight:600;margin-bottom:0.5rem;">
                            ${i + 1}. ${MWSecurity.escapeHtml(a.question)}
                            <span class="badge ${a.isCorrect ? 'badge-success' : 'badge-danger'}" style="margin-left:0.5rem;">
                                ${a.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                            </span>
                        </div>
                        <div style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.5rem;">
                            <strong>Vos réponses :</strong> ${a.given.map(idx => MWSecurity.escapeHtml(a.options[idx])).join(', ') || 'Aucune'}
                        </div>
                        <div style="font-size:0.85rem;color:var(--color-text-muted);margin-bottom:0.5rem;">
                            <strong>Bonne(s) réponse(s) :</strong> ${a.correct.map(idx => MWSecurity.escapeHtml(a.options[idx])).join(', ')}
                        </div>
                        ${a.explanation ? `
                            <div style="font-size:0.85rem;padding:0.5rem;background:var(--color-bg-soft);border-radius:var(--radius-sm);margin-top:0.5rem;">
                                💡 <em>${MWSecurity.escapeHtml(a.explanation)}</em>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        if (typeof MWApp !== 'undefined') {
            MWApp.openModal('Corrigé détaillé', body, '');
        }
    }

    /**
     * Partage le résultat sur WhatsApp
     */
    function shareWhatsApp(resultId) {
        const result = MWStorage.Results.getById(resultId);
        if (!result) return;

        const settings = MWStorage.Settings.getAll();
        const phone = settings.whatsapp || '';
        const message = `🎓 *MEGAWATT ACADEMY*%0A%0A` +
            `📝 Examen : ${encodeURIComponent(result.examTitle)}%0A` +
            `👤 Candidat : ${encodeURIComponent(result.candidateName)}%0A` +
            `📊 Score : ${result.score}/${result.maxScore} (${result.percentage}%)%0A` +
            `🎯 Note : ${result.grade}/20%0A` +
            `${result.passed ? '✅ Réussi' : '❌ Non réussi'}%0A%0A` +
            `🏆 MEGAWATT ACADEMY - Certification professionnelle`;

        const url = phone 
            ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`
            : `https://wa.me/?text=${message}`;

        window.open(url, '_blank');
    }

    // ============ UTILITAIRES ============

    /**
     * Change l'étape affichée
     */
    function showStep(step) {
        const step1 = document.getElementById('learner-step-1');
        const step2 = document.getElementById('learner-step-2');
        const step3 = document.getElementById('learner-step-3');

        if (step1) step1.style.display = step === 1 ? '' : 'none';
        if (step2) step2.style.display = step === 2 ? '' : 'none';
        if (step3) step3.style.display = step === 3 ? '' : 'none';
    }

    /**
     * Réinitialise l'état de l'examen
     */
    function resetExamState() {
        currentExam = null;
        currentQuestions = [];
        currentAnswers = {};
        reviewList = new Set();
        currentQuestionIndex = 0;
        timeRemaining = 0;
        examStartTime = null;
        candidateInfo = null;
        signatureData = '';
    }

    /**
     * Réinitialise le formulaire apprenant
     */
    function resetLearnerForm() {
        const form = document.getElementById('learner-info-form');
        if (form) form.reset();
        populateExamSelect();
        showStep(1);
        resetExamState();
    }

    // ============ API PUBLIQUE ============

    return {
        init,
        startExam,
        selectAnswer,
        nextQuestion,
        prevQuestion,
        toggleReview,
        goToSignature,
        clearSignature,
        validateAndSubmit,
        submitExam,
        showCorrection,
        shareWhatsApp,
        resetLearnerForm,
        restoreExamProgress,

        // Getters (pour debug)
        getCurrentExam: () => currentExam,
        getCurrentQuestions: () => currentQuestions,
        getCurrentAnswers: () => currentAnswers
    };
})();

// Restauration automatique au chargement (si examen interrompu)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (localStorage.getItem('mw_exam_progress')) {
            if (confirm('Un examen est en cours. Voulez-vous reprendre ?')) {
                MWExam.restoreExamProgress();
            } else {
                localStorage.removeItem('mw_exam_progress');
            }
        }
    }, 500);
});