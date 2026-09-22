/* ============================================================
   MEGAWATT ACADEMY - Module Email
   Envoi emails via Web3Forms et EmailJS
   Notifications automatiques : corrigé, rapport, certificat, invitation
   ============================================================ */

const MWMailer = (() => {
    'use strict';

    // ============ CONSTANTES ============
    const EMAILJS_CDN = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

    // ============ ÉTAT INTERNE ============
    let emailjsInitialized = false;
    let emailjsLoading = false;

    // ============ INITIALISATION ============

    /**
     * Initialise le module email
     */
    function init() {
        // Tenter de charger EmailJS si configuré
        const settings = MWStorage.Settings.getAll();
        if (settings.emailjsService && settings.emailjsTemplate && settings.emailjsUser) {
            loadEmailJS().then(() => {
                console.log('✅ EmailJS initialisé');
            }).catch(err => {
                console.warn('⚠️ EmailJS non chargé:', err.message);
            });
        }
    }

    /**
     * Charge dynamiquement le SDK EmailJS
     */
    function loadEmailJS() {
        return new Promise((resolve, reject) => {
            if (typeof emailjs !== 'undefined') {
                emailjsInitialized = true;
                resolve();
                return;
            }

            if (emailjsLoading) {
                reject(new Error('EmailJS déjà en cours de chargement'));
                return;
            }

            emailjsLoading = true;

            const script = document.createElement('script');
            script.src = EMAILJS_CDN;
            script.async = true;
            
            script.onload = () => {
                if (typeof emailjs !== 'undefined') {
                    const settings = MWStorage.Settings.getAll();
                    try {
                        emailjs.init(settings.emailjsUser);
                        emailjsInitialized = true;
                        emailjsLoading = false;
                        resolve();
                    } catch (e) {
                        emailjsLoading = false;
                        reject(e);
                    }
                } else {
                    emailjsLoading = false;
                    reject(new Error('SDK EmailJS non disponible après chargement'));
                }
            };
            
            script.onerror = () => {
                emailjsLoading = false;
                reject(new Error('Impossible de charger le SDK EmailJS'));
            };

            document.head.appendChild(script);
        });
    }

    // ============ UTILITAIRES ============

    /**
     * Vérifie si un service email est configuré
     */
    function isConfigured() {
        const settings = MWStorage.Settings.getAll();
        return !!(settings.web3formsKey || (settings.emailjsService && settings.emailjsTemplate && settings.emailjsUser));
    }

    /**
     * Valide un email
     */
    function isValidEmail(email) {
        return MWSecurity.isValidEmail(email);
    }

    /**
     * Formate une date en français
     */
    function formatDate(isoString) {
        return new Date(isoString).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Échappe les caractères HTML
     */
    function escapeHtml(text) {
        return MWSecurity.escapeHtml(text);
    }

    // ============ TEMPLATES HTML ============

    /**
     * Template de base pour les emails
     */
    function emailTemplate(title, content, accentColor = '#056a30') {
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:'Poppins',Arial,sans-serif;background:#f7f9f8;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9f8;padding:20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(5,106,48,0.08);">
                    <!-- En-tête -->
                    <tr>
                        <td style="background:linear-gradient(135deg,${accentColor},#03481f);padding:30px 40px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                                MEGAWATT ACADEMY
                            </h1>
                            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                                Plateforme d'évaluation et de certification
                            </p>
                        </td>
                    </tr>
                    <!-- Contenu -->
                    <tr>
                        <td style="padding:40px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Pied de page -->
                    <tr>
                        <td style="background:#f7f9f8;padding:20px 40px;text-align:center;border-top:1px solid #e1e8e4;">
                            <p style="margin:0;color:#6b7c73;font-size:12px;">
                                © ${new Date().getFullYear()} MEGAWATT ACADEMY - Tous droits réservés
                            </p>
                            <p style="margin:8px 0 0;color:#9aa8a0;font-size:11px;">
                                Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }

    /**
     * Template email résultat d'examen
     */
    function resultEmailTemplate(result) {
        const statusColor = result.passed ? '#10b981' : '#ef4444';
        const statusIcon = result.passed ? '✅' : '❌';
        const statusText = result.passed ? 'Réussi' : 'Échoué';

        const content = `
            <h2 style="margin:0 0 20px;color:#1a2e23;font-size:20px;">
                Bonjour ${escapeHtml(result.candidateName)},
            </h2>
            <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:0 0 20px;">
                Voici le résultat de votre examen <strong>"${escapeHtml(result.examTitle)}"</strong> passé le ${formatDate(result.createdAt)}.
            </p>
            
            <!-- Statut -->
            <div style="background:${result.passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border-left:4px solid ${statusColor};padding:20px;border-radius:8px;margin:20px 0;text-align:center;">
                <div style="font-size:48px;margin-bottom:10px;">${statusIcon}</div>
                <div style="font-size:20px;font-weight:700;color:${statusColor};margin-bottom:5px;">
                    Examen ${statusText}
                </div>
            </div>
            
            <!-- Statistiques -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                    <td width="33%" style="text-align:center;padding:15px;background:#f7f9f8;border-radius:8px;">
                        <div style="font-size:11px;color:#6b7c73;text-transform:uppercase;letter-spacing:0.5px;">Score</div>
                        <div style="font-size:22px;font-weight:700;color:#056a30;margin-top:5px;">
                            ${result.score}/${result.maxScore}
                        </div>
                    </td>
                    <td width="33%" style="text-align:center;padding:15px;background:#f7f9f8;border-radius:8px;">
                        <div style="font-size:11px;color:#6b7c73;text-transform:uppercase;letter-spacing:0.5px;">Pourcentage</div>
                        <div style="font-size:22px;font-weight:700;color:#056a30;margin-top:5px;">
                            ${result.percentage}%
                        </div>
                    </td>
                    <td width="33%" style="text-align:center;padding:15px;background:#f7f9f8;border-radius:8px;">
                        <div style="font-size:11px;color:#6b7c73;text-transform:uppercase;letter-spacing:0.5px;">Note /20</div>
                        <div style="font-size:22px;font-weight:700;color:#056a30;margin-top:5px;">
                            ${result.grade}
                        </div>
                    </td>
                </tr>
            </table>

            ${result.passed ? `
                <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:20px 0;">
                    🎉 <strong>Félicitations !</strong> Votre certificat a été généré automatiquement. 
                    Vous pouvez le télécharger depuis votre espace ou le récupérer auprès de votre formateur.
                </p>
            ` : `
                <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:20px 0;">
                    Ne vous découragez pas ! Vous pouvez consulter le corrigé détaillé pour comprendre vos erreurs 
                    et mieux préparer votre prochaine tentative.
                </p>
            `}

            <!-- Bouton d'action -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                    <td align="center">
                        <a href="#" style="display:inline-block;padding:14px 32px;background:#056a30;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                            📖 Consulter le corrigé complet
                        </a>
                    </td>
                </tr>
            </table>

            <p style="color:#6b7c73;font-size:13px;line-height:1.6;margin:20px 0 0;">
                Cordialement,<br>
                <strong>L'équipe MEGAWATT ACADEMY</strong>
            </p>
        `;

        return emailTemplate(`Résultat - ${result.examTitle}`, content);
    }

    /**
     * Template email certificat
     */
    function certificateEmailTemplate(certificate, result) {
        const content = `
            <div style="text-align:center;margin-bottom:30px;">
                <div style="font-size:64px;margin-bottom:10px;">🏆</div>
                <h2 style="margin:0;color:#056a30;font-size:24px;">
                    Félicitations ${escapeHtml(certificate.candidateName)} !
                </h2>
                <p style="color:#6b7c73;font-size:14px;margin-top:10px;">
                    Votre certificat est prêt
                </p>
            </div>

            <div style="background:#f7f9f8;border-radius:12px;padding:25px;margin:20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">Référence</span><br>
                            <strong style="color:#056a30;font-size:14px;">${escapeHtml(certificate.reference)}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">Examen</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${escapeHtml(certificate.examTitle)}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">Note obtenue</span><br>
                            <strong style="color:#10b981;font-size:14px;">${certificate.grade}/20 (${certificate.percentage}%)</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;">
                            <span style="color:#6b7c73;font-size:12px;">Date d'émission</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${formatDate(certificate.issuedAt)}</strong>
                        </td>
                    </tr>
                </table>
            </div>

            <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:20px 0;">
                Votre certificat officiel est désormais disponible. Vous pouvez le télécharger au format PDF 
                et le partager sur vos réseaux professionnels.
            </p>

            <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:20px 0;">
                🔍 <strong>Vérification en ligne :</strong><br>
                <code style="background:#f7f9f8;padding:4px 8px;border-radius:4px;color:#056a30;font-size:12px;">
                    https://megawatt.academy/verify/${encodeURIComponent(certificate.reference)}
                </code>
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                    <td align="center">
                        <a href="#" style="display:inline-block;padding:14px 32px;background:#056a30;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                            📄 Télécharger mon certificat PDF
                        </a>
                    </td>
                </tr>
            </table>

            <p style="color:#6b7c73;font-size:13px;line-height:1.6;margin:20px 0 0;">
                Cordialement,<br>
                <strong>L'équipe MEGAWATT ACADEMY</strong>
            </p>
        `;

        return emailTemplate(`Certificat - ${certificate.reference}`, content);
    }

    /**
     * Template email notification RH
     */
    function rhNotificationTemplate(result) {
        const content = `
            <h2 style="margin:0 0 20px;color:#1a2e23;font-size:20px;">
                📊 Nouvelle évaluation complétée
            </h2>
            <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:0 0 20px;">
                Un candidat vient de terminer un examen. Voici le résumé :
            </p>

            <div style="background:#f7f9f8;border-radius:12px;padding:25px;margin:20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">Candidat</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${escapeHtml(result.candidateName)}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">Email</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${escapeHtml(result.candidateEmail)}</strong>
                        </td>
                    </tr>
                    ${result.candidateService ? `
                        <tr>
                            <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                                <span style="color:#6b7c73;font-size:12px;">Service</span><br>
                                <strong style="color:#1a2e23;font-size:14px;">${escapeHtml(result.candidateService)}</strong>
                            </td>
                        </tr>
                    ` : ''}
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">Examen</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${escapeHtml(result.examTitle)}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">Résultat</span><br>
                            <strong style="color:${result.passed ? '#10b981' : '#ef4444'};font-size:14px;">
                                ${result.passed ? '✅ Réussi' : '❌ Échoué'} - ${result.grade}/20 (${result.percentage}%)
                            </strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;">
                            <span style="color:#6b7c73;font-size:12px;">Date</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${formatDate(result.createdAt)}</strong>
                        </td>
                    </tr>
                </table>
            </div>

            ${result.tabChanges > 0 ? `
                <div style="background:rgba(245,158,11,0.1);border-left:4px solid #f59e0b;padding:15px;border-radius:8px;margin:20px 0;">
                    <strong style="color:#d97706;">⚠️ Alerte sécurité</strong><br>
                    <span style="color:#1a2e23;font-size:13px;">
                        ${result.tabChanges} changement(s) d'onglet détecté(s) pendant l'examen.
                    </span>
                </div>
            ` : ''}

            <p style="color:#6b7c73;font-size:13px;line-height:1.6;margin:20px 0 0;">
                Consultez le tableau de bord RH pour plus de détails.
            </p>
        `;

        return emailTemplate('Nouvelle évaluation - Notification RH', content, '#f59e0b');
    }

    /**
     * Template email invitation
     */
    function invitationTemplate(exam, candidateName, candidateEmail) {
        const content = `
            <h2 style="margin:0 0 20px;color:#1a2e23;font-size:20px;">
                Bonjour ${escapeHtml(candidateName)},
            </h2>
            <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:0 0 20px;">
                Vous êtes invité(e) à passer l'examen suivant dans le cadre de votre formation :
            </p>

            <div style="background:#f7f9f8;border-radius:12px;padding:25px;margin:20px 0;border-left:4px solid #056a30;">
                <h3 style="margin:0 0 15px;color:#056a30;font-size:18px;">
                    ${escapeHtml(exam.title)}
                </h3>
                ${exam.description ? `
                    <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:0 0 15px;">
                        ${escapeHtml(exam.description)}
                    </p>
                ` : ''}
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:15px;">
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">⏱ Durée</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${exam.duration} minutes</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <span style="color:#6b7c73;font-size:12px;">❓ Nombre de questions</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${exam.questionCount} questions</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;">
                            <span style="color:#6b7c73;font-size:12px;">✅ Seuil de réussite</span><br>
                            <strong style="color:#1a2e23;font-size:14px;">${exam.passingScore}%</strong>
                        </td>
                    </tr>
                </table>
            </div>

            <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:20px 0;">
                <strong>Informations importantes :</strong>
            </p>
            <ul style="color:#1a2e23;font-size:14px;line-height:1.8;margin:0 0 20px;padding-left:20px;">
                <li>Vous ne disposez que d'<strong>une seule tentative</strong></li>
                <li>Le chronomètre démarre dès le début de l'examen</li>
                <li>Vous pouvez naviguer entre les questions et marquer celles à revoir</li>
                <li>Une signature électronique sera requise en fin d'examen</li>
                <li>Tout changement d'onglet sera enregistré</li>
            </ul>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
                <tr>
                    <td align="center">
                        <a href="#" style="display:inline-block;padding:14px 32px;background:#056a30;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                            🎓 Commencer l'examen
                        </a>
                    </td>
                </tr>
            </table>

            <p style="color:#6b7c73;font-size:13px;line-height:1.6;margin:20px 0 0;">
                Bonne chance !<br>
                <strong>L'équipe MEGAWATT ACADEMY</strong>
            </p>
        `;

        return emailTemplate(`Invitation - ${exam.title}`, content);
    }

    // ============ ENVOI EMAILS ============

    /**
     * Envoie un email via Web3Forms
     */
    async function sendViaWeb3Forms(to, subject, htmlContent) {
        const settings = MWStorage.Settings.getAll();
        
        if (!settings.web3formsKey) {
            throw new Error('Clé Web3Forms non configurée');
        }

        const formData = new FormData();
        formData.append('access_key', settings.web3formsKey);
        formData.append('subject', subject);
        formData.append('from_name', 'MEGAWATT ACADEMY');
        formData.append('to', to);
        formData.append('message', htmlContent);
        formData.append('html', 'true');

        const response = await fetch(WEB3FORMS_ENDPOINT, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Erreur Web3Forms: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Erreur Web3Forms');
        }

        return data;
    }

    /**
     * Envoie un email via EmailJS
     */
    async function sendViaEmailJS(to, subject, htmlContent) {
        const settings = MWStorage.Settings.getAll();
        
        if (!emailjsInitialized) {
            await loadEmailJS();
        }

        if (typeof emailjs === 'undefined') {
            throw new Error('EmailJS non disponible');
        }

        const templateParams = {
            to_email: to,
            subject: subject,
            message: htmlContent,
            from_name: 'MEGAWATT ACADEMY',
            reply_to: settings.emailDest || 'no-reply@megawatt.academy'
        };

        const response = await emailjs.send(
            settings.emailjsService,
            settings.emailjsTemplate,
            templateParams
        );

        return response;
    }

    /**
     * Envoie un email (essaie Web3Forms puis EmailJS)
     */
    async function sendEmail(to, subject, htmlContent) {
        if (!isValidEmail(to)) {
            throw new Error('Email destinataire invalide');
        }

        const settings = MWStorage.Settings.getAll();
        let lastError = null;

        // Essayer Web3Forms
        if (settings.web3formsKey) {
            try {
                await sendViaWeb3Forms(to, subject, htmlContent);
                return { success: true, service: 'web3forms' };
            } catch (error) {
                console.warn('Web3Forms échec:', error.message);
                lastError = error;
            }
        }

        // Essayer EmailJS
        if (settings.emailjsService && settings.emailjsTemplate && settings.emailjsUser) {
            try {
                await sendViaEmailJS(to, subject, htmlContent);
                return { success: true, service: 'emailjs' };
            } catch (error) {
                console.warn('EmailJS échec:', error.message);
                lastError = error;
            }
        }

        throw lastError || new Error('Aucun service email configuré');
    }

    // ============ FONCTIONS DE HAUT NIVEAU ============

    /**
     * Envoie la notification de résultat au candidat
     */
    async function sendResultNotification(result) {
        if (!isConfigured()) {
            console.log('📧 Service email non configuré, notification ignorée');
            return { success: false, reason: 'not_configured' };
        }

        if (!result || !result.candidateEmail) {
            return { success: false, reason: 'invalid_data' };
        }

        try {
            const html = resultEmailTemplate(result);
            const subject = `📊 Résultat de votre examen : ${result.examTitle}`;
            
            await sendEmail(result.candidateEmail, subject, html);

            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Email envoyé', 'Le résultat a été envoyé au candidat.');
            }

            return { success: true };
        } catch (error) {
            console.error('Erreur envoi résultat:', error);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Email non envoyé', 'Erreur : ' + error.message);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Envoie le certificat au candidat
     */
    async function sendCertificate(certificate, result) {
        if (!isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        if (!certificate || !result || !result.candidateEmail) {
            return { success: false, reason: 'invalid_data' };
        }

        try {
            const html = certificateEmailTemplate(certificate, result);
            const subject = `🏆 Votre certificat MEGAWATT - ${certificate.reference}`;
            
            await sendEmail(result.candidateEmail, subject, html);

            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Certificat envoyé', 'Le certificat a été envoyé par email.');
            }

            return { success: true };
        } catch (error) {
            console.error('Erreur envoi certificat:', error);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Email non envoyé', 'Erreur : ' + error.message);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Envoie une notification RH
     */
    async function sendRHNotification(result) {
        if (!isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const settings = MWStorage.Settings.getAll();
        if (!settings.emailDest) {
            return { success: false, reason: 'no_rh_email' };
        }

        if (!result) {
            return { success: false, reason: 'invalid_data' };
        }

        try {
            const html = rhNotificationTemplate(result);
            const subject = `📊 Nouvelle évaluation : ${result.candidateName} - ${result.examTitle}`;
            
            await sendEmail(settings.emailDest, subject, html);

            return { success: true };
        } catch (error) {
            console.error('Erreur envoi notification RH:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Envoie une invitation à passer un examen
     */
    async function sendInvitation(examId, candidateName, candidateEmail) {
        if (!isConfigured()) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('warning', 'Email non configuré', 'Configurez Web3Forms ou EmailJS dans les paramètres.');
            }
            return { success: false, reason: 'not_configured' };
        }

        const exam = MWStorage.Exams.getById(examId);
        if (!exam) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Examen introuvable.');
            }
            return { success: false, reason: 'exam_not_found' };
        }

        if (!isValidEmail(candidateEmail)) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Email candidat invalide.');
            }
            return { success: false, reason: 'invalid_email' };
        }

        try {
            const html = invitationTemplate(exam, candidateName, candidateEmail);
            const subject = `🎓 Invitation à l'examen : ${exam.title}`;
            
            await sendEmail(candidateEmail, subject, html);

            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('success', 'Invitation envoyée', `Email envoyé à ${candidateEmail}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Erreur envoi invitation:', error);
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Impossible d\'envoyer l\'invitation : ' + error.message);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Envoie le rapport complet aux RH
     */
    async function sendFullReport() {
        if (!isConfigured()) {
            return { success: false, reason: 'not_configured' };
        }

        const settings = MWStorage.Settings.getAll();
        if (!settings.emailDest) {
            return { success: false, reason: 'no_rh_email' };
        }

        const results = MWStorage.Results.getAll();
        const stats = MWStorage.Results.getStats();

        const content = `
            <h2 style="margin:0 0 20px;color:#1a2e23;font-size:20px;">
                📈 Rapport complet MEGAWATT ACADEMY
            </h2>
            <p style="color:#1a2e23;font-size:14px;line-height:1.6;margin:0 0 20px;">
                Voici le rapport consolidé des évaluations en date du ${formatDate(new Date().toISOString())}.
            </p>

            <div style="background:#f7f9f8;border-radius:12px;padding:25px;margin:20px 0;">
                <h3 style="margin:0 0 15px;color:#056a30;font-size:16px;">Statistiques globales</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <strong>Total candidats :</strong> ${stats.total}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <strong>Réussites :</strong> ${stats.passed} (${stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}%)
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e1e8e4;">
                            <strong>Échecs :</strong> ${stats.failed}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;">
                            <strong>Moyenne générale :</strong> ${stats.average.toFixed(2)}/20
                        </td>
                    </tr>
                </table>
            </div>

            <p style="color:#6b7c73;font-size:13px;line-height:1.6;margin:20px 0 0;">
                Consultez le tableau de bord pour plus de détails et analyses.
            </p>
        `;

        const html = emailTemplate('Rapport complet MEGAWATT ACADEMY', content);
        const subject = `📈 Rapport MEGAWATT ACADEMY - ${new Date().toLocaleDateString('fr-FR')}`;

        try {
            await sendEmail(settings.emailDest, subject, html);
            return { success: true };
        } catch (error) {
            console.error('Erreur envoi rapport:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Ouvre la modale d'envoi d'invitation
     */
    function openInvitationModal(examId) {
        const exam = MWStorage.Exams.getById(examId);
        if (!exam) return;

        const body = `
            <form id="invitation-form" class="form-grid">
                <div class="form-group">
                    <label for="inv-name">Nom du candidat *</label>
                    <input type="text" id="inv-name" required placeholder="Ex: Jean DUPONT" />
                </div>
                <div class="form-group">
                    <label for="inv-email">Email du candidat *</label>
                    <input type="email" id="inv-email" required placeholder="exemple@email.com" />
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label>Examen concerné</label>
                    <div style="padding:0.75rem;background:var(--color-bg-soft);border-radius:var(--radius-md);">
                        <strong style="color:var(--color-primary);">${escapeHtml(exam.title)}</strong><br>
                        <span style="font-size:0.85rem;color:var(--color-text-muted);">
                            ${exam.duration} min • ${exam.questionCount} questions • Seuil ${exam.passingScore}%
                        </span>
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-outline" onclick="MWApp.closeModal()">Annuler</button>
            <button type="button" class="btn btn-primary" onclick="MWMailer.sendInvitationFromModal('${examId}')">
                📧 Envoyer l'invitation
            </button>
        `;

        if (typeof MWApp !== 'undefined') {
            MWApp.openModal('Envoyer une invitation', body, footer);
        }
    }

    /**
     * Envoie l'invitation depuis la modale
     */
    async function sendInvitationFromModal(examId) {
        const name = document.getElementById('inv-name')?.value.trim();
        const email = document.getElementById('inv-email')?.value.trim();

        if (!name || !email) {
            if (typeof MWApp !== 'undefined') {
                MWApp.showToast('danger', 'Erreur', 'Veuillez remplir tous les champs.');
            }
            return;
        }

        const result = await sendInvitation(examId, name, email);
        
        if (result.success) {
            if (typeof MWApp !== 'undefined') {
                MWApp.closeModal();
            }
        }
    }

    // ============ API PUBLIQUE ============

    return {
        init,
        isConfigured,
        sendEmail,
        sendResultNotification,
        sendCertificate,
        sendRHNotification,
        sendInvitation,
        sendFullReport,
        openInvitationModal,
        sendInvitationFromModal,

        // Templates (pour debug/test)
        templates: {
            result: resultEmailTemplate,
            certificate: certificateEmailTemplate,
            rhNotification: rhNotificationTemplate,
            invitation: invitationTemplate
        }
    };
})();