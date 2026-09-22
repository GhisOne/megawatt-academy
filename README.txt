# 🎓 MEGAWATT ACADEMY

> **Plateforme professionnelle d'évaluation et de certification en ligne**  
> Application web 100% statique — Aucun backend requis — Compatible GitHub Pages & Netlify

![Version](https://img.shields.io/badge/version-1.0.0-056a30)
![License](https://img.shields.io/badge/license-Propriétaire-03481f)
![Status](https://img.shields.io/badge/status-Production-10b981)

---

## 📖 Présentation

**MEGAWATT ACADEMY** est une plateforme complète de gestion d'examens et de certifications professionnelles. Elle permet aux formateurs de créer des QCM, aux apprenants de passer des évaluations sécurisées, et aux RH de suivre les performances avec des rapports détaillés.

### ✨ Fonctionnalités principales

- 🔐 **Authentification sécurisée** (SHA-256, fingerprint navigateur, blocage anti-brute force)
- 👥 **4 rôles** : Administrateur, Formateur, RH, Apprenant
- ❓ **Banque de questions** : choix unique/multiple, points personnalisés, explications
- 📝 **Examens configurables** : durée, seuil, tirage aléatoire, mélange des réponses
- 🛡️ **Sécurité anti-fraude** : détection changement d'onglet, protection copier-coller, empreinte navigateur
- 🎓 **Signature électronique** obligatoire en fin d'examen
- 🏆 **Certificats PDF** automatiques avec QR Code de vérification
- 📊 **Rapports RH** : graphiques, Top 10, questions ratées, export CSV/PDF
- 📧 **Emails automatiques** via Web3Forms ou EmailJS
- 📱 **Partage WhatsApp** des résultats et certificats
- 🎨 **Design moderne** responsive (desktop, tablette, mobile)

---

## 🚀 Démarrage rapide

### Option 1 : GitHub Pages

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-username/megawatt-qcm.git
cd megawatt-qcm

# 2. Pousser sur GitHub
git push origin main

# 3. Activer GitHub Pages
# Settings → Pages → Source : main / root