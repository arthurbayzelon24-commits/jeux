# SOLVEX AI

Studio créatif complet, en français, qui réunit :

- la **génération d’images et de vidéos par IA** ;
- le **montage vidéo multipiste** ;
- un **éditeur photo à calques** ;
- l’**enregistrement d’écran, de webcam et de micro** ;
- l’**export**.

L’identité visuelle est propre à SOLVEX : un losange prismatique bleu, violet et cyan.

- **Accueil** (`/`) : « Que voulez-vous créer aujourd’hui ? », hub Créer (générer une image, générer une vidéo, éditer un média), projets récents avec recherche et menu (ouvrir, renommer, dupliquer, exporter, supprimer).
- **Nouveau projet** : trois cartes (vidéo, photo, SOLVEX AI) ; importer un fichier ouvre directement l’éditeur avec le média dans la bibliothèque du projet. Raccourcis : enregistrer l’écran ou la webcam, projet vierge, reprendre un projet.
- **Projets** (`/projets`), **Bibliothèque** (`/bibliotheque`), **Modèles** (`/modeles`).
- **Éditeur vidéo** :
  - barre du haut : logo, retour, nom, état d’enregistrement, catégories (Médias, Audio, Texte, Stickers, Effets, Transitions, Filtres, Sous-titres, Outils IA), annuler/rétablir, aperçu, paramètres du projet, exporter ;
  - sur téléphone : catégories en bas de l’écran, panneaux et propriétés en feuilles tactiles ;
  - timeline multipiste, découpe, division, aimantation, groupes, marqueurs, zoom « Ajuster » ;
  - 17 transitions, 20 effets, images clés, masques, incrustation sur fond vert ;
  - textes animés, stickers, formes, sous-titres SRT et VTT ;
  - outils audio, assistant de montage, export vidéo réel.
- **Éditeur photo** : calques, 14 réglages, filtres, courbe, LUT `.cube`, recadrage, formats réseaux sociaux, collage, outils IA.
- **SOLVEX AI** (`/assistant`) : assistant conversationnel branché sur un vrai modèle de langage existant (OpenAI, Claude d’Anthropic, ou un modèle ouvert servi en local par Ollama, vLLM, LM Studio…), appelé par le serveur. Plusieurs conversations (renommer, supprimer, conservées dans le navigateur), réponses mises en forme (listes, code avec « Copier »), images jointes quand le modèle sait les lire. Réponses en flux, étapes réelles (analyse, lancement, rédaction), outils contrôlés par le serveur : générer une image ou une vidéo, retoucher la dernière création (« rends-la plus lumineuse »), chercher une musique, lire un projet joint et proposer des modifications appliquées seulement après confirmation, mémoire des préférences contrôlée par l’utilisateur. SOLVEX n’entraîne aucun modèle : architecture, options étudiées, fournisseurs, coûts et tests dans [docs/ARCHITECTURE-IA.md](docs/ARCHITECTURE-IA.md). Dans la version claude.ai, c’est Claude qui répond (sans génération).
- **Outils IA** (`/images`, `/videos`, `/retouche`) : génération par OpenAI ou Pollinations (images) et Google Veo (vidéo), avec choix du modèle, brouillon conservé et « Envoyer vers l’éditeur ».
- **Mes créations** (`/galerie`) : images et vidéos générées, conservées sur le serveur.
- **Paramètres** (`/parametres`) : Apparence, Préférences de création, Stockage et projets, Installation (barre « Installer SOLVEX AI sur mon appareil »), Confidentialité et sécurité, Informations. Il n’y a pas de comptes utilisateurs, donc pas de section Compte.

La liste exacte de ce qui est implémenté, limité ou non disponible se trouve dans [`FONCTIONNALITES.md`](FONCTIONNALITES.md).

## Démarrage

Prérequis : **Node.js 20.12 ou plus récent**. Aucune dépendance à installer.

```bash
cp .env.example .env      # puis renseignez au moins une clé
npm start                 # http://127.0.0.1:3000
```

| Commande | Rôle |
| --- | --- |
| `npm start` | Lance le serveur. |
| `npm run dev` | Lance le serveur et le relance à chaque modification. |
| `npm test` | Lance les tests unitaires et d’intégration (API, tâches, sécurité, adaptateurs). |
| `npm run build` | Vérifie la syntaxe des fichiers JS, contrôle la cohérence des versions et met à jour le service worker (lancé aussi par `npm start`). |
| `npm run build:static` | Produit la version publique sans serveur dans `dist-static/`. |

Sans aucune clé, la génération d’images fonctionne quand même grâce à **Pollinations** (service tiers gratuit, activé par défaut, signalé à l’écran) — à condition que le serveur ait accès à Internet. La vidéo, elle, exige `GEMINI_API_KEY` : sans clé, le bouton est désactivé et l’interface indique la variable à ajouter.

### Installer l’application (PWA)

- Servez SOLVEX en **HTTPS** (ou ouvrez `http://localhost:3000` sur votre ordinateur) : c’est une exigence des navigateurs.
- Ouvrez **Paramètres → Installation** et touchez la barre « Installer SOLVEX AI sur mon appareil ».
  - Chrome, Edge, Android : la vraie fenêtre d’installation du navigateur s’ouvre.
  - iPhone / iPad : Safari → Partager → « Sur l’écran d’accueil » (Apple ne permet pas de bouton d’installation).
  - Déjà installée : la barre l’indique.
- Le service worker met en cache l’interface uniquement (jamais `/api/`, ni les créations, ni les clés). Hors ligne, le montage et la retouche locale restent utilisables ; la génération IA indique qu’elle a besoin d’une connexion.

## Version publique sans serveur

`npm run build:static` produit `dist-static/` : une version qui tourne entièrement dans le navigateur, sans le serveur Node.
- **Disponible :** le studio, les éditeurs et la retouche locale.
- **Indisponible :** la génération IA et la galerie serveur, affichées comme telles.

C’est cette version qui est publiée en lien partageable. Ses projets restent dans le navigateur de chaque visiteur.

## Héberger sur votre serveur

Installation complète, avec HTTPS, redémarrage automatique et surveillance : `sudo ./deploy/install.sh`. Le guide est dans [docs/HEBERGEMENT.md](docs/HEBERGEMENT.md).

## Publier sur Internet (Netlify)

Le dépôt contient `netlify.toml` : Netlify sait construire et publier le site sans autre réglage.

1. Créez un compte gratuit sur [netlify.com](https://www.netlify.com) (connexion avec GitHub).
2. **Add new site → Import an existing project → GitHub**, puis choisissez ce dépôt et la branche à publier.
3. Laissez les réglages proposés (ils viennent de `netlify.toml`) et cliquez sur **Deploy**.
4. Dans **Site configuration → Change site name**, choisissez l’adresse, par exemple `solvex-ai` → `https://solvex-ai.netlify.app` (si ce nom est libre).
5. Pour Google : ouvrez [Google Search Console](https://search.google.com/search-console), ajoutez l’adresse du site, validez-la (balise HTML ou fichier fourni par Google, à ajouter dans `public/`), puis envoyez `sitemap.xml`. L’apparition dans les résultats prend en général quelques jours.

Ce site public n’a pas de serveur Node : le studio, les éditeurs, l’export, l’installation de l’application et la capture d’écran fonctionnent, mais la génération IA est affichée comme indisponible. Pour la génération, il faut héberger le serveur (`npm start`) avec vos clés, par exemple sur Render ou Railway.

En local : `npm run build:site` produit `dist-site/` (variable `SITE_URL` pour remplir le sitemap et les balises de partage).

## Audio et textes

- **Panneau Audio** de l’éditeur vidéo : recherche, 14 catégories (musiques d’ambiance, cinématiques, électroniques, calmes, dynamiques, joyeuses, dramatiques, vidéos courtes, vlogs, présentations, sons d’ambiance, bruitages, effets sonores, voix et narration), écoute, ajout sur la piste Musique ou Voix.
  - **Bibliothèque SOLVEX** : 30 musiques et 6 ambiances originales synthétisées dans le navigateur, plus 19 effets — libres de droits (CC0). Ce n’est pas un catalogue commercial : pour plus de choix, branchez Jamendo et Freesound ou importez vos musiques.
  - **Vos fichiers** : MP3, WAV, OGG, FLAC ; M4A/AAC selon le navigateur (Chrome, Edge, Safari). Écoute, ajout, déplacement, découpe, volume, fondus, remplacement, « Ajuster à la durée de la vidéo ».
  - **Bouton Audio** à côté du lecteur : volume de lecture (sans effet sur l’export), volume du clip sélectionné, bibliothèque, import direct.
- **Textes stylisés** (Stickers) : 34 modèles en 12 catégories, puis police, taille, couleur, dégradé, contour, ombre, lueur néon, fond (boîte, pilule, bulle, soulignement, cadre), alignement, opacité, rotation, animations. Dessinés par le même moteur dans l’aperçu et l’export, en vidéo comme en photo.

## Notifications « VoltStack »

Aucune ligne du code de SOLVEX (application, serveur, configuration Netlify) ne mentionne VoltStack et l’application n’affiche aucune notification de ce nom. Ces messages viennent donc de l’extérieur de SOLVEX : le plus souvent une extension du navigateur, ou l’outil de prévisualisation ou d’hébergement utilisé. Pour les faire disparaître : désactivez l’extension concernée (ouvrez SOLVEX dans une fenêtre de navigation privée pour vérifier), ou ouvrez SOLVEX à sa propre adresse plutôt que dans l’outil de prévisualisation.

## Mises à jour

Chaque version a son fichier dans [`public/updates/`](public/updates) : `X.Y.Z.json`, avec `version`, `name`, `date` et `notes`. `index.json` indique la dernière version.

Pour publier une mise à jour :
1. Ajoutez le fichier de la version.
2. Mettez à jour `index.json` et `APP_VERSION` dans `public/js/lib/env.js`.
3. Lancez `npm run build`. Le script vérifie la cohérence et horodate le service worker.

Les visiteurs et l’application installée voient alors une fenêtre qui affiche le **nom** et les **notes** de la mise à jour, avec **Installer maintenant** ou **Plus tard**. L’historique complet se trouve dans Paramètres → Version et mises à jour.

## Variables d’environnement

Toutes les variables sont listées et commentées dans [`.env.example`](.env.example). Les essentielles :

| Variable | Requis pour | Valeur par défaut |
| --- | --- | --- |
| `OPENAI_API_KEY` | Génération et retouche d’images par IA | — |
| `OPENAI_IMAGE_MODEL` | Modèle d’image | `gpt-image-2` |
| `OPENAI_TEXT_MODEL` | « Améliorer le prompt » par un modèle de langage (facultatif) | vide, donc enrichissement local par règles |
| `OPENAI_TRANSCRIBE_MODEL` | Transcription automatique des sous-titres (facultatif) | vide, donc désactivée |
| `POLLINATIONS_ENABLED` | Génération d’images gratuite sans clé (service tiers) | `true` |
| `POLLINATIONS_MODEL` | Modèle Pollinations à demander (facultatif) | vide, donc modèle par défaut du service |
| `AI_PROVIDER` | Cerveau de SOLVEX AI : `openai`, `anthropic` (Claude) ou `openai-compatible` (Ollama, vLLM…) | `openai` |
| `ANTHROPIC_API_KEY` | Clé Anthropic, avec `AI_PROVIDER=anthropic` et `AI_MODEL` | — |
| `AI_VISION` | Images jointes aux messages de l’assistant | activé sauf pour `openai-compatible` |
| `AI_MODEL` | Nom exact du modèle de l’assistant (accepte les outils) | vide, donc `OPENAI_CHAT_MODEL`, puis `OPENAI_TEXT_MODEL`, sinon assistant désactivé |
| `AI_BASE_URL`, `AI_API_KEY` | Adresse (et clé éventuelle) d’un serveur compatible | — |
| `AI_MAX_TOOL_ROUNDS`, `AI_TIMEOUT_S` | Garde-fous de l’assistant | `5`, `120` s |
| `JAMENDO_CLIENT_ID` | Musiques Creative Commons en ligne dans le panneau Audio (facultatif) | — |
| `FREESOUND_API_KEY` | Bruitages et ambiances en ligne dans le panneau Audio (facultatif) | — |
| `GEMINI_API_KEY` | Génération de vidéos | — |
| `GEMINI_VIDEO_MODEL` | Modèle vidéo | `veo-3.1-generate-preview` |
| `SOLVEX_ACCESS_CODE` | Protéger l’instance par un code | vide, donc aucune protection |
| `SOLVEX_SESSION_SECRET` | Garder les sessions valides après un redémarrage | aléatoire à chaque démarrage |

Les clés ne quittent **jamais** le serveur : le navigateur ne parle qu’à l’API SOLVEX.

## Fournisseurs et capacités réelles

| Adaptateur | Fichier | Fonctions | Limites annoncées dans l’interface |
| --- | --- | --- | --- |
| OpenAI Images | `server/providers/openaiImages.js` | texte vers image (`/images/generations`) ; image vers image, retouche et masque (`/images/edits`) | `gpt-image-2` : 1:1, 16:9, 9:16, 4:3, 3:2, 2:3 en standard (~1,5 Mpx) ou haute définition (~4 Mpx). `gpt-image-1*` : 1:1, 3:2, 2:3 seulement. Qualité `auto/low/medium/high`, 1 à 4 images, 4 références au plus. |
| Pollinations | `server/providers/pollinations.js` | texte vers image (`GET https://image.pollinations.ai/prompt/{description}?width&height&seed&nologo`), sans clé | Une image par génération, pas d’image de référence, pas d’instruction négative. Formats 1:1, 16:9, 9:16, 4:5, 4:3, 3:2, 2:3. Accès anonyme limité en débit. La description est envoyée à ce service tiers : l’interface le signale. |
| Google Veo (API Gemini) | `server/providers/googleVeo.js` | texte vers vidéo, image vers vidéo (`:predictLongRunning`, puis sondage de l’opération) | Clips de **4, 6 ou 8 s**, formats 16:9 et 9:16, 720p ou 1080p (1080p seulement en 8 s). Veo ne fournit **pas de pourcentage** d’avancement. |

Ce que l’interface **ne prétend pas** faire :

- **Pas de vidéo de 30 s.** Les modèles connectés produisent un seul clip de 8 s au plus. Aucune composition de clips n’est implémentée.
- **L’agrandissement local n’est pas de la super-résolution IA.** C’est une interpolation de qualité suivie d’une accentuation, et l’interface l’indique.
- **Les visuels de l’accueil sont des compositions CSS décoratives.** Ils sont étiquetés « Exemple illustratif » et ne sont pas des générations.
- **Pas de génération à partir d’une image seule chez OpenAI.** L’API exige une instruction : SOLVEX envoie alors une consigne de variation explicite, signalée dans le détail de la création.

### Formats, résolutions et qualité des images

Les résolutions fixent le côté long : 512 px, 720p (1280 px), 1080p (1920 px), 1440p (2560 px), 4K (3840 px). Les dimensions exactes dépendent du format (16:9 en 4K = 3840 × 2160) et sont affichées avant de lancer la génération ; le fichier réellement obtenu est mesuré et affiché après.

| Modèle | Formats | Résolutions natives | Qualité |
| --- | --- | --- | --- |
| `gpt-image-2` (OpenAI) | 1:1, 2:3, 3:4, 4:5, 9:16, 3:2, 4:3, 16:9, 21:9 | 720p à 1440p partout ; **4K native en 16:9, 9:16 et 21:9** (le carré 4K, 3840 × 3840, dépasse la limite de 8,3 Mpx du modèle et est refusé avec la raison) ; 512 px refusé (sous le minimum de 655 360 px) | Standard → `quality=low`, Élevée → `medium`, Très élevée → `high`, Ultra/4K → `high` + plus grande taille native du format |
| `gpt-image-1*` | 1:1, 3:2, 2:3 | tailles fixes 1024 × 1024, 1536 × 1024, 1024 × 1536 | idem |
| Pollinations | les 9 formats | toutes demandées telles quelles ; **le service ne garantit pas la taille** : la taille réelle est affichée | un seul niveau (pas de réglage de qualité) |

Aucun agrandissement par IA n’est branché : SOLVEX ne présente jamais une image agrandie comme générée en 4K. L’agrandissement local de la page Retouche est une interpolation, signalée comme telle.

### Points à vérifier au premier essai réel

- **OpenAI a arrêté l’API vidéo Sora** (`sora-2`, Videos API) **le 24 septembre 2026**, sans remplaçant. La vidéo passe donc par Veo.
- **`gpt-image-1` est arrêté par OpenAI le 23 octobre 2026.** Gardez `gpt-image-2`, ou un modèle plus récent comme ceux de la famille `gpt-image-2.5` : vérifiez d’abord ses tailles et qualités, puis ajustez `FLEXIBLE_ASPECTS` si besoin.
- **Assistant :** testé avec un serveur imitant l’API Chat Completions d’OpenAI (même format de requêtes, d’appels d’outils et de réponses), pas avec le vrai service, inaccessible depuis l’environnement de développement. Indiquez dans `AI_MODEL` un modèle de discussion de votre compte qui accepte les outils (« function calling »), puis mesurez son comportement avec `npm run eval:assistant` (9 scénarios, générations simulées par défaut).
- **Jamendo et Freesound :** formats d’API (v3 et v2) reproduits dans les tests, services réels non joignables depuis l’environnement de développement. Les licences de chaque morceau sont affichées ; certaines interdisent l’usage commercial.
- **Pollinations :** adresse et paramètres non vérifiables depuis l’environnement de développement (réseau bloqué). Si le service change d’adresse ou renvoie autre chose qu’une image, l’erreur « Pollinations n’a pas renvoyé d’image » s’affiche ; ajustez alors `POLLINATIONS_BASE_URL`.
- **Veo, style et caméra :** l’API n’a pas de paramètre « style » ni « mouvement de caméra » ; ces choix sont ajoutés en fin de description (`Style: …`, `Camera: …`), et l’interface le dit. L’instruction négative est envoyée dans `parameters.negativePrompt`.
- **Veo, image vers vidéo :** l’image de départ est envoyée en `instances[0].image = { bytesBase64Encoded, mimeType }`. Si l’API refuse ce format, le message d’erreur du fournisseur s’affiche tel quel ; il suffit alors d’ajuster cette seule ligne de `googleVeo.js`.

### Ajouter un fournisseur

1. Créez `server/providers/monFournisseur.js` en suivant le contrat décrit dans `server/providers/base.js` :
   - `generate` / `edit` pour les images ;
   - `start` / `poll` / `download` pour les vidéos ;
   - un objet `capabilities` qui décrit les formats, résolutions et durées réellement pris en charge.
2. Ajoutez-le à la liste dans `server/providers/registry.js`.

L’interface lit `GET /api/capabilities` et n’affiche que ce que l’adaptateur déclare : rien d’autre n’est à modifier.

## Architecture

```
server/
  index.js              démarrage du serveur HTTP
  app.js                fichiers statiques, en-têtes de sécurité, routage de l’API, contrôle d’origine
  config.js             variables d’environnement (.env chargé si présent)
  routes/api.js         points d’accès REST et validation des requêtes
  ai/                   SOLVEX AI : llm.js (modèle connecté), agent.js (boucle outils), tools.js (outils validés), context.js (contexte et mémoire)
  lib/jobs.js           tâches asynchrones : file, concurrence, sondage, délais, reprise après redémarrage
  lib/store.js          créations (data/creations.json), médias, imports temporaires
  lib/files.js          contrôle des fichiers par signature binaire (PNG/JPEG/WebP/MP4) et dimensions
  lib/auth.js           code d’accès facultatif et cookie de session signé (HMAC)
  lib/rateLimit.js      limitation de débit par IP
  lib/prompt.js         styles et amélioration du prompt (règles locales ou modèle de langage)
  lib/validate.js       validation des paramètres
  providers/            adaptateurs IA et contrat commun
public/
  index.html, css/styles.css, assets/ (logos, favicon, icône d’application)
  js/app.js             démarrage, en-tête, session, bandeau hors ligne
  js/router.js          navigation côté client (History API)
  js/components/        logo, intro, particules, contrôles, suivi des tâches, dialogues
  js/pages/             accueil, studio d’images, studio vidéo, retouche, galerie
  js/lib/               API, état, outils DOM, traitement d’image local (canvas)
  js/studio/            studio de création (tout côté navigateur)
    db.js, media.js       stockage IndexedDB des projets et médias, import et analyse des fichiers
    project.js            modèle de projet et opérations de montage (pures, testées)
    editorStore.js        état, annuler/rétablir, sauvegarde auto, journal de récupération
    engine/               compositeur canvas, lecture synchronisée + Web Audio, effets, transitions,
                          images clés, analyse audio/scènes, export MediaRecorder
    ui/                   timeline, inspecteur, bibliothèque, export, enregistreur
    photo/engine.js       rendu photo non destructif (réglages, courbe, LUT)
    pages/                tableau de bord, éditeur vidéo, éditeur photo
  updates/              une fiche JSON par version (nom, date, notes) + index.json
  sw.js                 service worker (version estampillée par scripts/build.js)
scripts/eval-assistant.js  banc d’évaluation de l’assistant avec le vrai modèle configuré
docs/ARCHITECTURE-IA.md    architecture de l’IA, options, fournisseurs, sécurité, tests
tests/                  node:test, avec des fournisseurs factices injectés uniquement dans les tests
```

### API

| Méthode | Chemin | Rôle |
| --- | --- | --- |
| GET | `/api/capabilities` | Fournisseurs (configurés ou non), capacités, styles, limites |
| POST | `/api/uploads` | Import d’une image : corps binaire, type vérifié sur les octets |
| POST | `/api/prompt/enhance` | Amélioration du prompt |
| POST | `/api/images/generate` | Lance une génération d’image (réponse 202 avec la création) |
| POST | `/api/images/edit` | Retouche IA (`edit`, `objects`, `background`, `relight`, `variation`) |
| POST | `/api/videos/generate` | Lance une génération vidéo (réponse 202) |
| POST | `/api/chat/stream` | Conversation SOLVEX AI en flux (SSE) : étapes, texte, actions, fin ou erreur |
| POST | `/api/chat` | Même conversation, réponse JSON en une fois |
| GET | `/api/creations[?type=&sort=]` | Galerie et historique |
| GET | `/api/creations/:id` | Statut réel d’une tâche : `pending`, `running`, `succeeded` ou `failed` |
| POST | `/api/creations/:id/retry` | Relance d’une tâche échouée |
| POST | `/api/creations/local` | Enregistre un résultat de retouche locale |
| DELETE | `/api/creations/:id` | Supprime la création et ses fichiers |
| GET | `/api/media/:fichier` | Fichier privé, servi après authentification, avec prise en charge de `Range` |

## Sécurité et confidentialité

- **Clés et accès**
  - Les clés restent dans des variables d’environnement côté serveur et ne sont jamais journalisées.
  - Avec `SOLVEX_ACCESS_CODE`, toute l’API et tous les fichiers exigent une session : cookie `HttpOnly`, `SameSite=Strict`, signé.
  - Une requête qui modifie des données et vient d’une autre origine est refusée.
- **Fichiers**
  - Le type de chaque import est vérifié sur ses octets ; le type déclaré par le navigateur ne compte pas. La taille et les dimensions sont limitées.
  - Les noms de fichiers et identifiants sont validés : aucune traversée de chemin n’est possible.
  - Les imports sont **temporaires**. Ils sont supprimés dès que la génération réussit, sinon au bout de `SOLVEX_UPLOAD_TTL_MIN` minutes.
  - Les médias ne sont pas publics : ils passent par `/api/media` et respectent la même authentification.
- **Abus et erreurs**
  - Les générations, imports et améliorations de prompt sont limités par IP et par minute, avec une réponse `429` et l’en-tête `Retry-After`. Le nombre de tâches simultanées est plafonné.
  - Les prompts ne sont pas journalisés. Les erreurs des fournisseurs sont traduites en messages compréhensibles.
- **Navigateur**
  - Une politique CSP stricte s’applique (`script-src 'self'`, aucune ressource externe).
  - Le contenu saisi par l’utilisateur est toujours inséré comme texte, jamais comme HTML.

Pour exposer le serveur sur Internet :
- placez-le derrière un reverse proxy HTTPS ;
- définissez `SOLVEX_ACCESS_CODE`, `SOLVEX_SESSION_SECRET` et `SOLVEX_SECURE_COOKIES=true` (plus `SOLVEX_TRUST_PROXY=true` si le proxy transmet l’IP du client).

La limitation de débit est gardée en mémoire : avec plusieurs instances, il faudra un stockage partagé.

## Identité visuelle

Le symbole SOLVEX est un **portail hexagonal traversé par deux facettes de prisme** : la lumière réfractée qui prend forme. Une étincelle cyan marque l’instant de la création. Il est lisible sans texte, sur fond clair comme sur fond sombre.

| Fichier | Usage |
| --- | --- |
| `public/assets/logo-mark.svg` | Symbole seul |
| `public/assets/favicon.svg` | Favicon (traits épaissis) |
| `public/assets/app-icon.svg` | Icône d’application et PWA |
| `public/assets/logo-horizontal-light.svg` | Logo horizontal sur fond sombre |
| `public/assets/logo-horizontal-dark.svg` | Logo horizontal sur fond clair |

Palette : `#080B16` (bleu nuit), `#4263FF` (bleu électrique), `#8B5CF6` (violet), `#45E5F5` (cyan), `#F5F7FF` (blanc froid), `#9AA5C9` (gris bleuté).
