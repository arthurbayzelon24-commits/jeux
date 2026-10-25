# Magic Cam

Site web gratuit qui utilise la caméra du téléphone ou du PC pour se filmer avec des **effets de magie en temps réel**, dans le style des vidéos de magie sur TikTok. Tout fonctionne dans le navigateur : il n’y a ni compte, ni serveur, ni envoi d’images.

## Principe

1. L’écran d’accueil présente les **pouvoirs**, chacun avec son icône et le geste à faire.
2. On touche un pouvoir : la caméra s’ouvre avec ce pouvoir. La rangée d’icônes en bas permet d’en changer.
3. On touche le bouton rouge : **3, 2, 1**, puis l’enregistrement démarre. On le touche à nouveau pour arrêter.

Aucun message ne s’affiche pendant le tournage. Au premier lancement, une seule question : « Voulez-vous les points ? » (points de suivi sur les mains et le corps), modifiable ensuite dans les Paramètres ou avec le bouton à 3 points.

## Pouvoirs

| Pouvoir                                                            | Geste                                                                                                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rayon de feu**                                                   | pointez l’index : un jet de flammes sort du doigt dans la direction pointée (petite flamme au bout du doigt sinon)                                                      |
| **Kamehameha**                                                     | mains jointes : une orbe d’énergie se charge entre les mains ; poussez les mains ou écartez-les vite : faisceau géant. Une main ouverte charge une petite orbe à lancer |
| **Sabre laser**                                                    | fermez le poing comme sur une poignée : la lame s’allume, avec traînée lumineuse quand on la balance ; deux poings, deux sabres                                         |
| **Portail magique**                                                | tracez un cercle avec l’index : un portail à étincelles s’ouvre sur un autre monde                                                                                      |
| **Éclairs**                                                        | main ouverte : arcs entre les doigts ; deux mains proches : arc entre les mains ; poing puis main ouverte : décharge                                                    |
| **Boule de feu**                                                   | main ouverte : boule de feu ; geste rapide : lancer et explosion ; deux mains proches : boule géante                                                                    |
| **Aura magique**                                                   | aura qui épouse la silhouette ; mains levées : elle s’intensifie                                                                                                        |
| **Télékinésie**                                                    | main ouverte : les objets 3D se soulèvent ; pincement : attraper et lancer ; poing puis main ouverte : onde de choc                                                     |
| **Téléportation**                                                  | poing puis main ouverte (ou bouton / double-tap) : désintégration et réapparition ailleurs                                                                              |
| **Objets flottants**                                               | paume vers le haut : objets 3D en orbite, qui passent derrière la main et le corps                                                                                      |
| Cercle magique, Orbe de plasma, Galaxie spirale, Pétales de sakura | effets de paume et d’ambiance                                                                                                                                           |

Chaque pouvoir a plusieurs couleurs (bouton rond à droite).

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
