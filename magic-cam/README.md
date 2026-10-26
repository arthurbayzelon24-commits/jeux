# Magic Cam

Site web gratuit qui utilise la caméra du téléphone ou du PC pour se filmer avec des **effets de magie en temps réel**, dans le style des vidéos de magie sur TikTok. Tout fonctionne dans le navigateur : il n’y a ni compte, ni serveur, ni envoi d’images.

## Principe

1. L’accueil montre uniquement les **61 pouvoirs**, en cartes dorées illustrées (rendues avec les vrais effets, voir `tools/`), triés par catégories (Animé, Feu, Énergie, Cosmos, Nature, Héros, Fun). L’étoile ★ d’une carte la met en favori : les favoris passent en tête, à l’accueil comme dans la rangée du studio.
2. On touche un pouvoir : la caméra s’ouvre, en plein écran, avec ce pouvoir. La rangée d’icônes en bas permet d’en changer.
3. **Pouvoirs à charge** (**Interface holographique**, Kamehameha, Rayon de feu, Sabre laser, Cercle magique, Orbe de plasma, Éclairs, Foudre du ciel, Boule de feu, Sphère spirale, Trou noir, Magie des ombres, Glace, Tornade, Pluie de météorites, Orbe de lave, Mini soleil, Bouclier d’énergie) : tant qu’on garde leur geste, une grande jauge circulaire se remplit autour de la main, l’effet grossit, l’écran s’illumine et vibre, puis au bout d’environ 6 secondes un **déclenchement final** se produit (flash, ondes de choc, rayons et éclairs). Certains ont leur propre final : tornade géante, barrage de météorites, éruption de lave, supernova, dôme de protection autour de soi.
4. L’écran de chargement n’apparaît qu’à la toute première ouverture (téléchargement des modèles).
5. Bouton rouge : **3, 2, 1**, puis enregistrement.

**Points de suivi** : chaque main est couverte d’un maillage de **220 points** (bords des doigts, phalanges, grille de la paume), calculé à chaque image à partir des 21 articulations détectées par le modèle, qui sont mises en évidence. Chaque articulation est prédite entre deux images de la caméra selon sa propre vitesse, pour que les points collent aux doigts.

Aucun message pendant le tournage. Au premier lancement, une seule question : « Voulez-vous les points ? », modifiable dans les Paramètres.

## Pouvoirs

Kamehameha, Rayon de feu, Sabre laser, Portail magique, Cercle magique, Orbe de plasma, Éclairs, Foudre du ciel, Boule de feu, Sphère spirale, Trou noir, Galaxie spirale, Cœur d’amour, Pétales de sakura, Papillons, Bassin de koïs, Feu d’artifice, Pouvoir de glace, Maîtrise de l’eau, Magie des ombres, Aura magique, Ailes d’ange, Téléportation, Télékinésie, Objets flottants, Dragon de feu, Tornade, Pluie de météorites, Orbe de lave, Mini soleil, Clap sonique, Bouclier d’énergie, Yeux laser, Lance-toile, Dessin néon, Pluie de code, Auréole d’ange, Planète, Boule de cristal, Aurore boréale, Étoiles filantes, Doigts comètes, Arc-en-ciel, Bulles de savon, Confettis, Pluie de pièces, Neige magique, Lucioles, Feux follets. **Animé** : Chidori, Genkidama, Getsuga Tenshō, Violet creux (bleu dans une main, rouge dans l’autre, rapprochez-les), Sharingan, Super Saiyan, Souffle de l’eau, Poing ardent, Haki des rois, Extension du territoire (signe V tenu une seconde). Le geste de chaque pouvoir est écrit sous sa carte ; chaque pouvoir a plusieurs couleurs (bouton rond à droite).

## Mécaniques de jeu

- **Mode Arène** (bouton cible dans la caméra), en trois modes : **Classique** (60 s, boss à mi-manche), **Survie** (3 vies : chaque cible manquée ou bombe touchée en coûte une ; des cœurs en redonnent) et **Zen** (sans bombes ni chrono, le score compte quand on quitte). Bonus à toucher : **x2** (points doublés 8 s) et **❄** (cibles gelées 5 s). Classique : Des cibles apparaissent ; ton pouvoir les détruit partout où il les touche (rayon, boule de feu, éclairs… l’application lit où l’effet brille à l’écran), tout comme un coup de main rapide. Orbes (+10), étoiles d’or mobiles (+50), cristaux à 3 coups (+30), bombes à éviter (−40), horloges (+3 s, trois au plus), et un **boss** à mi-manche avec sa barre de vie (+500). Les cibles touchées à moins de 2 s d’intervalle font monter le **combo** (jusqu’à x5) ; un final de pouvoir ou une rune balaie l’écran. Record et 5 meilleurs scores enregistrés.
- **Duel élémentaire** (menu Jeux) : à deux (une main chacun, gauche et droite) ou contre l’ordinateur. Au « 3, 2, 1, MAGIE ! », chacun montre un geste : poing = Feu, main ouverte = Eau, signe V = Foudre. L’Eau bat le Feu, la Foudre bat l’Eau, le Feu bat la Foudre ; le sort du gagnant traverse l’écran. Premier à 3 points.
- **Runes magiques** (pouvoir) : pince les doigts, dessine une forme en l’air, lâche. Cercle = Bouclier, Triangle = Explosion, Carré = Prison de glace, Zigzag = Foudre, Ligne = Lame, V = Météore. Les runes touchent aussi les cibles de l’Arène.
- **Double pouvoir** (bouton deux mains) : choisis un second pouvoir ; la main à droite de l’écran garde le premier, celle de gauche prend le second. Joins les deux mains pour une **Fusion** : une explosion aux couleurs des deux pouvoirs (elle balaie aussi les cibles de l’Arène).
- **Gestes secrets**, avec tous les pouvoirs : 5 gestes cachés à découvrir (indices dans la page Succès), dont un qui déclenche immédiatement le final du pouvoir.
- **Familier** : dès le niveau 2, un compagnon suit ta main avec tous les pouvoirs ; il devient **Petit dragon** au niveau 5 et **Phénix** au niveau 10, fait la fête quand tu déclenches un final et, dans l’Arène, fonce régulièrement sur la cible la plus proche (désactivable dans les Paramètres).
- **Maîtrise** : chaque pouvoir gagne jusqu’à 3 étoiles (★ 30 s d’utilisation, ★★ 3 min et un final, ★★★ 10 min et 5 finals), affichées sur sa carte.
- **Quête du Mage** : 12 étapes guidées sur l’accueil (premier final, première vidéo, première rune, Arène, double pouvoir, geste secret, duel…), chacune récompensée en XP ; la carte ouvre le bon pouvoir.
- **Progression** : expérience (temps de magie, nouveaux pouvoirs, finals, vidéos, runes, Arène), niveaux, 22 succès, défi du jour (+150 XP) sur l’accueil. Les annonces s’affichent sur l’accueil, jamais pendant le tournage.

## Interface holographique (style armure high-tech)

- Trois écrans de verre flottants : un **radar** dont les cibles sont vos mains, des **statistiques en direct** (vitesse de vos mains, images par seconde) et un **terminal**. On attrape un écran par sa barre de titre avec un pincement pour le déplacer.
- Un **clavier holographique AZERTY** en perspective : on appuie sur une touche par un petit coup de doigt vers le bas, par un pincement, ou en laissant le doigt posé (un anneau se remplit). Les vrais doigts passent **devant** les hologrammes.
- Touche **🎤** : on parle, le texte s’écrit dans le terminal et l’interface **répond à voix haute** (heure, date, salutations…). La reconnaissance vocale est celle du navigateur (Chrome l’envoie à son service en ligne) ; la voix est synthétisée par l’appareil.

## Suivi du corps et des mouvements rapides

- Corps entier suivi avec un maillage (bras, jambes, buste, tête), prédit entre deux images comme les mains.
- Mouvements rapides : les mains sont reconnues même floues (seuils de détection plus tolérants), associées d’une image à l’autre selon leur position prédite, et continuent de glisser un court instant si la détection les perd, sans couper les effets. Le portail se trace donc même en faisant un cercle rapide ou approximatif.
- Robustesse : une erreur dans un pouvoir ou une image ratée n’arrête jamais l’application ; si la détection en arrière-plan s’arrête, elle redémarre sur la page.
- Effets : léger flou de mouvement façon caméra et halo lumineux.

## Installation et mises à jour

Magic Cam s’installe comme une application (bouton « Installer » sur Android et ordinateur, ou Partager › « Sur l’écran d’accueil » sur iPhone). On ne l’installe qu’une fois : à chaque ouverture, l’application récupère la dernière version publiée et se recharge toute seule (jamais pendant un tournage). Les modèles de détection sont gardés en cache, ce qui accélère les lancements suivants.

## Fonctions

- **Fluidité** : l’image et les pouvoirs sont dessinés à la fréquence de l’écran (60, 90, 120 ou 144 Hz : jusqu’à environ 140 images/s sur un écran 144 Hz). La détection des mains et du corps tourne dans un **worker** (un fil séparé), donc l’affichage n’attend jamais l’IA ; entre deux images de la caméra, la position des mains est prédite. Si l’appareil ne suit pas, la résolution baisse un peu toute seule, puis remonte (jamais pendant un enregistrement). Compteur d’images par seconde activable dans les Paramètres.
- **Priorité « Fluidité maximale »** (par défaut) : la caméra vise d’abord **100 images par seconde ou plus** (120 ou 240 selon l’appareil) en prenant la plus grande définition qui l’atteint (1080p, 720p, 540p, puis 360p) ; si la caméra n’en est pas capable, elle prend la définition la plus rapide à 50-60 i/s. En 4K, les caméras ne filment qu’à 30 i/s. Si la caméra reste plus lente que l’écran, une **transition douce** fait glisser l’image d’une prise de vue à la suivante au lieu de la faire sauter. En « Netteté maximale », la définition choisie (jusqu’à 32K demandés) passe en premier. Effets en qualité Ultra avec halo lumineux. Le compteur (Paramètres) affiche les images/s de l’écran, de la caméra et de la détection.
- Enregistrement vidéo avec compte à rebours (3, 2, 1 par défaut), micro et sons des pouvoirs synthétisés ; MP4 quand le navigateur le permet, sinon WebM. Photo.
- Après un tournage : **Ralenti** (les 10 dernières secondes à demi-vitesse) ou **Boomerang** (le dernier instant joué à l’endroit puis à l’envers, deux fois), créés dans le navigateur. Télécharger, Partager (TikTok, Instagram, WhatsApp… depuis le téléphone), Mes vidéos (stockées dans le navigateur) : miniatures avec durée, filtre Tout / Vidéos / Photos, tri (récentes, anciennes, plus longues, par pouvoir), espace utilisé, et bouton « Sélectionner » pour supprimer plusieurs éléments d’un coup.
- Caméra avant / arrière, miroir, vignette cinéma, mode économie.
- **Filtres d’image** (bouton pellicule dans le studio) : Normal, Cinéma (bandes noires 2,39:1, teinte bleu-orangé), Néon, Vintage (sépia et grain) et Noir et blanc (grain). Le filtre s’applique à la scène filmée ; les pouvoirs gardent leurs couleurs, et il est enregistré dans les vidéos.

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
