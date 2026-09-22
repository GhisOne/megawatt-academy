/* ============================================================
   MEGAWATT ACADEMY - Module Rapports RH
   Tableau de bord, statistiques, graphiques, exports
   ============================================================ */

const MWReports = (() => {
    'use strict';

    // ============ ÉTAT INTERNE ============
    let chartResults = null;
    let chartRoles = null;
    let chartTop10 = null;
    let chartFailedQuestions = null;

    // ============ INITIALISATION ============

    /**
     * Initialise le module rapports
     */
    function init() {
        bindReportEvents();
        renderDashboard();
        renderRanking();
    }

    /**
     * Lie les événements
     */
    function bindReportEvents() {
        const btnExportCsv = document.getElementById('btn-export-report-csv');
        const btnExportPdf = document.getElementById('btn-export-report-pdf');

        if (btnExportCsv) btnExportCsv.addEventListener('click', exportReportCSV);
        if (btnExportPdf) btnExportPdf.addEventListener('click', exportReportPDF);
    }

    // ============ TABLEAU DE BORD ============

    /**
     * Affiche le tableau de bord avec statistiques
     */
    function renderDashboard() {
        const stats = MWStorage.Results.getStats();
        const incidents = MWStorage.Incidents.count();

        // Mettre à jour les cartes statistiques
        updateElement('report-total', stats.total);
        updateElement('report-success-rate', stats.total > 0 ? `${Math.round((stats.passed / stats.total) * 100)}%` : '0%');
        updateElement('report-average', `${stats.average.toFixed(1)}/20`);
        updateElement('report-fraud', incidents);

        // Générer les graphiques
        renderChartResults();
        renderChartRoles();
        renderChartTop10();
        renderChartFailedQuestions();
    }

    /**
     * Met à jour un élément du DOM
     */
    function updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ============ GRAPHIQUES ============

    /**
     * Graphique : Évolution des résultats
     */
    function renderChartResults() {
        const canvas = document.getElementById('chart-results');
        if (!canvas || typeof Chart === 'undefined') return;

        // Détruire l'ancien graphique s'il existe
        if (chartResults) {
            chartResults.destroy();
        }

        const results = MWStorage.Results.getAll();
        
        // Grouper par date (7 derniers jours)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            last7Days.push(dateStr);
        }

        const dataByDate = last7Days.map(date => {
            const dayResults = results.filter(r => r.createdAt.startsWith(date));
            return {
                passed: dayResults.filter(r => r.passed).length,
                failed: dayResults.filter(r => !r.passed).length
            };
        });

        const ctx = canvas.getContext('2d');
        chartResults = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days.map(d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })),
                datasets: [
                    {
                        label: 'Réussites',
                        data: dataByDate.map(d => d.passed),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Échecs',
                        data: dataByDate.map(d => d.failed),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    /**
     * Graphique : Répartition par rôle
     */
    function renderChartRoles() {
        const canvas = document.getElementById('chart-roles');
        if (!canvas || typeof Chart === 'undefined') return;

        if (chartRoles) {
            chartRoles.destroy();
        }

        const users = MWStorage.Users.getAll();
        const roleCounts = {
            admin: users.filter(u => u.role === 'admin').length,
            formateur: users.filter(u => u.role === 'formateur').length,
            rh: users.filter(u => u.role === 'rh').length,
            apprenant: users.filter(u => u.role === 'apprenant').length
        };

        const ctx = canvas.getContext('2d');
        chartRoles = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Administrateur', 'Formateur', 'RH', 'Apprenant'],
                datasets: [{
                    data: [roleCounts.admin, roleCounts.formateur, roleCounts.rh, roleCounts.apprenant],
                    backgroundColor: [
                        '#ef4444',
                        '#056a30',
                        '#f59e0b',
                        '#3b82f6'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    /**
     * Graphique : Top 10 des candidats
     */
    function renderChartTop10() {
        const canvas = document.getElementById('chart-top10');
        if (!canvas || typeof Chart === 'undefined') return;

        if (chartTop10) {
            chartTop10.destroy();
        }

        const results = MWStorage.Results.getAll();
        
        // Trier par note décroissante et prendre les 10 premiers
        const top10 = [...results]
            .sort((a, b) => b.grade - a.grade)
            .slice(0, 10);

        const ctx = canvas.getContext('2d');
        chartTop10 = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(r => r.candidateName),
                datasets: [{
                    label: 'Note /20',
                    data: top10.map(r => r.grade),
                    backgroundColor: 'rgba(5, 106, 48, 0.8)',
                    borderColor: '#056a30',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 20
                    }
                }
            }
        });
    }

    /**
     * Graphique : Questions les plus ratées
     */
    function renderChartFailedQuestions() {
        const canvas = document.getElementById('chart-failed-questions');
        if (!canvas || typeof Chart === 'undefined') return;

        if (chartFailedQuestions) {
            chartFailedQuestions.destroy();
        }

        const results = MWStorage.Results.getAll();
        const questionStats = {};

        // Compter les échecs par question
        results.forEach(r => {
            if (r.answers) {
                r.answers.forEach(a => {
                    if (!questionStats[a.questionId]) {
                        questionStats[a.questionId] = {
                            question: a.question,
                            failed: 0,
                            total: 0
                        };
                    }
                    questionStats[a.questionId].total++;
                    if (!a.isCorrect) {
                        questionStats[a.questionId].failed++;
                    }
                });
            }
        });

        // Trier par taux d'échec
        const failedQuestions = Object.values(questionStats)
            .filter(q => q.total >= 3) // Au moins 3 tentatives
            .sort((a, b) => (b.failed / b.total) - (a.failed / a.total))
            .slice(0, 10);

        const ctx = canvas.getContext('2d');
        chartFailedQuestions = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: failedQuestions.map(q => q.question.substring(0, 40) + (q.question.length > 40 ? '...' : '')),
                datasets: [{
                    label: 'Taux d\'échec (%)',
                    data: failedQuestions.map(q => Math.round((q.failed / q.total) * 100)),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#ef4444',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // ============ CLASSEMENT ============

    /**
     * Affiche le classement complet
     */
    function renderRanking() {
        const tbody = document.getElementById('ranking-tbody');
        if (!tbody) return;

        const results = MWStorage.Results.getAll();

        if (results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="empty-state-icon">📊</div>
                            <div class="empty-state-title">Aucun résultat</div>
                            <div class="empty-state-text">Les résultats apparaîtront ici après les premiers examens.</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Trier par note décroissante
        const sorted = [...results].sort((a, b) => b.grade - a.grade);

        tbody.innerHTML = sorted.map((r, idx) => `
            <tr>
                <td>
                    <span style="font-weight:700;color:${idx < 3 ? 'var(--color-warning)' : 'var(--color-text)'};">
                        ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''} ${idx + 1}
                    </span>
                </td>
                <td>${MWSecurity.escapeHtml(r.candidateName)}</td>
                <td>${MWSecurity.escapeHtml(r.examTitle)}</td>
                <td><strong style="color:var(--color-primary);">${r.grade}/20</strong></td>
                <td>
                    <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">
                        ${r.percentage}%
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // ============ EXPORT CSV ============

    /**
     * Exporte le rapport complet en CSV
     */
    function exportReportCSV() {
        const results = MWStorage.Results.getAll();
        
        if (results.length === 0) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Attention', 'Aucun résultat à exporter.');
            }
            return;
        }

        // En-têtes
        const headers = [
            'Date',
            'Candidat',
            'Email',
            'Service',
            'Fonction',
            'Examen',
            'Score',
            'Score Max',
            'Pourcentage',
            'Note /20',
            'Statut',
            'Changements onglet',
            'Durée (s)'
        ];

        // Données
        const rows = results.map(r => [
            new Date(r.createdAt).toLocaleString('fr-FR'),
            r.candidateName,
            r.candidateEmail,
            r.candidateService || '',
            r.candidateFunction || '',
            r.examTitle,
            r.score,
            r.maxScore,
            r.percentage,
            r.grade,
            r.passed ? 'Réussi' : 'Échoué',
            r.tabChanges || 0,
            r.duration || 0
        ]);

        // Construire le CSV
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        // Ajouter BOM pour Excel
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `megawatt-rapport-${Date.now()}.csv`);

        if (typeof MWApp !== 'undefined') {
            MWApp.showToast('success', 'Export réussi', 'Fichier CSV téléchargé.');
        }
    }

    // ============ EXPORT PDF ============

    /**
     * Exporte le rapport complet en PDF
     */
    function exportReportPDF() {
        if (typeof window.jspdf === 'undefined') {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Librairie jsPDF non chargée.');
            }
            return;
        }

        const results = MWStorage.Results.getAll();
        
        if (results.length === 0) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Attention', 'Aucun résultat à exporter.');
            }
            return;
        }

        if (typeof MWApp !== 'undefined') {
            MWApp.showToast('info', 'Génération en cours', 'Création du rapport PDF...');
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = margin;

            // ============ EN-TÊTE ============
            doc.setFillColor(5, 106, 48);
            doc.rect(0, 0, pageWidth, 30, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text('MEGAWATT ACADEMY', pageWidth / 2, 15, { align: 'center' });
            
            doc.setFontSize(12);
            doc.text('Rapport RH - Résultats des examens', pageWidth / 2, 23, { align: 'center' });

            yPos = 40;

            // ============ STATISTIQUES GLOBALES ============
            const stats = MWStorage.Results.getStats();
            const successRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Statistiques globales', margin, yPos);
            yPos += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            
            const statsData = [
                ['Total candidats', stats.total.toString()],
                ['Réussites', `${stats.passed} (${successRate}%)`],
                ['Échecs', stats.failed.toString()],
                ['Moyenne générale', `${stats.average.toFixed(2)}/20`]
            ];

            statsData.forEach(([label, value]) => {
                doc.text(`${label} :`, margin, yPos);
                doc.setFont('helvetica', 'bold');
                doc.text(value, margin + 60, yPos);
                doc.setFont('helvetica', 'normal');
                yPos += 6;
            });

            yPos += 10;

            // ============ TABLEAU DES RÉSULTATS ============
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Détail des résultats', margin, yPos);
            yPos += 8;

            // En-têtes tableau
            doc.setFillColor(5, 106, 48);
            doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            const colWidths = [40, 50, 25, 25, 20];
            const headers = ['Candidat', 'Examen', 'Note /20', '%', 'Statut'];
            let xPos = margin;
            
            headers.forEach((header, i) => {
                doc.text(header, xPos + 2, yPos + 5.5);
                xPos += colWidths[i];
            });

            yPos += 8;

            // Lignes du tableau
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(8);
            
            const sortedResults = [...results].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            sortedResults.forEach((r, idx) => {
                // Nouvelle page si nécessaire
                if (yPos > pageHeight - 20) {
                    doc.addPage();
                    yPos = margin;
                }

                // Fond alterné
                if (idx % 2 === 0) {
                    doc.setFillColor(247, 249, 248);
                    doc.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                }

                xPos = margin;
                
                // Candidat
                doc.text(r.candidateName.substring(0, 25), xPos + 2, yPos + 4.5);
                xPos += colWidths[0];
                
                // Examen
                doc.text(r.examTitle.substring(0, 30), xPos + 2, yPos + 4.5);
                xPos += colWidths[1];
                
                // Note
                doc.setFont('helvetica', 'bold');
                doc.text(`${r.grade}/20`, xPos + 2, yPos + 4.5);
                doc.setFont('helvetica', 'normal');
                xPos += colWidths[2];
                
                // Pourcentage
                doc.text(`${r.percentage}%`, xPos + 2, yPos + 4.5);
                xPos += colWidths[3];
                
                // Statut
                doc.setTextColor(r.passed ? 16 : 239, r.passed ? 185 : 68, r.passed ? 129 : 68);
                doc.text(r.passed ? 'Réussi' : 'Échoué', xPos + 2, yPos + 4.5);
                doc.setTextColor(0, 0, 0);

                yPos += 7;
            });

            // ============ PIED DE PAGE ============
            const dateStr = new Date().toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Généré le ${dateStr}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

            // Sauvegarder
            const filename = `megawatt-rapport-rh-${Date.now()}.pdf`;
            doc.save(filename);

            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Export réussi', 'Rapport PDF téléchargé.');
            }

        } catch (error) {
            console.error('Erreur export PDF:', error);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Impossible de générer le rapport : ' + error.message);
            }
        }
    }

    // ============ RÉSULTATS (vue Résultats) ============

    /**
     * Affiche la liste des résultats
     */
    function renderResults() {
        const tbody = document.getElementById('results-tbody');
        if (!tbody) return;

        const results = MWStorage.Results.getAll();

        if (results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">✅</div>
                            <div class="empty-state-title">Aucun résultat</div>
                            <div class="empty-state-text">Les résultats apparaîtront ici après les premiers examens.</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Trier par date décroissante
        const sorted = [...results].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        tbody.innerHTML = sorted.map(r => {
            const date = new Date(r.createdAt).toLocaleDateString('fr-FR');
            return `
                <tr>
                    <td>${date}</td>
                    <td>${MWSecurity.escapeHtml(r.candidateName)}</td>
                    <td>${MWSecurity.escapeHtml(r.examTitle)}</td>
                    <td><strong>${r.score}/${r.maxScore}</strong></td>
                    <td><strong style="color:var(--color-primary);">${r.grade}/20</strong></td>
                    <td>
                        <span class="badge ${r.passed ? 'badge-success' : 'badge-danger'}">
                            ${r.passed ? '✓ Réussi' : '✗ Échoué'}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex;gap:0.25rem;">
                            <button class="btn btn-sm btn-outline" onclick="MWReports.viewResultDetail('${r.id}')" title="Voir détail">
                                👁️
                            </button>
                            ${r.passed ? `
                                <button class="btn btn-sm btn-outline" onclick="MWCertificates.generatePDF('${r.id}')" title="Télécharger certificat">
                                    🏆
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Affiche le détail d'un résultat
     */
    function viewResultDetail(resultId) {
        const result = MWStorage.Results.getById(resultId);
        if (!result) return;

        const date = new Date(result.createdAt).toLocaleString('fr-FR');
        const duration = Math.floor(result.duration / 60);
        const seconds = result.duration % 60;

        const body = `
            <div style="max-height:60vh;overflow-y:auto;">
                <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);margin-bottom:1rem;">
                    <h3 style="margin-bottom:0.5rem;">${MWSecurity.escapeHtml(result.candidateName)}</h3>
                    <p style="color:var(--color-text-muted);font-size:0.9rem;margin:0;">
                        ${MWSecurity.escapeHtml(result.candidateEmail)}<br>
                        ${result.candidateService ? `Service : ${MWSecurity.escapeHtml(result.candidateService)}<br>` : ''}
                        ${result.candidateFunction ? `Fonction : ${MWSecurity.escapeHtml(result.candidateFunction)}` : ''}
                    </p>
                </div>

                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1rem;">
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Examen</div>
                        <div style="font-weight:600;">${MWSecurity.escapeHtml(result.examTitle)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Date</div>
                        <div style="font-weight:600;">${date}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Durée</div>
                        <div style="font-weight:600;">${duration}min ${seconds}s</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Changements d'onglet</div>
                        <div style="font-weight:600;color:${result.tabChanges > 0 ? 'var(--color-warning)' : 'var(--color-text)'};">
                            ${result.tabChanges || 0}
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1rem;">
                    <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Score</div>
                        <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${result.score}/${result.maxScore}</div>
                    </div>
                    <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Pourcentage</div>
                        <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${result.percentage}%</div>
                    </div>
                    <div style="padding:1rem;background:var(--color-bg-soft);border-radius:var(--radius-md);text-align:center;">
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Note /20</div>
                        <div style="font-size:1.5rem;font-weight:700;color:var(--color-primary);">${result.grade}</div>
                    </div>
                </div>

                <div style="padding:1rem;background:${result.passed ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'};border-radius:var(--radius-md);border-left:4px solid ${result.passed ? 'var(--color-success)' : 'var(--color-danger)'};">
                    <strong style="color:${result.passed ? 'var(--color-success)' : 'var(--color-danger)'};">
                        ${result.passed ? '✅ Examen réussi' : '❌ Examen échoué'}
                    </strong>
                </div>

                ${result.answers && result.answers.length > 0 ? `
                    <div style="margin-top:1.5rem;">
                        <h4 style="margin-bottom:0.75rem;">Détail des réponses</h4>
                        ${result.answers.map((a, i) => `
                            <div style="padding:0.75rem;margin-bottom:0.5rem;background:${a.isCorrect ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)'};border-radius:var(--radius-sm);border-left:3px solid ${a.isCorrect ? 'var(--color-success)' : 'var(--color-danger)'};">
                                <div style="font-weight:500;font-size:0.9rem;margin-bottom:0.25rem;">
                                    ${i + 1}. ${MWSecurity.escapeHtml(a.question.substring(0, 100))}${a.question.length > 100 ? '...' : ''}
                                </div>
                                <div style="font-size:0.8rem;color:var(--color-text-muted);">
                                    ${a.isCorrect ? '✓ Correct' : '✗ Incorrect'} • ${a.points} point${a.points > 1 ? 's' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        const footer = `
            <button type="button" class="btn btn-outline" onclick="MWApp.closeModal()">Fermer</button>
            ${result.passed ? `
                <button type="button" class="btn btn-primary" onclick="MWCertificates.generatePDF('${result.id}')">
                    🏆 Télécharger certificat
                </button>
            ` : ''}
        `;

        if (typeof MWApp !== 'undefined') {
            MWApp.openModal('Détail du résultat', body, footer);
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

    /**
     * Rafraîchit tous les rapports
     */
    function refresh() {
        renderDashboard();
        renderRanking();
        renderResults();
    }

    // ============ API PUBLIQUE ============

    return {
        init,
        renderDashboard,
        renderRanking,
        renderResults,
        viewResultDetail,
        exportReportCSV,
        exportReportPDF,
        refresh
    };
})();