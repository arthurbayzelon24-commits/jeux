# SOLVEX AI

Studio créatif pour **générer des images et des vidéos par IA**, les **retoucher** et les **organiser** dans une galerie.
Interface en français, responsive, accessible au clavier, avec une identité visuelle propre (bleu nuit, bleu électrique, violet, cyan).

- **Studio d’images** : texte vers image, image(s) de référence vers image, 11 styles, formats, résolution, qualité, 1 à 4 images.
- **Studio vidéo** : texte vers vidéo et image de départ vers vidéo, avec le suivi réel de la tâche chez le fournisseur.
- **Retouche** :
  - outils locaux, sans IA, exécutés dans le navigateur : agrandissement ×2/×4, réduction du bruit, netteté, lumière et couleurs, niveaux automatiques ;
  - outils IA : modification d’une zone peinte au pinceau (masque), ajout ou suppression d’objets, remplacement de l’arrière-plan, correction de lumière, variation.
- **Galerie** : filtres Images / Vidéos, tri par date, grand format, téléchargement, suppression confirmée, relance d’un prompt, reprise en retouche.
- **Animation d’ouverture** : jouée une fois par session, elle respecte `prefers-reduced-motion`. Sa barre de progression ne suit que les vraies étapes de démarrage.

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
| `npm run check` (alias `npm run build`) | Vérifie la syntaxe de tous les fichiers JS. Le front est servi en modules ES natifs, donc il n’y a rien à compiler. |

Sans clé, le site fonctionne quand même : accueil, galerie, retouche locale. Les boutons de génération sont désactivés et l’interface indique la variable à ajouter.

## Variables d’environnement

Toutes les variables sont listées et commentées dans [`.env.example`](.env.example). Les essentielles :

| Variable | Requis pour | Valeur par défaut |
| --- | --- | --- |
| `OPENAI_API_KEY` | Génération et retouche d’images par IA | — |
| `OPENAI_IMAGE_MODEL` | Modèle d’image | `gpt-image-2` |
| `OPENAI_TEXT_MODEL` | « Améliorer le prompt » par un modèle de langage (facultatif) | vide, donc enrichissement local par règles |
| `GEMINI_API_KEY` | Génération de vidéos | — |
| `GEMINI_VIDEO_MODEL` | Modèle vidéo | `veo-3.1-generate-preview` |
| `SOLVEX_ACCESS_CODE` | Protéger l’instance par un code | vide, donc aucune protection |
| `SOLVEX_SESSION_SECRET` | Garder les sessions valides après un redémarrage | aléatoire à chaque démarrage |

Les clés ne quittent **jamais** le serveur : le navigateur ne parle qu’à l’API SOLVEX.

## Fournisseurs et capacités réelles

| Adaptateur | Fichier | Fonctions | Limites annoncées dans l’interface |
| --- | --- | --- | --- |
| OpenAI Images | `server/providers/openaiImages.js` | texte vers image (`/images/generations`) ; image vers image, retouche et masque (`/images/edits`) | `gpt-image-2` : 1:1, 16:9, 9:16, 4:3, 3:2, 2:3 en standard (~1,5 Mpx) ou haute définition (~4 Mpx). `gpt-image-1*` : 1:1, 3:2, 2:3 seulement. Qualité `auto/low/medium/high`, 1 à 4 images, 4 références au plus. |
| Google Veo (API Gemini) | `server/providers/googleVeo.js` | texte vers vidéo, image vers vidéo (`:predictLongRunning`, puis sondage de l’opération) | Clips de **4, 6 ou 8 s**, formats 16:9 et 9:16, 720p ou 1080p (1080p seulement en 8 s). Veo ne fournit **pas de pourcentage** d’avancement. |

Ce que l’interface **ne prétend pas** faire :

- **Pas de vidéo de 30 s.** Les modèles connectés produisent un seul clip de 8 s au plus. Aucune composition de clips n’est implémentée.
- **L’agrandissement local n’est pas de la super-résolution IA.** C’est une interpolation de qualité suivie d’une accentuation, et l’interface l’indique.
- **Les visuels de l’accueil sont des compositions CSS décoratives.** Ils sont étiquetés « Exemple illustratif » et ne sont pas des générations.
- **Pas de génération à partir d’une image seule chez OpenAI.** L’API exige une instruction : SOLVEX envoie alors une consigne de variation explicite, signalée dans le détail de la création.

### Points à vérifier au premier essai réel

- **OpenAI a arrêté l’API vidéo Sora** (`sora-2`, Videos API) **le 24 septembre 2026**, sans remplaçant. La vidéo passe donc par Veo.
- **`gpt-image-1` est arrêté par OpenAI le 23 octobre 2026.** Gardez `gpt-image-2`, ou un modèle plus récent comme ceux de la famille `gpt-image-2.5` : vérifiez d’abord ses tailles et qualités, puis ajustez `FLEXIBLE_ASPECTS` si besoin.
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
