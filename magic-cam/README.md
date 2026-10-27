# Magic Cam (Démo)

Site web gratuit qui utilise la caméra du téléphone ou du PC pour se filmer avec des **effets de magie en temps réel**, dans le style des vidéos de magie sur TikTok. Tout fonctionne dans le navigateur : il n’y a ni compte, ni serveur, ni envoi d’images.

## Principe

1. L’accueil montre uniquement les **62 pouvoirs**, en cartes dorées illustrées (rendues avec les vrais effets, voir `tools/`), triés par catégories (Mode libre, Animé, Feu, Énergie, Cosmos, Nature, Héros, Fun). L’étoile ★ d’une carte la met en favori : les favoris passent en tête, à l’accueil comme dans la rangée du studio.
2. On touche un pouvoir : la caméra s’ouvre, en plein écran, avec ce pouvoir. La rangée d’icônes en bas permet d’en changer.
3. **Pouvoirs à charge** (**Interface holographique**, Kamehameha, Rayon de feu, Sabre laser, Cercle magique, Orbe de plasma, Éclairs, Foudre du ciel, Boule de feu, Sphère spirale, Trou noir, Magie des ombres, Glace, Tornade, Pluie de météorites, Orbe de lave, Mini soleil, Bouclier d’énergie) : tant qu’on garde leur geste, une grande jauge circulaire se remplit autour de la main, l’effet grossit, l’écran s’illumine et vibre, puis au bout d’environ 6 secondes un **déclenchement final** se produit (flash, ondes de choc, rayons et éclairs). Certains ont leur propre final : tornade géante, barrage de météorites, éruption de lave, supernova, dôme de protection autour de soi.
4. L’écran de chargement n’apparaît qu’à la toute première ouverture (téléchargement des modèles).
5. Bouton rouge : **3, 2, 1**, puis enregistrement.

**Points de suivi** : chaque main est couverte d’un maillage de **220 points** (bords des doigts, phalanges, grille de la paume), calculé à chaque image à partir des 21 articulations détectées par le modèle, qui sont mises en évidence. Chaque articulation est prédite entre deux images de la caméra selon sa propre vitesse, pour que les points collent aux doigts.

Aucun message pendant le tournage. Au premier lancement, une seule question : « Voulez-vous les points ? », modifiable dans les Paramètres.

## Pouvoirs

Kamehameha, Rayon de feu, Sabre laser, Portail magique, Cercle magique, Orbe de plasma, Éclairs, Foudre du ciel, Boule de feu, Sphère spirale, Trou noir, Galaxie spirale, Cœur d’amour, Pétales de sakura, Papillons, Bassin de koïs, Feu d’artifice, Pouvoir de glace, Maîtrise de l’eau, Magie des ombres, Aura magique, Ailes d’ange, Téléportation, Télékinésie, Objets flottants, Dragon de feu, Tornade, Pluie de météorites, Orbe de lave, Mini soleil, Clap sonique, Bouclier d’énergie, Yeux laser, Lance-toile, Dessin néon, Pluie de code, Auréole d’ange, Planète, Boule de cristal, Aurore boréale, Étoiles filantes, Doigts comètes, Arc-en-ciel, Bulles de savon, Confettis, Pluie de pièces, Neige magique, Lucioles, Feux follets. **Animé** : Chidori, Genkidama, Getsuga Tenshō, Violet creux (bleu dans une main, rouge dans l’autre, rapprochez-les), Sharingan, Super Saiyan, Souffle de l’eau, Poing ardent, Haki des rois, Extension du territoire (signe V tenu une seconde). Le geste de chaque pouvoir est écrit sous sa carte ; chaque pouvoir a plusieurs couleurs (bouton rond à droite).

## Mode libre, points du corps, défis et boutique

Magic Cam est une application pour **filmer des vidéos où l’on semble avoir de vrais pouvoirs** : rien à l’écran ne ressemble à un jeu pendant le tournage.

- **Mode libre** (premier pouvoir) : peu importe ce que tu fais, ça fait un pouvoir. Main ouverte devant toi = cercle magique ; les deux mains en boule = trou noir entre tes mains ; agiter la main = éclairs ; les deux mains vers le ciel = foudre ; poing = sabre laser ; index = rayon de feu ; pincement = dessin néon ; signe V = feu d’artifice ; les deux poings = magie des ombres ; un grand geste rapide = pétales de sakura.
- **Plus de 100 000 points sur le corps** (option « Points de suivi ») : en plus des 220 points par main et du maillage du squelette, un nuage de points couvre toute ta silhouette (détourée par l’IA), avec un balayage lumineux. Le nombre exact s’affiche dans le compteur (Paramètres › compteur d’images) ; il dépend de la place que tu occupes dans l’image.
- **Double pouvoir** (bouton deux mains) : un pouvoir dans chaque main ; joins les mains pour une **Fusion**.
- **Gestes secrets** avec tous les pouvoirs : double applaudissement, mains au ciel, poing/main ouverte ×3 (final immédiat), tour de main, main immobile.
- **Défis du jour** 🏆 : trois défis par jour (filmer avec un pouvoir, déclencher un final, une vidéo de 15 s, 3 pouvoirs en Mode libre…), et une série de jours d’affilée. Tous les pouvoirs sont gratuits.

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
- Après un tournage : **Couper** (deux curseurs, début et fin, en gardant le son), **Accéléré ×2**, **Ralenti** (les 10 dernières secondes à demi-vitesse) ou **Boomerang** (le dernier instant joué à l’endroit puis à l’envers, deux fois), créés dans le navigateur. Télécharger, Partager (TikTok, Instagram, WhatsApp… depuis le téléphone), Mes vidéos (stockées dans le navigateur) : miniatures avec durée, filtre Tout / Vidéos / Photos, tri (récentes, anciennes, plus longues, par pouvoir), espace utilisé, et bouton « Sélectionner » pour supprimer plusieurs éléments d’un coup.
- Caméra avant / arrière, miroir, vignette cinéma, mode économie.
- **Filmer sans les mains** : montre tes deux paumes immobiles 1,5 s (le bouton rouge s’illumine) pour lancer le compte à rebours, et refais-le pour arrêter. Pratique quand le téléphone est posé loin.
- **Transition magique** (façon TikTok) : cache la caméra avec ta main puis enlève-la : tu passes à un autre pouvoir (tes favoris d’abord) avec un flash.
- **Fluidité des vidéos** : sur téléphone l’image est calculée en 720p (comme les applis de vidéo), chaque image enregistrée est une image réellement dessinée (30 i/s), le débit vidéo ménage l’encodeur du téléphone, et la silhouette pour le nuage de points n’est recalculée qu’une image sur trois.
- **Format de la vidéo** (Paramètres) : comme la caméra, 9:16 vertical (TikTok, Reels, Shorts), 1:1 carré ou 16:9. Un cadre montre à l’écran la partie enregistrée ; les photos suivent le même format.
- **Fondu au noir** (activé par défaut) : chaque vidéo s’ouvre et se termine par un fondu, comme au cinéma.
- **Cadence stable** : si le téléphone ne suit pas son écran 90/120 Hz, l’image se cale à 60 i/s réguliers avant de baisser la résolution.
- **Taille des pouvoirs** (Paramètres) : Petite, Normale, Grande ou Énorme.
- **Refaire** sur l’écran de résultat : relance aussitôt une nouvelle prise.
- **Pause / reprise** pendant l’enregistrement (bouton pause à la place de l’appareil photo) : plusieurs plans dans une seule vidéo, comme sur TikTok.
- **Lumière d’appoint** et **grille de cadrage** (Paramètres) : à l’écran seulement, jamais dans les vidéos.
- **Flou de mouvement** désactivable (coupé par défaut sur téléphone pour la fluidité). Avec une musique, les effets pulsent légèrement sur le rythme.
- **Météo magique** : **Pluie magique** (elle rebondit sur ta silhouette ; une main ouverte au-dessus de la tête sert de parapluie ; poing = tonnerre), **Neige qui tombe** (elle se pose sur ta tête et tes épaules, et tombe quand tu bouges vite), **Corps électrifié** (des arcs électriques courent sur ton contour ; poings serrés = charge, mains ouvertes d’un coup = décharge).
- **Fils d’énergie** : des fils lumineux relient les bouts des doigts de tes deux mains ; écarte-les pour les tendre, ferme un poing pour les casser. **Tornade de feu** : une spirale de flammes tourne autour de toi (devant et derrière) ; lève les bras ou crie pour qu’elle grandisse.
- **Disco** : projecteurs de couleur qui balaient la pièce, boule à facettes, flash quand tu lèves vite la main, lumière noire avec le poing, et tout pulse sur la musique de fond. **Contour néon** : ton contour brille en néon, les couleurs de l’arc-en-ciel défilent sur toi.
- **Mode Arc-en-ciel** (bouton couleur du studio, après la dernière couleur) : le pouvoir change de couleur tout seul toutes les 1,5 s.
- **Ralenti magique** (bouton sablier du studio) : les pouvoirs ralentissent pendant 6 s, toi non. **Ralenti cinéma** (Paramètres) : chaque coup final passe un instant au ralenti.
- **Cri de pouvoir** (Paramètres, micro) : plus tu cries fort, plus les pouvoirs sont gros, tes mains brillent et l’image tremble.
- **Multiclonage** (techniques ninja : mains jointes index levés = clones, poings joints = clones d’ombre, paumes jointes = clones hologrammes ; claquement de doigts = ils disparaissent) : deux puis quatre copies de toi apparaissent de chaque côté et te suivent avec un petit retard. **Invisibilité** (claquement de doigts) : tu disparais dans le décor, il ne reste qu’un léger miroitement. **Taille (Ant-Man)** (claquement de doigts) : minuscule, géant, puis normal.
- **Claquement de doigts** : détecté par la caméra (pouce sur le majeur, puis clac) et confirmé par le micro (le petit bruit sec du claquement).
- **Miroir** : l’image suit la caméra réellement utilisée (avant = miroir, arrière = image normale ; une webcam d’ordinateur est en miroir).
- **Pouvoirs de physique** (catégorie Physique) : **Télékinésie réelle** (pointe l’index vers un objet de la pièce et reste immobile : il est découpé de l’image et flotte au-dessus de ta main ; lance-le, il tombe et rebondit ; poing = il éclate en morceaux), **Onde de choc** (poing puis main ouverte, ou pousse la main vers la caméra : l’image se déforme sous l’onde), **Magnétisme** (de la limaille de fer suit le champ entre tes deux mains), **Arrêt du temps** (claque des doigts : le décor se fige en bleu, toi tu continues de bouger), **Gravité** (pince pour créer des balles qui rebondissent sur tes mains ; poing puis main ouverte : gravité inversée).
- **Portail façon Doctor Strange** : fais des cercles avec la main ; le portail montre ton propre paysage vu d’ailleurs (sans toi dedans). Tourne encore dessus pour l’agrandir.
- **Téléportation au claquement de doigts** (comme Thanos) : pouce et majeur collés, puis clac.
- **Musique de fond** (bouton ♪ dans la caméra) : Épique, Mystère ou Électro, composées en direct par l’application (aucun fichier, aucun droit d’auteur) et mixées dans les vidéos.
- **Ondes d’eau** (Physique) : l’image devient la surface de l’eau ; ton index crée des vagues qui déforment l’image, une main ouverte qui frappe fait une grosse vague.
- **Défilé** (bouton flèches croisées du studio) : un nouveau pouvoir (tes favoris d’abord) toutes les 4 s, avec flash, comme un montage automatique.
- **Écran brisé** : un coup de poing vers la caméra fissure l’écran comme du verre, là où tu frappes.
- **Traînées de couleur** (Paramètres > Affichage) : le bout de chaque doigt laisse une courte traînée arc-en-ciel, avec n’importe quel pouvoir (aussi dans les vidéos).
- **Recherche** : une barre sur l’accueil trouve un pouvoir par son nom, son geste ou sa catégorie (sans tenir compte des accents).
- **Pouvoir du jour** : sur l’accueil, un pouvoir mis en avant, différent chaque jour, avec un bouton Essayer.
- **Coach caméra** (Paramètres, activé par défaut) : une bulle à l’écran, jamais dans les vidéos, prévient quand il fait trop sombre, quand ta main n’est pas vue ou quand tu es trop loin.
- **Zoom comme l’appareil photo** : pastilles ,5 · 1 · 2 · 5 au-dessus du bouton d’enregistrement (touche pour sauter, glisse pour zoomer en douceur), pincement à deux doigts ou molette. Avec la caméra arrière, sous 0,75× l’application passe sur l’objectif ultra grand-angle du téléphone quand le navigateur le propose (vrai dézoom optique), et revient à l’objectif principal au-dessus de 0,95×.
- **Vrai dézoom** : sous 1×, l’image filmée rétrécit au milieu de l’écran (jusqu’à 0,22) et les bords sont remplis d’un flou, comme les bandes floues des applis vidéo : on te voit plus petit, dans les vidéos aussi.
- **Couleur de l’application** (Paramètres > Affichage) : Couleurs (par défaut : orange de feu, rose, violet, bleu, avec une couleur par catégorie), Or, Violet, Cyan, Rose, Vert ou Rouge.
- **Boule de feu instantanée** : la boule est dans la main tout de suite ; un geste rapide la lance dans cette direction, tendre la main vers la caméra l’envoie droit sur l’écran.
- **Zoom jusqu’à 10×** pour bien voir le visage.
- **Combo** (Mode libre) : trois pouvoirs différents en moins de 4 s déclenchent une explosion de toutes les couleurs.
- **Zoom à ta main** : barre de zoom à gauche de l’écran (**+** pour zoomer, **−** pour dézoomer, ou glisse le curseur ; double-touche = 1×), pince l’écran avec deux doigts (ou molette sur ordinateur), ou touche le bouton « 1× » (dézoom maximal → 1× → 2×). Pour dézoomer, l’application utilise d’abord l’objectif grand-angle quand le navigateur y donne accès, puis montre toute l’image filmée au lieu de la recadrer. Pour zoomer, elle utilise le zoom de la caméra, puis un zoom numérique qui se retrouve aussi dans les vidéos.
- **Filtres d’image** (bouton pellicule dans le studio) : Normal, Cinéma (bandes noires 2,39:1, teinte bleu-orangé), Néon, Vintage (sépia et grain), Noir et blanc (grain), Pop (couleurs vives, dégradé rose-bleu) et Coucher de soleil (orange, rose, violet). Le filtre s’applique à la scène filmée ; les pouvoirs gardent leurs couleurs, et il est enregistré dans les vidéos.

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
