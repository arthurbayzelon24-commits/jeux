# Magic Cam

Site web gratuit qui utilise la caméra du téléphone ou du PC pour se filmer avec des **effets de magie en temps réel**, dans le style des vidéos de magie sur TikTok. Tout fonctionne dans le navigateur : il n’y a ni compte, ni serveur, ni envoi d’images.

## Principe

1. L’accueil montre uniquement les **25 pouvoirs**, en deux colonnes de cartes dorées illustrées (rendues avec les vrais effets, voir `tools/`).
2. On touche un pouvoir : la caméra s’ouvre, en plein écran, avec ce pouvoir. La rangée d’icônes en bas permet d’en changer.
3. **Plus on maintient le pouvoir, plus il devient puissant** : un anneau de charge se remplit autour de la main, l’effet grossit, l’écran s’illumine et vibre, puis au bout d’environ 6 secondes un **déclenchement final** se produit (flash, ondes de choc, rayons et éclairs).
4. Bouton rouge : **3, 2, 1**, puis enregistrement.

Aucun message pendant le tournage. Au premier lancement, une seule question : « Voulez-vous les points ? », modifiable dans les Paramètres.

## Pouvoirs

Kamehameha, Rayon de feu, Sabre laser, Portail magique, Cercle magique, Orbe de plasma, Éclairs, Foudre du ciel, Boule de feu, Sphère spirale, Trou noir, Galaxie spirale, Cœur d’amour, Pétales de sakura, Papillons, Bassin de koïs, Feu d’artifice, Pouvoir de glace, Maîtrise de l’eau, Magie des ombres, Aura magique, Ailes d’ange, Téléportation, Télékinésie, Objets flottants. Le geste de chaque pouvoir est écrit sous sa carte ; chaque pouvoir a plusieurs couleurs (bouton rond à droite).

## Installation et mises à jour

Magic Cam s’installe comme une application (bouton « Installer » sur Android et ordinateur, ou Partager › « Sur l’écran d’accueil » sur iPhone). On ne l’installe qu’une fois : à chaque ouverture, l’application récupère la dernière version publiée et se recharge toute seule (jamais pendant un tournage). Les modèles de détection sont gardés en cache, ce qui accélère les lancements suivants.

## Fonctions

- Qualité jusqu’en **4K** (par défaut) ou **8K** : la caméra fournit la meilleure résolution qu’elle peut jusqu’à celle choisie, et la vidéo est enregistrée à cette résolution.
- Fluidité : la détection tourne sur une copie réduite de l’image, et entre deux images de la caméra la position des mains est prédite, ce qui fait suivre les pouvoirs au rythme de l’écran (60 images/s ou plus).
- Enregistrement vidéo avec compte à rebours (3, 2, 1 par défaut), micro et sons des pouvoirs synthétisés ; MP4 quand le navigateur le permet, sinon WebM. Photo.
- Télécharger, Partager (TikTok, Instagram, WhatsApp… depuis le téléphone), Mes vidéos (stockées dans le navigateur).
- Caméra avant / arrière, miroir, vignette cinéma, mode économie.

## Technique

- **Suivi** : [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) (HandLandmarker pour 2 mains en 3D, PoseLandmarker pour les points du corps, ImageSegmenter « selfie » pour la silhouette), exécuté sur une copie de 640 px de l’image, exécuté localement en WebAssembly/WebGL. La bibliothèque est chargée depuis jsDelivr et les modèles depuis les serveurs de Google au premier lancement (environ 14 Mo).
- **Stabilité** : filtre One Euro sur chaque point, suivi des mains d’une image à l’autre, gestes avec hystérésis.
- **Rendu** : Canvas 2D (particules additives, éclairs fractals, maillages 3D éclairés, projection dans le plan de la paume), lumière projetée sur la scène, tremblement de caméra et flashs ; fond appris en continu pour la téléportation.
- **Aucune dépendance à installer, aucune étape de build** : ce sont des modules JavaScript natifs.

## Illustrations

Les cartes (`assets/powers/`), la bannière et l’icône sont générées par `tools/art.js` avec les vrais effets sur une main dorée en fil de fer. Pour les régénérer : lancer `node magic-cam/serve.js`, puis `node magic-cam/tools/render-art.cjs` (nécessite Playwright).

## Lancer en local

```bash
node magic-cam/serve.js
# puis ouvrir http://localhost:8080
```

La caméra n’est autorisée par les navigateurs que sur **https://** ou **localhost**.

## Mettre en ligne (gratuit)

Le dossier `magic-cam/` est un site statique : il suffit de le publier tel quel sur un hébergeur en HTTPS.

- **Netlify** : glisser-déposer le dossier `magic-cam` sur <https://app.netlify.com/drop>.
- **GitHub Pages** : publier le dossier (par exemple via une branche `gh-pages` contenant son contenu).
- **Vercel / Cloudflare Pages** : dossier de sortie `magic-cam`, sans commande de build.

## Compatibilité

Chrome, Edge et Opera (ordinateur et Android), Safari (macOS et iOS 16+), Firefox récent. Sur les téléphones plus anciens, activez le **mode économie** dans les paramètres.
