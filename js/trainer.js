/* ============================================================
   MEGAWATT ACADEMY - Module Formateur
   Gestion des questions, examens et utilisateurs
   ============================================================ */

const MWTrainer = (() => {
    'use strict';

    // ============ ÉTAT INTERNE ============
    let editingQuestionId = null;
    let editingExamId = null;
    let editingUserId = null;
    let currentQuestionOptions = [];
    let currentQuestionCorrect = [];

    // ============ INITIALISATION ============

    /**
     * Initialise le module formateur
     */
    function init() {
        bindQuestionEvents();
        bindExamEvents();
        bindUserEvents();
        renderQuestions();
        renderExams();
        renderUsers();
    }

    // ============ GESTION DES QUESTIONS ============

    /**
     * Lie les événements liés aux questions
     */
    function bindQuestionEvents() {
        const btnAdd = document.getElementById('btn-add-question');
        const btnImportJson = document.getElementById('btn-import-json');
        const btnExportJson = document.getElementById('btn-export-json');
        const btnImportXlsx = document.getElementById('btn-import-xlsx');
        const btnExportXlsx = document.getElementById('btn-export-xlsx');
        const searchInput = document.getElementById('search-questions');

        if (btnAdd) btnAdd.addEventListener('click', () => openQuestionModal());
        if (btnImportJson) btnImportJson.addEventListener('click', importQuestionsJSON);
        if (btnExportJson) btnExportJson.addEventListener('click', exportQuestionsJSON);
        if (btnImportXlsx) btnImportXlsx.addEventListener('click', importQuestionsXLSX);
        if (btnExportXlsx) btnExportXlsx.addEventListener('click', exportQuestionsXLSX);
        if (searchInput) searchInput.addEventListener('input', (e) => renderQuestions(e.target.value));
    }

    /**
     * Affiche la liste des questions
     */
    function renderQuestions(searchTerm = '') {
        const tbody = document.getElementById('questions-tbody');
        if (!tbody) return;

        let questions = MWStorage.Questions.getAll();

        // Filtrage par recherche
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            questions = questions.filter(q =>
                q.question.toLowerCase().includes(term) ||
                (q.explanation && q.explanation.toLowerCase().includes(term))
            );
        }

        if (questions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="empty-state-icon">❓</div>
                            <div class="empty-state-title">Aucune question</div>
                            <div class="empty-state-text">
                                ${searchTerm ? 'Aucun résultat pour cette recherche.' : 'Commencez par ajouter des questions à votre banque.'}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = questions.map(q => `
            <tr>
                <td><code style="font-size:0.75rem;color:var(--color-text-muted);">${MWSecurity.escapeHtml(q.id.substring(0, 8))}</code></td>
                <td style="max-width:400px;">
                    <div style="font-weight:500;">${MWSecurity.escapeHtml(q.question.substring(0, 100))}${q.question.length > 100 ? '...' : ''}</div>
                    <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:0.25rem;">
                        ${q.options.length} options • ${q.correct.length} bonne(s) réponse(s)
                    </div>
                </td>
                <td>
                    <span class="badge ${q.type === 'single' ? 'badge-info' : 'badge-warning'}">
                        ${q.type === 'single' ? 'Choix unique' : 'Choix multiple'}
                    </span>
                </td>
                <td><strong>${q.points}</strong> pt${q.points > 1 ? 's' : ''}</td>
                <td>
                    <div style="display:flex;gap:0.25rem;">
                        <button class="btn btn-sm btn-outline" onclick="MWTrainer.editQuestion('${q.id}')" title="Modifier">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="MWTrainer.deleteQuestion('${q.id}')" title="Supprimer">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Ouvre la modale de création/édition de question
     */
    function openQuestionModal(questionId = null) {
        editingQuestionId = questionId;
        currentQuestionOptions = [];
        currentQuestionCorrect = [];

        let question = {
            type: 'single',
            question: '',
            options: ['', ''],
            correct: [],
            points: 1,
            explanation: ''
        };

        if (questionId) {
            const q = MWStorage.Questions.getById(questionId);
            if (q) {
                question = { ...q };
                // S'assurer qu'il y a au moins 2 options
                while (question.options.length < 2) {
                    question.options.push('');
                }
            }
        }

        currentQuestionOptions = [...question.options];
        currentQuestionCorrect = [...question.correct];

        const body = buildQuestionFormHTML(question);
        const footer = `
            <button type="button" class="btn btn-outline" onclick="MWApp.closeModal()">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="MWTrainer.saveQuestion()">
                💾 ${questionId ? 'Mettre à jour' : 'Créer'}
            </button>
        `;

        if (typeof MWApp !== 'undefined') {
            MWApp.openModal(questionId ? 'Modifier la question' : 'Nouvelle question', body, footer);
        }

        // Activer les événements du formulaire
        setTimeout(() => {
            bindQuestionFormEvents();
            updateQuestionOptionsDisplay();
        }, 50);
    }

    /**
     * Construit le HTML du formulaire de question
     */
    function buildQuestionFormHTML(question) {
        return `
            <form id="question-form" class="form-grid" style="grid-template-columns:1fr;">
                <div class="form-group">
                    <label for="q-type">Type de question *</label>
                    <select id="q-type" required>
                        <option value="single" ${question.type === 'single' ? 'selected' : ''}>Choix unique</option>
                        <option value="multiple" ${question.type === 'multiple' ? 'selected' : ''}>Choix multiple</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="q-text">Question *</label>
                    <textarea id="q-text" rows="3" required placeholder="Saisissez votre question...">${MWSecurity.escapeHtml(question.question)}</textarea>
                </div>
                <div class="form-group">
                    <label>Options de réponse *</label>
                    <div id="q-options-container"></div>
                    <button type="button" class="btn btn-sm btn-outline mt-1" onclick="MWTrainer.addOption()">
                        ➕ Ajouter une option
                    </button>
                </div>
                <div class="form-group" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                    <div>
                        <label for="q-points">Points *</label>
                        <input type="number" id="q-points" min="1" max="100" value="${question.points}" required />
                    </div>
                    <div>
                        <label>&nbsp;</label>
                        <div style="padding:0.75rem;background:var(--color-bg-soft);border-radius:var(--radius-md);font-size:0.85rem;color:var(--color-text-muted);">
                            💡 Cochez la/les bonne(s) réponse(s) dans la liste
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="q-explanation">Explication du corrigé</label>
                    <textarea id="q-explanation" rows="2" placeholder="Expliquez la bonne réponse (optionnel)...">${MWSecurity.escapeHtml(question.explanation)}</textarea>
                </div>
            </form>
        `;
    }

    /**
     * Lie les événements du formulaire de question
     */
    function bindQuestionFormEvents() {
        const typeSelect = document.getElementById('q-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                // Si passage en single, ne garder qu'une seule réponse correcte
                if (e.target.value === 'single' && currentQuestionCorrect.length > 1) {
                    currentQuestionCorrect = [currentQuestionCorrect[0]];
                    updateQuestionOptionsDisplay();
                }
            });
        }
    }

    /**
     * Met à jour l'affichage des options
     */
    function updateQuestionOptionsDisplay() {
        const container = document.getElementById('q-options-container');
        if (!container) return;

        container.innerHTML = currentQuestionOptions.map((opt, idx) => `
            <div class="option-item ${currentQuestionCorrect.includes(idx) ? 'selected' : ''}" 
                 data-index="${idx}" style="margin-bottom:0.5rem;">
                <input type="${document.getElementById('q-type')?.value === 'multiple' ? 'checkbox' : 'radio'}"
                       name="q-correct" 
                       ${currentQuestionCorrect.includes(idx) ? 'checked' : ''}
                       onchange="MWTrainer.toggleCorrect(${idx})" />
                <input type="text" 
                       value="${MWSecurity.escapeHtml(opt)}" 
                       placeholder="Option ${idx + 1}"
                       oninput="MWTrainer.updateOption(${idx}, this.value)"
                       style="flex:1;border:1px solid var(--color-border);padding:0.5rem;border-radius:var(--radius-sm);" />
                ${currentQuestionOptions.length > 2 ? `
                    <button type="button" class="btn btn-sm btn-danger" onclick="MWTrainer.removeOption(${idx})">
                        ✕
                    </button>
                ` : ''}
            </div>
        `).join('');
    }

    /**
     * Ajoute une option
     */
    function addOption() {
        currentQuestionOptions.push('');
        updateQuestionOptionsDisplay();
    }

    /**
     * Supprime une option
     */
    function removeOption(index) {
        if (currentQuestionOptions.length <= 2) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Minimum requis', 'Une question doit avoir au moins 2 options.');
            }
            return;
        }
        currentQuestionOptions.splice(index, 1);
        // Ajuster les index des réponses correctes
        currentQuestionCorrect = currentQuestionCorrect
            .filter(i => i !== index)
            .map(i => i > index ? i - 1 : i);
        updateQuestionOptionsDisplay();
    }

    /**
     * Met à jour le texte d'une option
     */
    function updateOption(index, value) {
        currentQuestionOptions[index] = value;
    }

    /**
     * Bascule une réponse correcte
     */
    function toggleCorrect(index) {
        const type = document.getElementById('q-type')?.value || 'single';
        
        if (type === 'single') {
            currentQuestionCorrect = [index];
        } else {
            const pos = currentQuestionCorrect.indexOf(index);
            if (pos > -1) {
                currentQuestionCorrect.splice(pos, 1);
            } else {
                currentQuestionCorrect.push(index);
            }
        }
        updateQuestionOptionsDisplay();
    }

    /**
     * Sauvegarde la question
     */
    function saveQuestion() {
        const type = document.getElementById('q-type').value;
        const text = document.getElementById('q-text').value.trim();
        const points = parseInt(document.getElementById('q-points').value) || 1;
        const explanation = document.getElementById('q-explanation').value.trim();

        // Validations
        if (!text) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'La question est obligatoire.');
            return;
        }

        // Vérifier que toutes les options sont remplies
        const emptyOptions = currentQuestionOptions.filter(o => !o.trim());
        if (emptyOptions.length > 0) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Toutes les options doivent être remplies.');
            return;
        }

        if (currentQuestionCorrect.length === 0) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Sélectionnez au moins une bonne réponse.');
            return;
        }

        const questionData = {
            type,
            question: text,
            options: [...currentQuestionOptions],
            correct: [...currentQuestionCorrect],
            points,
            explanation
        };

        try {
            if (editingQuestionId) {
                MWStorage.Questions.update(editingQuestionId, questionData);
                if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Question modifiée.');
            } else {
                MWStorage.Questions.create(questionData);
                if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Question créée.');
            }

            if (typeof MWApp !== 'undefined') MWApp.closeModal();
            renderQuestions();
        } catch (error) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', error.message);
        }
    }

    /**
     * Édite une question
     */
    function editQuestion(id) {
        openQuestionModal(id);
    }

    /**
     * Supprime une question
     */
    function deleteQuestion(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) return;

        try {
            MWStorage.Questions.delete(id);
            if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Question supprimée.');
            renderQuestions();
        } catch (error) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', error.message);
        }
    }

    // ============ IMPORT / EXPORT JSON ============

    /**
     * Importe des questions depuis un fichier JSON
     */
    function importQuestionsJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    const questions = Array.isArray(data) ? data : (data.questions || []);
                    
                    if (questions.length === 0) {
                        if (typeof MWApp !== 'undefined') MWApp.showToast('warning', 'Attention', 'Aucune question valide dans le fichier.');
                        return;
                    }

                    const imported = MWStorage.Questions.importJSON(questions);
                    if (typeof MWApp !== 'undefined') {
                        MWApp.showToast('success', 'Import réussi', `${imported} question(s) importée(s).`);
                    }
                    renderQuestions();
                } catch (error) {
                    if (typeof MWApp !== 'undefined') {
                        MWApp.showToast('danger', 'Erreur', 'Fichier JSON invalide : ' + error.message);
                    }
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    /**
     * Exporte les questions en JSON
     */
    function exportQuestionsJSON() {
        const questions = MWStorage.Questions.exportJSON();
        
        if (questions.length === 0) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('warning', 'Attention', 'Aucune question à exporter.');
            return;
        }

        const json = JSON.stringify(questions, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadBlob(blob, `megawatt-questions-${Date.now()}.json`);
        
        if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Export réussi', 'Fichier JSON téléchargé.');
    }

    // ============ IMPORT / EXPORT XLSX ============

    /**
     * Importe des questions depuis un fichier XLSX
     * Format attendu : id | type | question | options (séparées par |) | correct (index séparés par ,) | points | explanation
     */
    function importQuestionsXLSX() {
        if (typeof XLSX === 'undefined') {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Librairie SheetJS non chargée.');
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (rows.length < 2) {
                        if (typeof MWApp !== 'undefined') MWApp.showToast('warning', 'Attention', 'Fichier vide ou sans données.');
                        return;
                    }

                    // En-tête : id, type, question, options, correct, points, explanation
                    const headers = rows[0].map(h => String(h).toLowerCase().trim());
                    const questions = [];

                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;

                        const qIdx = headers.indexOf('question');
                        const optIdx = headers.indexOf('options');
                        const corIdx = headers.indexOf('correct');

                        if (qIdx === -1 || optIdx === -1 || corIdx === -1) continue;

                        const question = String(row[qIdx] || '').trim();
                        const optionsStr = String(row[optIdx] || '');
                        const correctStr = String(row[corIdx] || '');

                        if (!question) continue;

                        const options = optionsStr.split('|').map(o => o.trim()).filter(o => o);
                        const correct = correctStr.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));

                        if (options.length < 2 || correct.length === 0) continue;

                        questions.push({
                            id: row[headers.indexOf('id')] || undefined,
                            type: String(row[headers.indexOf('type')] || 'single').trim(),
                            question,
                            options,
                            correct,
                            points: parseInt(row[headers.indexOf('points')] || 1) || 1,
                            explanation: String(row[headers.indexOf('explanation')] || '').trim()
                        });
                    }

                    if (questions.length === 0) {
                        if (typeof MWApp !== 'undefined') MWApp.showToast('warning', 'Attention', 'Aucune question valide trouvée.');
                        return;
                    }

                    const imported = MWStorage.Questions.importJSON(questions);
                    if (typeof MWApp !== 'undefined') {
                        MWApp.showToast('success', 'Import XLSX réussi', `${imported} question(s) importée(s).`);
                    }
                    renderQuestions();
                } catch (error) {
                    if (typeof MWApp !== 'undefined') {
                        MWApp.showToast('danger', 'Erreur', 'Fichier XLSX invalide : ' + error.message);
                    }
                }
            };
            reader.readAsArrayBuffer(file);
        };
        
        input.click();
    }

    /**
     * Exporte les questions en XLSX
     */
    function exportQuestionsXLSX() {
        if (typeof XLSX === 'undefined') {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Librairie SheetJS non chargée.');
            return;
        }

        const questions = MWStorage.Questions.exportJSON();
        
        if (questions.length === 0) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('warning', 'Attention', 'Aucune question à exporter.');
            return;
        }

        const data = [
            ['id', 'type', 'question', 'options', 'correct', 'points', 'explanation']
        ];

        questions.forEach(q => {
            data.push([
                q.id,
                q.type,
                q.question,
                q.options.join(' | '),
                q.correct.join(','),
                q.points,
                q.explanation || ''
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        
        // Ajuster largeur colonnes
        ws['!cols'] = [
            { wch: 12 }, { wch: 10 }, { wch: 50 },
            { wch: 60 }, { wch: 10 }, { wch: 8 }, { wch: 40 }
        ];

        XLSX.writeFile(wb, `megawatt-questions-${Date.now()}.xlsx`);
        
        if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Export réussi', 'Fichier XLSX téléchargé.');
    }

    // ============ GESTION DES EXAMENS ============

    /**
     * Lie les événements liés aux examens
     */
    function bindExamEvents() {
        const btnAdd = document.getElementById('btn-add-exam');
        if (btnAdd) btnAdd.addEventListener('click', () => openExamModal());
    }

    /**
     * Affiche la liste des examens
     */
    function renderExams() {
        const grid = document.getElementById('exams-grid');
        if (!grid) return;

        const exams = MWStorage.Exams.getAll();

        if (exams.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-title">Aucun examen</div>
                    <div class="empty-state-text">Créez votre premier examen pour commencer.</div>
                </div>
            `;
            return;
        }

        grid.innerHTML = exams.map(e => `
            <div class="exam-card">
                <div class="exam-card-title">${MWSecurity.escapeHtml(e.title)}</div>
                <div class="exam-card-desc">${MWSecurity.escapeHtml(e.description || 'Aucune description')}</div>
                <div class="exam-card-meta">
                    <span class="meta-tag">⏱ ${e.duration} min</span>
                    <span class="meta-tag">❓ ${e.questionCount} questions</span>
                    <span class="meta-tag">✅ ${e.passingScore}%</span>
                    <span class="meta-tag">${e.shuffleQuestions ? '🔀 Aléatoire' : '📋 Ordonné'}</span>
                </div>
                <div class="exam-card-actions">
                    <button class="btn btn-sm btn-outline" onclick="MWTrainer.editExam('${e.id}')">✏️ Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="MWTrainer.deleteExam('${e.id}')">🗑️ Supprimer</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Ouvre la modale de création/édition d'examen
     */
    function openExamModal(examId = null) {
        editingExamId = examId;

        let exam = {
            title: '',
            description: '',
            duration: 60,
            passingScore: 60,
            questionCount: 10,
            shuffleQuestions: true,
            shuffleAnswers: true
        };

        if (examId) {
            const e = MWStorage.Exams.getById(examId);
            if (e) exam = { ...e };
        }

        const body = `
            <form id="exam-form" class="form-grid">
                <div class="form-group" style="grid-column:1/-1;">
                    <label for="e-title">Titre *</label>
                    <input type="text" id="e-title" value="${MWSecurity.escapeHtml(exam.title)}" required />
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label for="e-description">Description</label>
                    <textarea id="e-description" rows="2">${MWSecurity.escapeHtml(exam.description)}</textarea>
                </div>
                <div class="form-group">
                    <label for="e-duration">Durée (minutes) *</label>
                    <input type="number" id="e-duration" min="1" max="480" value="${exam.duration}" required />
                </div>
                <div class="form-group">
                    <label for="e-question-count">Nombre de questions *</label>
                    <input type="number" id="e-question-count" min="1" max="200" value="${exam.questionCount}" required />
                </div>
                <div class="form-group">
                    <label for="e-passing-score">Seuil de réussite (%) *</label>
                    <input type="number" id="e-passing-score" min="0" max="100" value="${exam.passingScore}" required />
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <div style="display:flex;flex-direction:column;gap:0.5rem;padding:0.75rem;background:var(--color-bg-soft);border-radius:var(--radius-md);">
                        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer;">
                            <input type="checkbox" id="e-shuffle-questions" ${exam.shuffleQuestions ? 'checked' : ''} />
                            Tirage aléatoire des questions
                        </label>
                        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer;">
                            <input type="checkbox" id="e-shuffle-answers" ${exam.shuffleAnswers ? 'checked' : ''} />
                            Mélange des réponses
                        </label>
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-outline" onclick="MWApp.closeModal()">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="MWTrainer.saveExam()">
                💾 ${examId ? 'Mettre à jour' : 'Créer'}
            </button>
        `;

        if (typeof MWApp !== 'undefined') {
            MWApp.openModal(examId ? 'Modifier l\'examen' : 'Nouvel examen', body, footer);
        }
    }

    /**
     * Sauvegarde l'examen
     */
    function saveExam() {
        const title = document.getElementById('e-title').value.trim();
        const description = document.getElementById('e-description').value.trim();
        const duration = parseInt(document.getElementById('e-duration').value) || 60;
        const questionCount = parseInt(document.getElementById('e-question-count').value) || 10;
        const passingScore = parseInt(document.getElementById('e-passing-score').value) || 60;
        const shuffleQuestions = document.getElementById('e-shuffle-questions').checked;
        const shuffleAnswers = document.getElementById('e-shuffle-answers').checked;

        if (!title) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Le titre est obligatoire.');
            return;
        }

        // Vérifier qu'il y a assez de questions
        const totalQuestions = MWStorage.Questions.getAll().length;
        if (questionCount > totalQuestions) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', `Seulement ${totalQuestions} question(s) disponible(s) dans la banque.`);
            }
            return;
        }

        const examData = {
            title,
            description,
            duration,
            questionCount,
            passingScore,
            shuffleQuestions,
            shuffleAnswers
        };

        try {
            if (editingExamId) {
                MWStorage.Exams.update(editingExamId, examData);
                if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Examen modifié.');
            } else {
                MWStorage.Exams.create(examData);
                if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Examen créé.');
            }

            if (typeof MWApp !== 'undefined') MWApp.closeModal();
            renderExams();
        } catch (error) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', error.message);
        }
    }

    /**
     * Édite un examen
     */
    function editExam(id) {
        openExamModal(id);
    }

    /**
     * Supprime un examen
     */
    function deleteExam(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet examen ?')) return;

        try {
            MWStorage.Exams.delete(id);
            if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Examen supprimé.');
            renderExams();
        } catch (error) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', error.message);
        }
    }

    // ============ GESTION DES UTILISATEURS ============

    /**
     * Lie les événements liés aux utilisateurs
     */
    function bindUserEvents() {
        const btnAdd = document.getElementById('btn-add-user');
        if (btnAdd) btnAdd.addEventListener('click', () => openUserModal());
    }

    /**
     * Affiche la liste des utilisateurs
     */
    function renderUsers() {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;

        const users = MWStorage.Users.getAll();

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="empty-state-icon">👥</div>
                            <div class="empty-state-title">Aucun utilisateur</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const roleLabels = {
            admin: 'Administrateur',
            formateur: 'Formateur',
            rh: 'Ressources Humaines',
            apprenant: 'Apprenant'
        };

        const roleBadges = {
            admin: 'badge-danger',
            formateur: 'badge-primary',
            rh: 'badge-warning',
            apprenant: 'badge-info'
        };

        tbody.innerHTML = users.map(u => `
            <tr>
                <td><code>${MWSecurity.escapeHtml(u.username)}</code></td>
                <td>${MWSecurity.escapeHtml(u.fullname || '—')}</td>
                <td>${MWSecurity.escapeHtml(u.email || '—')}</td>
                <td>
                    <span class="badge ${roleBadges[u.role] || 'badge-info'}">
                        ${roleLabels[u.role] || u.role}
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:0.25rem;">
                        <button class="btn btn-sm btn-outline" onclick="MWTrainer.editUser('${u.id}')" title="Modifier">
                            ✏️
                        </button>
                        ${u.username !== 'admin' ? `
                            <button class="btn btn-sm btn-danger" onclick="MWTrainer.deleteUser('${u.id}')" title="Supprimer">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Ouvre la modale de création/édition d'utilisateur
     */
    function openUserModal(userId = null) {
        editingUserId = userId;

        let user = {
            username: '',
            password: '',
            fullname: '',
            email: '',
            role: 'apprenant'
        };

        if (userId) {
            const u = MWStorage.Users.getById(userId);
            if (u) {
                user = { ...u, password: '' }; // Ne pas afficher le hash
            }
        }

        const body = `
            <form id="user-form" class="form-grid">
                <div class="form-group">
                    <label for="u-username">Identifiant *</label>
                    <input type="text" id="u-username" value="${MWSecurity.escapeHtml(user.username)}" required ${userId ? 'readonly' : ''} />
                </div>
                <div class="form-group">
                    <label for="u-password">Mot de passe ${userId ? '(laisser vide pour ne pas changer)' : '*'}</label>
                    <input type="password" id="u-password" ${userId ? '' : 'required'} placeholder="••••••••" />
                </div>
                <div class="form-group">
                    <label for="u-fullname">Nom complet</label>
                    <input type="text" id="u-fullname" value="${MWSecurity.escapeHtml(user.fullname)}" />
                </div>
                <div class="form-group">
                    <label for="u-email">Email</label>
                    <input type="email" id="u-email" value="${MWSecurity.escapeHtml(user.email)}" />
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label for="u-role">Rôle *</label>
                    <select id="u-role" required>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrateur</option>
                        <option value="formateur" ${user.role === 'formateur' ? 'selected' : ''}>Formateur</option>
                        <option value="rh" ${user.role === 'rh' ? 'selected' : ''}>Ressources Humaines</option>
                        <option value="apprenant" ${user.role === 'apprenant' ? 'selected' : ''}>Apprenant</option>
                    </select>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-outline" onclick="MWApp.closeModal()">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="MWTrainer.saveUser()">
                💾 ${userId ? 'Mettre à jour' : 'Créer'}
            </button>
        `;

        if (typeof MWApp !== 'undefined') {
            MWApp.openModal(userId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur', body, footer);
        }
    }

    /**
     * Sauvegarde l'utilisateur
     */
    function saveUser() {
        const username = document.getElementById('u-username').value.trim();
        const password = document.getElementById('u-password').value;
        const fullname = document.getElementById('u-fullname').value.trim();
        const email = document.getElementById('u-email').value.trim();
        const role = document.getElementById('u-role').value;

        if (!username) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'L\'identifiant est obligatoire.');
            return;
        }

        if (!editingUserId && !password) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Le mot de passe est obligatoire.');
            return;
        }

        if (email && !MWSecurity.isValidEmail(email)) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Email invalide.');
            return;
        }

        const userData = { username, fullname, email, role };
        if (password) userData.password = password;

        try {
            if (editingUserId) {
                MWStorage.Users.update(editingUserId, userData);
                if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Utilisateur modifié.');
            } else {
                MWStorage.Users.create(userData);
                if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Utilisateur créé.');
            }

            if (typeof MWApp !== 'undefined') MWApp.closeModal();
            renderUsers();
        } catch (error) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', error.message);
        }
    }

    /**
     * Édite un utilisateur
     */
    function editUser(id) {
        openUserModal(id);
    }

    /**
     * Supprime un utilisateur
     */
    function deleteUser(id) {
        const user = MWStorage.Users.getById(id);
        if (user && user.username === 'admin') {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', 'Impossible de supprimer le compte admin par défaut.');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;

        try {
            MWStorage.Users.delete(id);
            if (typeof MWApp !== 'undefined') MWApp.showToast('success', 'Succès', 'Utilisateur supprimé.');
            renderUsers();
        } catch (error) {
            if (typeof MWApp !== 'undefined') MWApp.showToast('danger', 'Erreur', error.message);
        }
    }

    // ============ UTILITAIRES ============

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

    // ============ API PUBLIQUE ============

    return {
        init,

        // Questions
        renderQuestions,
        openQuestionModal,
        saveQuestion,
        editQuestion,
        deleteQuestion,
        addOption,
        removeOption,
        updateOption,
        toggleCorrect,
        importQuestionsJSON,
        exportQuestionsJSON,
        importQuestionsXLSX,
        exportQuestionsXLSX,

        // Examens
        renderExams,
        openExamModal,
        saveExam,
        editExam,
        deleteExam,

        // Utilisateurs
        renderUsers,
        openUserModal,
        saveUser,
        editUser,
        deleteUser
    };
})();