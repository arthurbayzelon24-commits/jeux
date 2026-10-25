# Magic Cam

Site web gratuit qui utilise la caméra du téléphone ou du PC pour se filmer avec des **effets de magie en temps réel**, dans le style des vidéos de magie sur TikTok. Tout fonctionne dans le navigateur : il n’y a ni compte, ni serveur, ni envoi d’images.

## Effets

| Effet                                                              | Ce qui est suivi                        | Gestes                                                                                                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Éclairs**                                                        | mains (21 points par main)              | main ouverte : arcs entre les doigts et éclairs vers l’extérieur ; deux mains proches : arc entre les mains ; poing puis main ouverte d’un coup : décharge, flash et tremblement      |
| **Boule de feu**                                                   | mains + vitesse de la main              | main ouverte : boule de feu ; geste rapide : lancer, puis explosion ; poing : main enflammée ; deux mains proches : boule géante                                                      |
| **Aura magique**                                                   | silhouette du corps (segmentation)      | aura animée qui épouse le corps, flammes qui montent du contour ; mains levées : l’aura s’intensifie (éclairs)                                                                        |
| **Télékinésie**                                                    | mains, gestes, physique                 | objets 3D posés au sol ; main ouverte : ils se soulèvent et suivent la main ; pincement : attraper et lancer un objet ; index tendu : orbite ; poing puis main ouverte : onde de choc |
| **Téléportation**                                                  | silhouette + décor appris               | poing puis main ouverte (ou bouton « Téléporter », double-tap, touche T) : le corps se désintègre en particules et réapparaît ailleurs dans l’image, sur le vrai décor                |
| **Objets flottants**                                               | orientation 3D de la paume + silhouette | cristaux, pierres ou objets dorés en orbite autour de la main ; ils passent réellement derrière la main et le corps                                                                   |
| Cercle magique, Orbe de plasma, Galaxie spirale, Pétales de sakura | mains                                   | effets bonus ; le cercle et la galaxie s’inclinent avec la paume                                                                                                                      |

Chaque effet a plusieurs couleurs (bouton rond à droite de l’écran).

## Fonctions

- Bouton **Démarrer la caméra** ; demande d’autorisation, messages clairs en cas de refus.
- Caméra avant / arrière, effet miroir, compte à rebours, qualité 480p / 720p / 1080p.
- **Enregistrement vidéo** de l’image avec les effets, le micro et les sons des effets (synthétisés en direct). MP4 quand le navigateur le permet (Safari, Chrome récent), sinon WebM.
- **Photo** avec effets.
- **Télécharger** et **Partager** (feuille de partage du téléphone : TikTok, Instagram, WhatsApp…). Sans partage natif, la vidéo est téléchargée.
- **Mes vidéos** : vidéos et photos conservées dans le navigateur (IndexedDB).
- Interface sombre adaptée au téléphone et au PC, installable comme application (PWA).
- Raccourcis clavier dans la caméra : Espace (enregistrer), ← → (changer d’effet), T (action de l’effet), Échap (retour).

## Technique

- **Suivi** : [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) (HandLandmarker pour 2 mains en 3D, ImageSegmenter « selfie » pour la silhouette), exécuté localement en WebAssembly/WebGL. La bibliothèque est chargée depuis jsDelivr et les modèles depuis les serveurs de Google au premier lancement (environ 8 Mo).
- **Stabilité** : filtre One Euro sur chaque point, suivi des mains d’une image à l’autre, gestes avec hystérésis.
- **Rendu** : Canvas 2D (particules additives, éclairs fractals, maillages 3D éclairés, projection dans le plan de la paume), lumière projetée sur la scène, tremblement de caméra et flashs ; fond appris en continu pour la téléportation.
- **Aucune dépendance à installer, aucune étape de build** : ce sont des modules JavaScript natifs.

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
