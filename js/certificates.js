/* ============================================================
   MEGAWATT ACADEMY - Module Certificats
   Génération PDF, QR Code, vérification
   ============================================================ */

const MWCertificates = (() => {
    'use strict';

    // ============ CONSTANTES ============
    const PDF_WIDTH = 297;    // A4 paysage (mm)
    const PDF_HEIGHT = 210;   // A4 paysage (mm)
    const MARGIN = 15;        // Marge (mm)

    // ============ ÉTAT INTERNE ============
    let logoBase64 = null;
    let signatureBase64 = null;

    // ============ INITIALISATION ============

    /**
     * Initialise le module certificats
     */
    function init() {
        bindCertificateEvents();
        renderCertificates();
        preloadImages();
    }

    /**
     * Lie les événements
     */
    function bindCertificateEvents() {
        const btnVerify = document.getElementById('btn-verify-certificate');
        const verifyInput = document.getElementById('certificate-verify-input');

        if (btnVerify) btnVerify.addEventListener('click', verifyCertificate);
        if (verifyInput) {
            verifyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') verifyCertificate();
            });
        }
    }

    /**
     * Précharge les images (logo, signature)
     */
    async function preloadImages() {
        const settings = MWStorage.Settings.getAll();
        
        try {
            // Charger logo
            if (settings.logo) {
                logoBase64 = await imageToBase64(settings.logo);
            }
            
            // Charger signature formateur
            if (settings.signature) {
                signatureBase64 = await imageToBase64(settings.signature);
            }
        } catch (error) {
            console.warn('Erreur chargement images certificat:', error);
        }
    }

    /**
     * Convertit une image en base64
     */
    function imageToBase64(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                try {
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (e) {
                    reject(e);
                }
            };
            
            img.onerror = () => reject(new Error('Impossible de charger l\'image'));
            img.src = url;
        });
    }

    // ============ GÉNÉRATION PDF ============

    /**
     * Génère un certificat PDF pour un résultat
     */
    async function generatePDF(resultId) {
        if (typeof window.jspdf === 'undefined') {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Librairie jsPDF non chargée.');
            }
            return;
        }

        const result = MWStorage.Results.getById(resultId);
        if (!result) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Résultat introuvable.');
            }
            return;
        }

        // Trouver le certificat associé
        const certificates = MWStorage.Certificates.getAll();
        const certificate = certificates.find(c => c.resultId === resultId);
        
        if (!certificate) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Certificat non trouvé.');
            }
            return;
        }

        // Afficher loader
        if (typeof MWApp !== 'undefined') {
            MWApp.showToast('info', 'Génération en cours', 'Création du certificat PDF...');
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // ============ FOND & BORDURE ============
            // Bordure décorative
            doc.setDrawColor(5, 106, 48); // #056a30
            doc.setLineWidth(2);
            doc.rect(MARGIN - 5, MARGIN - 5, PDF_WIDTH - 2 * (MARGIN - 5), PDF_HEIGHT - 2 * (MARGIN - 5));
            
            // Bordure intérieure fine
            doc.setLineWidth(0.5);
            doc.rect(MARGIN - 2, MARGIN - 2, PDF_WIDTH - 2 * (MARGIN - 2), PDF_HEIGHT - 2 * (MARGIN - 2));

            // ============ FILIGRANE ============
            if (logoBase64) {
                try {
                    doc.saveGraphicsState();
                    doc.setGState(new doc.GState({ opacity: 0.05 }));
                    doc.addImage(logoBase64, 'PNG', 
                        PDF_WIDTH / 2 - 40, PDF_HEIGHT / 2 - 40, 
                        80, 80, undefined, 'FAST');
                    doc.restoreGraphicsState();
                } catch (e) {
                    console.warn('Erreur filigrane:', e);
                }
            }

            // ============ EN-TÊTE ============
            let yPos = MARGIN + 10;

            // Logo MEGAWATT
            if (logoBase64) {
                try {
                    doc.addImage(logoBase64, 'PNG', MARGIN + 5, yPos, 25, 25);
                } catch (e) {
                    // Si erreur, continuer sans logo
                }
            }

            // Titre principal
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(32);
            doc.setTextColor(5, 106, 48); // #056a30
            doc.text('CERTIFICAT', PDF_WIDTH / 2, yPos + 10, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setTextColor(100, 100, 100);
            doc.text('DE RÉUSSITE', PDF_WIDTH / 2, yPos + 18, { align: 'center' });

            yPos += 35;

            // ============ CORPS DU CERTIFICAT ============
            
            // Texte introductif
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.setTextColor(80, 80, 80);
            doc.text('Nous certifions que', PDF_WIDTH / 2, yPos, { align: 'center' });
            
            yPos += 10;

            // Nom du candidat
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(5, 106, 48);
            doc.text(result.candidateName.toUpperCase(), PDF_WIDTH / 2, yPos, { align: 'center' });
            
            yPos += 12;

            // Texte suite
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.setTextColor(80, 80, 80);
            doc.text('a réussi avec succès l\'examen', PDF_WIDTH / 2, yPos, { align: 'center' });
            
            yPos += 8;

            // Titre de l'examen
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(3, 72, 31); // #03481f
            doc.text(result.examTitle, PDF_WIDTH / 2, yPos, { align: 'center' });
            
            yPos += 12;

            // Détails performance
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(100, 100, 100);
            doc.text(`avec une note de ${result.grade}/20 (${result.percentage}%)`, PDF_WIDTH / 2, yPos, { align: 'center' });
            
            yPos += 15;

            // ============ CACHET "CERTIFIÉ MEGAWATT" ============
            const stampX = PDF_WIDTH - MARGIN - 45;
            const stampY = yPos - 5;
            
            // Cercle du cachet
            doc.setDrawColor(5, 106, 48);
            doc.setLineWidth(1.5);
            doc.circle(stampX + 15, stampY + 15, 18);
            
            // Texte du cachet
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(5, 106, 48);
            doc.text('CERTIFIÉ', stampX + 15, stampY + 12, { align: 'center' });
            doc.text('MEGAWATT', stampX + 15, stampY + 18, { align: 'center' });

            // ============ SIGNATURES ============
            yPos += 15;
            const sigY = yPos;

            // Signature candidat
            if (result.signature) {
                try {
                    doc.addImage(result.signature, 'PNG', MARGIN + 10, sigY, 40, 20);
                } catch (e) {
                    console.warn('Erreur signature candidat:', e);
                }
            }
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text('Signature du candidat', MARGIN + 30, sigY + 23, { align: 'center' });
            doc.text(result.candidateName, MARGIN + 30, sigY + 27, { align: 'center' });

            // Signature formateur
            if (signatureBase64) {
                try {
                    doc.addImage(signatureBase64, 'PNG', PDF_WIDTH - MARGIN - 50, sigY, 40, 20);
                } catch (e) {
                    console.warn('Erreur signature formateur:', e);
                }
            }
            
            doc.text('Signature du formateur', PDF_WIDTH - MARGIN - 30, sigY + 23, { align: 'center' });
            doc.text('MEGAWATT ACADEMY', PDF_WIDTH - MARGIN - 30, sigY + 27, { align: 'center' });

            // ============ PIED DE PAGE ============
            yPos = PDF_HEIGHT - MARGIN - 15;

            // Date d'émission
            const issueDate = new Date(certificate.issuedAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Délivré le ${issueDate}`, PDF_WIDTH / 2, yPos, { align: 'center' });

            // Référence unique
            yPos += 6;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(5, 106, 48);
            doc.text(`Référence : ${certificate.reference}`, PDF_WIDTH / 2, yPos, { align: 'center' });

            // ============ QR CODE ============
            if (typeof QRCode !== 'undefined') {
                try {
                    // Générer QR Code
                    const qrContainer = document.createElement('div');
                    new QRCode(qrContainer, {
                        text: `https://megawatt.academy/verify/${certificate.reference}`,
                        width: 128,
                        height: 128,
                        colorDark: '#056a30',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.H
                    });

                    // Convertir en image
                    const qrImg = qrContainer.querySelector('img') || qrContainer.querySelector('canvas');
                    if (qrImg) {
                        const qrDataUrl = qrImg.tagName === 'CANVAS' 
                            ? qrImg.toDataURL('image/png')
                            : qrImg.src;
                        
                        doc.addImage(qrDataUrl, 'PNG', MARGIN + 5, PDF_HEIGHT - MARGIN - 35, 25, 25);
                        
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(7);
                        doc.setTextColor(100, 100, 100);
                        doc.text('Scanner pour vérifier', MARGIN + 17.5, PDF_HEIGHT - MARGIN - 8, { align: 'center' });
                    }
                } catch (e) {
                    console.warn('Erreur QR Code:', e);
                }
            }

            // ============ LIGNE DÉCORATIVE BAS ============
            doc.setDrawColor(5, 106, 48);
            doc.setLineWidth(1);
            doc.line(MARGIN, PDF_HEIGHT - MARGIN - 3, PDF_WIDTH - MARGIN, PDF_HEIGHT - MARGIN - 3);

            // ============ SAUVEGARDE ============
            const filename = `certificat-${certificate.reference}.pdf`;
            doc.save(filename);

            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Certificat généré', 'Le PDF a été téléchargé avec succès.');
            }

        } catch (error) {
            console.error('Erreur génération PDF:', error);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Impossible de générer le certificat : ' + error.message);
            }
        }
    }

    // ============ VÉRIFICATION ============

    /**
     * Vérifie un certificat par sa référence
     */
    function verifyCertificate() {
        const input = document.getElementById('certificate-verify-input');
        const resultDiv = document.getElementById('certificate-verify-result');
        
        if (!input || !resultDiv) return;

        const ref = input.value.trim().toUpperCase();
        
        if (!ref) {
            resultDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-text">Veuillez saisir une référence de certificat.</div>
                </div>
            `;
            return;
        }

        // Vérifier format
        if (!/^MW-\d{4}-\d{5}$/.test(ref)) {
            resultDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <div class="empty-state-title">Format invalide</div>
                    <div class="empty-state-text">Le format attendu est MW-AAAA-XXXXX</div>
                </div>
            `;
            return;
        }

        const certificate = MWStorage.Certificates.verify(ref);

        if (!certificate) {
            resultDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">❌</div>
                    <div class="empty-state-title">Certificat non trouvé</div>
                    <div class="empty-state-text">Aucun certificat ne correspond à cette référence.</div>
                </div>
            `;
            return;
        }

        // Certificat trouvé
        const result = MWStorage.Results.getById(certificate.resultId);
        const issueDate = new Date(certificate.issuedAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        resultDiv.innerHTML = `
            <div style="padding:1.5rem;background:rgba(16,185,129,0.08);border-radius:var(--radius-md);border-left:4px solid var(--color-success);margin-bottom:1.5rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
                    <span style="font-size:2rem;">✅</span>
                    <div>
                        <h3 style="color:var(--color-success);margin:0;">Certificat authentique</h3>
                        <p style="color:var(--color-text-muted);margin:0;font-size:0.9rem;">Ce certificat est valide et vérifié</p>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Référence</div>
                        <div style="font-weight:600;color:var(--color-primary);">${certificate.reference}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Candidat</div>
                        <div style="font-weight:600;">${MWSecurity.escapeHtml(certificate.candidateName)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Examen</div>
                        <div style="font-weight:600;">${MWSecurity.escapeHtml(certificate.examTitle)}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Note</div>
                        <div style="font-weight:600;color:var(--color-success);">${certificate.grade}/20 (${certificate.percentage}%)</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem;color:var(--color-text-muted);">Date d'émission</div>
                        <div style="font-weight:600;">${issueDate}</div>
                    </div>
                </div>
                ${result ? `
                    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--color-border);">
                        <button type="button" class="btn btn-sm btn-outline" onclick="MWCertificates.generatePDF('${result.id}')">
                            📄 Télécharger le PDF
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ============ AFFICHAGE LISTE ============

    /**
     * Affiche la liste des certificats
     */
    function renderCertificates() {
        const tbody = document.getElementById('certificates-tbody');
        if (!tbody) return;

        const certificates = MWStorage.Certificates.getAll();

        if (certificates.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            <div class="empty-state-icon">🏆</div>
                            <div class="empty-state-title">Aucun certificat</div>
                            <div class="empty-state-text">Les certificats seront générés automatiquement après réussite d'un examen.</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = certificates.map(c => {
            const issueDate = new Date(c.issuedAt).toLocaleDateString('fr-FR');
            return `
                <tr>
                    <td><code style="color:var(--color-primary);font-weight:600;">${MWSecurity.escapeHtml(c.reference)}</code></td>
                    <td>${MWSecurity.escapeHtml(c.candidateName)}</td>
                    <td>${MWSecurity.escapeHtml(c.examTitle)}</td>
                    <td>${issueDate}</td>
                    <td>
                        <div style="display:flex;gap:0.25rem;">
                            <button class="btn btn-sm btn-outline" onclick="MWCertificates.downloadCertificate('${c.resultId}')" title="Télécharger PDF">
                                📄
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="MWCertificates.shareCertificateWhatsApp('${c.reference}')" title="Partager WhatsApp">
                                📱
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="MWCertificates.deleteCertificate('${c.id}')" title="Supprimer">
                                🗑️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Télécharge le certificat PDF
     */
    function downloadCertificate(resultId) {
        generatePDF(resultId);
    }

    /**
     * Partage le certificat sur WhatsApp
     */
    function shareCertificateWhatsApp(reference) {
        const certificate = MWStorage.Certificates.getByRef(reference);
        if (!certificate) return;

        const settings = MWStorage.Settings.getAll();
        const phone = settings.whatsapp || '';
        
        const message = `🏆 *CERTIFICAT MEGAWATT ACADEMY*%0A%0A` +
            `📜 Référence : ${encodeURIComponent(certificate.reference)}%0A` +
            `👤 Candidat : ${encodeURIComponent(certificate.candidateName)}%0A` +
            `📝 Examen : ${encodeURIComponent(certificate.examTitle)}%0A` +
            `🎯 Note : ${certificate.grade}/20 (${certificate.percentage}%)%0A%0A` +
            `✅ Certificat vérifié et authentique%0A%0A` +
            `🔗 Vérification : https://megawatt.academy/verify/${encodeURIComponent(certificate.reference)}`;

        const url = phone 
            ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`
            : `https://wa.me/?text=${message}`;

        window.open(url, '_blank');
    }

    /**
     * Supprime un certificat
     */
    function deleteCertificate(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce certificat ?')) return;

        try {
            MWStorage.Certificates.delete(id);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Succès', 'Certificat supprimé.');
            }
            renderCertificates();
        } catch (error) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', error.message);
            }
        }
    }

    // ============ API PUBLIQUE ============

    return {
        init,
        generatePDF,
        verifyCertificate,
        renderCertificates,
        downloadCertificate,
        shareCertificateWhatsApp,
        deleteCertificate,
        preloadImages
    };
})();