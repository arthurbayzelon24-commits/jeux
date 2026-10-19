# SOLVEX AI — liste de contrôle des fonctionnalités

Version 2.2.0. Signification des statuts :

| Statut | Sens |
| --- | --- |
| ✅ **Implémenté et testé** | Vérifié par les tests automatisés (`npm test`) ou par le test navigateur de bout en bout (Chromium). |
| 🟢 **Implémenté** | Code réel, vérifié manuellement ou partiellement. |
| 🟡 **Limité** | Fonctionne, avec une restriction expliquée. |
| ⛔ **Non disponible** | Non implémenté. L’interface l’indique ; rien n’est simulé. |

**Version publique en ligne (lien claude.ai) :**
- Elle fonctionne sans serveur : studio, éditeur vidéo, éditeur photo et retouche locale.
- La génération IA, la galerie serveur et la capture (écran, webcam, micro) n’y sont pas disponibles.
- Les téléchargements passent par une confirmation de la plateforme.

## Accueil, tableau de bord et projets
| Fonction | Statut |
| --- | --- |
| Accueil « Que voulez-vous créer aujourd’hui ? » : illustration originale, hub Créer (image, vidéo, éditer un média), projets récents avec recherche, « Voir tous les projets », état vide | ✅ |
| Navigation : Accueil, Projets, Bibliothèque, Outils IA, Mes créations, Paramètres (pas de compte : SOLVEX n’a pas de comptes utilisateurs) | ✅ |
| Nouveau projet (3 cartes illustrées : vidéo, photo, SOLVEX AI), ouvrir, récents, recherche, favoris | ✅ |
| « Éditer une vidéo » / « Éditer une photo » : le sélecteur de fichiers s’ouvre, puis l’éditeur s’ouvre avec le média dans la bibliothèque du projet | ✅ |
| Raccourcis : enregistrer l’écran, enregistrer la webcam, projet vierge, reprendre un projet | 🟢 |
| Carte de projet : miniature, nom, type, date, Ouvrir, menu ⋯ (renommer, dupliquer, exporter, supprimer) | ✅ |
| Nom, miniature, date, type et état de sauvegarde de chaque projet | ✅ |
| Bibliothèque multimédia (import, recherche, favoris, suppression avec confirmation) | ✅ |
| Modèles : 12 modèles, dont les formats verticaux, les tutoriels, les diaporamas et la publicité ; le média se dépose sur un emplacement | 🟢 |
| Renommer, dupliquer, supprimer (avec confirmation), exporter/importer `.solvex` (médias inclus en option) | 🟢 |
| Sauvegarde automatique, sauvegarde manuelle (Ctrl+S), journal de récupération après interruption | ✅ |
| Stockage : IndexedDB du navigateur. Pas de synchronisation entre appareils (transfert par l’export `.solvex`) | 🟡 |

## Éditeur vidéo
| Fonction | Statut |
| --- | --- |
| Barre du haut : logo, retour, nom, état d’enregistrement, catégories, annuler/rétablir, aperçu plein écran, paramètres du projet, exporter | ✅ |
| Catégories Médias, Audio, Texte, Stickers, Effets, Transitions, Filtres, Sous-titres, Outils IA, chacune avec un vrai panneau | ✅ |
| Médias filtrés : ce projet, vidéos, images, audio, enregistrements, favoris, ressources SOLVEX ; les imports sont associés au projet | ✅ |
| Effets, transitions et filtres appliqués en un clic au clip sélectionné (réglages fins dans Propriétés) | ✅ |
| Volume de l’aperçu (sans effet sur l’export), choix du format, zoom « Ajuster » | ✅ |
| Téléphone : catégories en bas, bibliothèque et propriétés en feuilles tactiles | 🟢 (vérifié en 390 × 844 dans Chromium, pas sur un vrai téléphone) |
| Import de plusieurs médias (vidéo, image, audio), glisser-déposer dans la timeline | ✅ |
| Timeline multipiste : pistes vidéo, audio et texte, verrouillage, masquage, sourdine, rôles « Voix » et « Musique » | ✅ |
| Découpe aux deux bords, division au curseur, suppression, duplication, copier-coller, déplacement entre pistes | ✅ |
| Points d’entrée et de sortie, suppression de la portion avec resserrage, marqueurs | 🟢 |
| Aimantation, zoom de la timeline, sélection multiple, groupes | 🟢 |
| Annuler et rétablir illimités, historique cliquable | ✅ |
| Aperçu temps réel sur canvas, image par image, boucle, plein écran | ✅ |
| Mode débutant / avancé | 🟢 |
| Superposition de vidéos, d’images, de textes, de stickers et de formes ; opacité, ordre des calques, 10 modes de fusion | 🟢 |
| Masques rectangle, ellipse et tracé libre, contour progressif, inversion, masques animés | 🟢 |
| Incrustation sur fond vert ou bleu (pipette, tolérance, contour, suppression du débordement) | 🟢 |
| 17 transitions (durée, direction, intensité), applicables à toute une piste | ✅ |
| 20 effets réglables : flou, netteté, lueur, VHS, glitch, grain, pixelisation, tremblement, etc. | ✅ |
| Vitesse constante de 0,25× à 4× (hauteur du son conservée en option) | 🟢 |
| Images clés (position, échelle, rotation, opacité, volume, couleur, masque), 5 interpolations, préréglages, copier-coller d’animation | ✅ |
| Correction des couleurs (exposition, contraste, saturation, température, teinte, rotation de teinte, vignettage), préréglages, copier-coller | ✅ |
| Rampes de vitesse, courbes de vitesse, lecture inversée, interpolation d’images | ⛔ |
| Séquences imbriquées et compositions réutilisables | ⛔ |
| Courbes, roues chromatiques, LUT et histogramme pour la vidéo (disponibles en photo) | ⛔ |
| Suivi de mouvement (objet, visage, planaire) | ⛔ |
| Stabilisation, correction fisheye, anti-scintillement, super-résolution IA vidéo | ⛔ |
| Montage multicaméra, vidéo à 360° | ⛔ (feuille de route) |

## Audio
| Fonction | Statut |
| --- | --- |
| Pistes audio multiples, forme d’onde, volume par clip et par piste, fondus, panoramique, sourdine | ✅ |
| Détacher l’audio d’une vidéo, normalisation (−1 dBFS), détection des pics (marqueurs) | 🟢 |
| Détection et coupe des silences (seuil −40 dB, 0,6 s minimum) | ✅ |
| Atténuation automatique de la musique pendant la voix | 🟢 |
| Bibliothèque de 19 sons synthétisés par SOLVEX (CC0) : interface, transitions, bruitages, gaming, ambiances | 🟢 |
| Réduction de bruit, égaliseur, compresseur, réverbération, amélioration de voix | ⛔ |
| Musique et effets sonores générés par IA, bibliothèque musicale commerciale | ⛔ |

## Texte et sous-titres
| Fonction | Statut |
| --- | --- |
| Textes et titres | 🟢 |
| 8 modèles de textes | 🟢 |
| 6 polices système | 🟢 |
| Taille, graisse, italique, espacement, interligne, alignement | 🟢 |
| Couleur, dégradé, contour, ombre, fond | 🟢 |
| Animations : 7 entrées, 7 sorties, 3 animations en continu | 🟢 |
| Déplacement du texte à la souris dans l’aperçu | 🟢 |
| Sous-titres manuels avec mot mis en évidence (`*mot*`) | ✅ |
| Import et export SRT / VTT | ✅ |
| Alertes de lisibilité (chevauchements, durée trop courte, lecture trop rapide) | ✅ |
| Transcription automatique (avec `OPENAI_TRANSCRIBE_MODEL`, minutage avec Whisper) | 🟡 |
| Traduction et import de polices | ⛔ |

## Stickers, formes, modèles
| Fonction | Statut |
| --- | --- |
| Catalogue de stickers : environ 350 émojis Unicode en 12 catégories | 🟢 |
| Recherche, pagination et favoris des stickers ; l’API est prévue pour 100 000 éléments | 🟢 |
| 8 formes (cadre, bandeau de titre, contour lumineux…) | 🟢 |
| Stickers animés, éléments 3D, stickers générés par IA | ⛔ |

## Éditeur photo
| Fonction | Statut |
| --- | --- |
| Calques (image, texte, forme, sticker) : ordre, visibilité, opacité, fusion, transformation | ✅ |
| Recadrage, rotation, retournement | 🟢 |
| Taille de toile et 8 formats réseaux sociaux | 🟢 |
| Fond uni, dégradé ou transparent | 🟢 |
| Collage en grille | 🟢 |
| 14 réglages (exposition, hautes lumières, ombres, blancs, noirs, vibrance, netteté, débruitage…) | ✅ |
| 10 filtres, courbe de tonalité, LUT 3D `.cube` | ✅ |
| Avant / après, annuler / rétablir, export PNG, JPEG ou WebP (taille et qualité au choix) | ✅ |
| IA (avec `OPENAI_API_KEY`) : modification par instruction, suppression d’objet (masque peint) | 🟢 |
| IA : remplacement de l’arrière-plan, fond uni, extension de l’image, style, variante | 🟢 |
| Colorisation | 🟡 (expérimental) |
| Correction de perspective, détourage précis sans IA | ⛔ |

## IA et assistant
| Fonction | Statut |
| --- | --- |
| SOLVEX AI conversationnel : vrai modèle de langage existant (OpenAI ou modèle ouvert compatible : Ollama, vLLM, LM Studio), appelé par le serveur ; aucun modèle entraîné par SOLVEX | ✅ (testé avec un serveur au format Chat Completions ; à confirmer avec une vraie clé ou un modèle local) |
| Réponses en flux, étapes réelles (analyse, outil, rédaction), bouton Arrêter, Réessayer, délai maximal | ✅ |
| Outils validés par le serveur : image, vidéo, retouche de la dernière création, état des créations, musique, projet joint ; outils absents ou non configurés refusés | ✅ |
| Modifications de projet (titre stylisé, musique, transitions, renommage) proposées puis appliquées seulement après « Appliquer » | ✅ |
| Mémoire des préférences contrôlée : proposée, acceptée, désactivable, effaçable, stockée dans le navigateur | ✅ |
| Banc d’évaluation `npm run eval:assistant` (9 scénarios avec le vrai modèle configuré) | ✅ (9/9 avec le modèle scripté ; à lancer avec votre modèle) |
| SOLVEX AI dans la version claude.ai : réponses de Claude (sans génération) | 🟢 (dépend de l’autorisation donnée dans claude.ai ; non testable hors de claude.ai) |
| Bouton « Générer l’image » toujours visible, clavier, souris, tactile | ✅ |
| Formats 1:1, 2:3, 3:4, 4:5, 9:16, 3:2, 4:3, 16:9, 21:9 ; résolutions 512 px à 4K selon le modèle, raison affichée si indisponible | ✅ |
| Qualité Standard / Élevée / Très élevée / Ultra reliée au paramètre réel du modèle | ✅ (OpenAI) · 🟡 Pollinations : un seul niveau |
| 4K native (gpt-image-2 en 16:9, 9:16, 21:9) ; agrandissement par IA | ✅ native · ⛔ agrandissement IA non branché |
| Dimensions prévues avant et dimensions réelles après la génération | ✅ |
| Site public : génération d’images depuis le navigateur (Pollinations) et « Mes créations » locales | ✅ (service simulé dans les tests ; service réel non joignable depuis l’environnement de développement) |
| Génération texte → image et image → image (OpenAI) | ✅ (test avec un fournisseur factice ; à confirmer avec une vraie clé) |
| Génération texte → image gratuite sans clé (Pollinations, service tiers signalé) | 🟢 (adaptateur testé avec des réponses simulées ; service réel non joignable depuis l’environnement de développement) |
| Choix du modèle quand plusieurs services sont configurés ; options affichées selon le modèle (formats, qualité, référence, instruction négative) | ✅ |
| Formats réseaux sociaux : 1:1, 16:9, 9:16 (Stories/Reels), 4:5 (publication Instagram), 4:3, 3:2, 2:3 | ✅ |
| Description obligatoire, erreurs claires, progression réelle, brouillon conservé pendant la navigation | ✅ |
| Résultat : ouvrir en grand, télécharger, régénérer, modifier la description, envoyer vers l’éditeur ; enregistré dans Mes créations | ✅ |
| Génération texte → vidéo et image → vidéo (Google Veo, clips de 4, 6 ou 8 s) | ✅ (test avec un fournisseur factice ; à confirmer avec une vraie clé) |
| Vidéo : style et mouvement de caméra (écrits dans la description, le modèle n’ayant pas de réglage dédié), instruction négative | 🟡 |
| Hors ligne : la génération est bloquée avec un message clair | ✅ |
| Assistant de montage local : 14 types de demandes, avec un plan à accepter ou refuser, annulable | ✅ |
| Assistant : moments forts et version courte (selon l’énergie sonore, indicateur simple) | 🟡 |
| Détection des changements de scène | 🟢 |
| Analyse sémantique des scènes, recherche par description, traduction | ⛔ |

## Enregistrement
| Fonction | Statut |
| --- | --- |
| Écran, fenêtre ou onglet | 🟢 |
| Webcam | ✅ |
| Écran et webcam en incrustation | 🟢 |
| Microphone (narration) | 🟢 |
| Son système (si le navigateur le permet) | 🟡 |
| Compte à rebours, chronomètre, pause, envoi direct dans la timeline | ✅ |
| Musique de l’application coupée pendant l’enregistrement | 🟢 |
| Capture dans la version publique en ligne | ⛔ (refusée par la plateforme) |

## Export et partage
| Fonction | Statut |
| --- | --- |
| Export vidéo réel (MediaRecorder) : nom, format proposé par le navigateur, résolution de 480p à 4K | ✅ |
| Export vidéo : images par seconde, débit, plage, taille estimée, progression réelle, annulation, aperçu du fichier | ✅ |
| L’export se fait en temps réel et l’onglet doit rester visible | 🟡 |
| 4 préréglages réseaux sociaux | 🟢 |
| Partage natif (Web Share) quand le navigateur le permet | 🟢 |
| Publication directe sur YouTube, TikTok ou WhatsApp (nécessite une application OAuth officielle) | ⛔ |

## Audio (2.2)
| Fonction | Statut |
| --- | --- |
| Panneau Audio : recherche, 14 catégories, écoute, ajout à la timeline | ✅ |
| 30 musiques et 6 ambiances originales SOLVEX (libres de droits) + 19 effets | ✅ (les 55 rendus vérifiés non silencieux) |
| Bibliothèques en ligne Jamendo et Freesound, avec licence | 🟢 (formats d’API testés ; services réels à confirmer avec vos clés) |
| Import MP3, WAV, OGG, FLAC ; M4A/AAC selon le navigateur | ✅ (M4A/AAC refusés par Chromium sans codecs propriétaires, avec message clair) |
| Clip audio : déplacer, couper, volume, fondus, remplacer, ajuster à la vidéo, retirer | ✅ |
| Bouton Audio à côté du lecteur ; son dans l’aperçu et dans l’export | ✅ (niveau mesuré dans l’aperçu et dans le fichier exporté) |
| Synthèse vocale par IA | ⛔ |

## Textes stylisés (2.2)
| Fonction | Statut |
| --- | --- |
| 34 modèles en 12 catégories dans Stickers (vidéo) et dans l’éditeur photo | ✅ |
| Police, taille, couleur, dégradé, contour, ombre, lueur, fond, alignement, opacité, rotation, animations | ✅ |
| Texte présent dans l’aperçu et dans l’export (vidéo et PNG) | ✅ (pixels vérifiés dans les fichiers exportés) |

## Application, paramètres, mises à jour
| Fonction | Statut |
| --- | --- |
| Paramètres en 6 sections : Apparence, Préférences de création, Stockage et projets, Installation, Confidentialité et sécurité, Informations | ✅ |
| Grande barre « Installer SOLVEX AI sur mon appareil » : vraie invite du navigateur, instructions iPhone/iPad et ordinateur, état « déjà installée » | ✅ (invite simulée dans Chromium ; à vérifier sur appareil réel) |
| Musique d’ambiance de l’application : lecture, sourdine, volume | ✅ |
| Préférences d’apparence et de montage | 🟢 |
| Stockage : occupation, stockage persistant, vidage | 🟢 |
| Effacement de toutes les données locales | 🟢 |
| Application installable : manifeste complet (id, portée, couleurs, raccourcis), icônes PNG 192/512 et masquables, service worker | 🟢 |
| Installation depuis la version partagée sur claude.ai | ⛔ (page affichée dans un cadre : l’interface l’explique) |
| Mises à jour : dossier `public/updates/` (nom et notes de chaque version), proposées avec « Installer maintenant » ou « Plus tard » | ✅ |
| Historique des versions consultable | ✅ |
| Application de bureau native (.exe / .dmg) | ⛔ |
