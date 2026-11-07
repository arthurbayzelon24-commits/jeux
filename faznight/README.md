# FAZNIGHT — la collection d'horreur animatronique

Jeu d'horreur de surveillance nocturne jouable dans le navigateur, pensé d'abord pour le téléphone (Android et iPhone) et compatible ordinateur. Tout est original :
- les animatroniques sont des modèles 3D articulés en temps réel (Three.js / WebGL), avec squelette, endosquelette métallique, matériaux usés et yeux lumineux ;
- les deux bureaux sont de vraies scènes 3D, avec éclairage dynamique et ombres ;
- les caméras utilisent des décors 2.5D dessinés en code ;
- chaque son et chaque musique est synthétisé en direct avec la Web Audio API.

Le jeu n'utilise aucun fichier image ou audio externe. Sa seule bibliothèque est Three.js r128 (licence MIT), incluse dans `vendor/`.

## Lancer le jeu

Le dossier `faznight/` est un site statique autonome :

```bash
cd faznight
python3 -m http.server 8765    # puis ouvrir http://localhost:8765
```

Pour jouer sur téléphone, il suffit de publier le dossier sur un hébergement statique : Netlify Drop (glisser-déposer le dossier `faznight`), GitHub Pages ou Cloudflare Pages. Une fois la page ouverte, le jeu s'installe comme une application (PWA) :
- Android : menu ⋮ › Installer ;
- iPhone : Partager › Sur l'écran d'accueil.

Il fonctionne ensuite hors ligne.

## Contenu

- **Chapitre 1 — Grimwood's Pizza Palace** : deux portes, deux lumières, 11 caméras et une batterie globale. Les animatroniques sont Bruno le Blaireau, Gus le Bouc, Nora la Chouette et Krok le Crocodile, chacun avec sa propre IA. Une coupure de courant déclenche une séquence spéciale.
- **Chapitre 2 — Grimwood's Fun Factory** (débloqué après la Nuit 5 du chapitre 1) : grand couloir, deux conduits, lampe torche à pile limitée, masque et boîte à musique. Sept animatroniques : Pepper, Rico, Lumi, Vieux Krok, Vieux Bruno, Madame Chime et Static. Certains réagissent à la lumière (Lumi, Vieux Krok), d'autres au bruit (Rico) ou à l'usage des caméras (Static).
- **Nuits 1 à 6** dans chaque chapitre (la 6e est la nuit secrète) : écran de lancement, appel téléphonique sous-titré (voix de synthèse de l'appareil), difficulté qui augmente heure par heure, animation de 6 h, récompenses et sauvegarde automatique.
- **Custom Night** (débloquée après la Nuit 6) : niveaux de 0 à 20 par personnage, défis prédéfinis (sans caméra, sans lumière, énergie limitée, sans erreur, tous au maximum, cauchemar), un défi secret et des records personnels.
- **25 trophées** (bronze, argent, or, platine). Chacun est attribué uniquement quand sa condition est réellement remplie, avec une notification, une galerie, un pourcentage et une fiche détaillée.
- **Secrets** : apparitions rares, hallucinations, documents d'archives, code chiffré, chiffres cachés, terminal secret, mini-jeu 8 bits, bande sonore cachée et fin alternative. Le menu **Extras** apparaît après deux secrets découverts.
- **Collection** : affiches animées des chapitres, progression, bestiaire animé des personnages aperçus.
- **Paramètres** : qualité graphique, ombres, mode performance, mode immersion, volumes (général, musique, effets, ambiance, voix), sous-titres, sensibilité tactile, vibrations, durée des nuits, français ou anglais, export, import et effacement de la sauvegarde.
- **Reprise exacte** : quitter une nuit (ou passer l'application en arrière-plan) enregistre l'heure, l'énergie et la position de chaque animatronique. « Continuer » reprend la nuit à cet endroit.

## Commandes

| Action | Tactile | Clavier |
| --- | --- | --- |
| Tourner la tête dans le bureau | glisser | souris au bord de l'écran |
| Caméras | barre « Caméras » | `S` ou espace |
| Porte gauche / droite (ch. 1) | boutons Porte | `Q` / `D` |
| Lumière (ch. 1), lampe et conduits (ch. 2) | maintenir le bouton | `F` (lampe) |
| Masque (ch. 2) | bouton Masque | `M` |
| Pause | bouton II | Échap |

## Architecture

```
faznight/
  index.html, manifest.webmanifest, sw.js, icon.svg
  css/style.css        interface mobile d'abord (portrait et paysage, zones sûres)
  js/i18n.js           textes FR / EN
  js/save.js           profil + sauvegarde (localStorage et copie IndexedDB)
  js/audio.js          moteur sonore synthétisé, bus de volume, son spatial (panoramique)
  vendor/three.min.js  Three.js r128 (MIT)
  js/art.js            rig 2.5D de secours, poses partagées, effets analogiques
  js/three3d.js        modèles 3D articulés des animatroniques, matériaux, rendu dans n'importe quel canvas
  js/models3d.js       reconstruction des modèles : anatomie, endosquelette, mains articulées, matériaux PBR, clips d'animation
  js/gallery3d.js      galerie 3D (rotation, zoom, visage, dos, vue mécanique, animations)
  js/office3d.js       bureaux 3D des deux chapitres (portes, couloirs, conduits, lampe, ombres)
  js/characters.js     distribution originale (apparence, rôle, conseils)
  js/rooms.js          décors procéduraux : caméras, bureaux, couloirs, conduits
  js/trophies.js       trophées, secrets, documents
  js/engine.js         moteur commun des nuits : boucle, caméras, peur, téléphone, jumpscare, 6 h, reprise
  js/chapter1.js       chapitre 1 (portes, énergie, IA)
  js/chapter2.js       chapitre 2 (lampe, conduits, masque, boîte à musique, IA)
  js/minigame.js       mini-jeu secret
  js/ui.js             menus, collection, Custom Night, paramètres, extras, cinématiques
  js/main.js           démarrage
```

Pour ajouter un chapitre : créer une classe qui étend `FN.Night` (comme `chapter2.js`), déclarer ses caméras dans `rooms.js`, ses personnages dans `characters.js`, puis ajouter le chapitre dans la sauvegarde et dans la Collection.

Option de test : `index.html?speed=20` accélère le temps du jeu.

## Limites connues

- Il n'y a pas de compte en ligne pour l'instant : la progression reste sur l'appareil. Elle se transfère avec Exporter / Importer dans les paramètres.
- iPhone : Safari ne permet pas de verrouiller l'orientation. En mode portrait, le jeu propose de tourner le téléphone ou de jouer quand même.
- La voix du téléphone dépend des voix installées sur l'appareil. Les sous-titres sont toujours disponibles.
- Les modèles 3D sont construits à partir de formes géométriques articulées, sans sculpture ni maillage importé. Ce choix permet de les animer et de les rendre en temps réel sur téléphone.
- Les vues des caméras restent des décors 2.5D, avec les personnages en 3D par-dessus.
- Sur un appareil peu puissant, la résolution 3D baisse automatiquement, puis les ombres se coupent. Le réglage « Rendu 3D » permet de revenir au rendu 2.5D.

## Modèles des personnages (version 1.2)

Chaque animatronique est assemblé comme un robot de spectacle.
- **Tête** : crâne, front, joues, museau, mâchoire supérieure et inférieure, dents une par une, langue, orbites, yeux avec iris et pupille, paupières qui clignent, sourcils, oreilles.
- **Corps** : bassin, torse, épaules, bras, coudes, poignets, mains à quatre doigts articulés et pouce, cuisses, genoux, mollets, chevilles et chaussures.
- **Endosquelette** : colonne, côtes, pistons qui suivent les articulations, axes, engrenages, boulons et câbles. Les versions abîmées le laissent voir.
- **Matériaux** : fourrure synthétique, métal oxydé, chrome, caoutchouc, tissu, et plastique brillant pour la nouvelle génération du chapitre 2.

Animations : attente, marche, course, regard, bouche, yeux, attaque et jumpscare, plus les poses de scène.

Nouveautés :
- **Endo-7** : un endosquelette secret, visible sur les caméras des coulisses et de l'atelier.
- **Le gardien** : un modèle humain personnalisable (uniforme, tenue, teint, cheveux, accessoires à débloquer). Il apparaît dans les cinématiques, et ses mains sont visibles à la première personne pendant les nuits.

## Version 1.3 — graphismes, interface, animatroniques

**Animatroniques**
- Costumes plus crédibles : coutures, manchettes aux coudes et aux genoux, col, pectoraux, membres plus musclés, pieds plus massifs.
- Détails propres à chacun :
  - Bruno : boutons ;
  - Gus : sangle de basse ;
  - Nora : crête et plumes ;
  - Krok et Vieux Krok : crête dorsale ;
  - Pepper et Rico : lignes de moulage et étoile ;
  - Lumi : cœur lumineux qui pulse ;
  - Madame Chime : porcelaine fissurée ;
  - Static : revers de costume et voyant clignotant ;
  - Hank le Creux : bouche cousue ;
  - versions abîmées : trous dans le revêtement.
- Yeux avec reflet humide.
- Mouvements de tête « servomoteur » : la tête tient une position, puis se déplace d'un coup.
- Claquements de mâchoire, démarche lourde qui tangue.
- Sur les caméras, un animatronique fixe parfois l'objectif.

**Graphismes**
- Rayons de lumière visibles : lampe du plafond, lumières des portes, lampe torche, conduits.
- Poussière qui flotte dans l'air.
- Respiration du gardien : la caméra se balance doucement et s'agite quand une menace est proche.
- Jumpscares recadrés sur le visage, avec décalage de couleurs et image déchirée. Les changements de caméra se déchirent aussi.
- Bureau 1 : tuyaux, câbles, poubelle, papiers au sol, et une horloge murale qui affiche la vraie heure de la nuit.
- Bureau 2 : ballons qui flottent, guirlandes, cadeaux.
- Écran d'accueil : un projecteur balaie la scène, et de temps en temps un animatronique tourne la tête vers vous.

**Interface**
- Écran de démarrage avec avertissement, qui débloque aussi le son sur iPhone.
- Nouvelles polices :
  - IM Fell English SC pour les titres ;
  - Special Elite pour les menus ;
  - VT323 pour l'interface de jeu et les caméras.

  Hors ligne, des polices de secours s'affichent.
- Boutons de jeu en plaques métalliques avec voyant et icônes dessinées.
- Jauge de batterie à 5 segments qui clignote quand elle est faible.
- Cadre de tablette quand les caméras sont levées.
- Cartes de nuits avec une image de caméra animée et une jauge de difficulté.
- Galerie : rotation automatique quand on ne touche pas l'écran, et le modèle sort de l'ombre avec les yeux qui s'allument.

## Version 1.4 — choix du jeu, écrans titres, sons

**Navigation, comme dans un vrai jeu**
- Accueil de la plateforme : Jouer, Collection, Trophées, Paramètres, Crédits.
- Jouer ouvre « Choisissez un jeu », avec trois grandes cases animées :
  - **1** Pizza Palace ;
  - **2** Fun Factory, verrouillé tant que la Nuit 5 du jeu 1 n'est pas terminée ;
  - **3** barré d'une croix rouge, avec le tampon « COMING SOON ».
- Chaque jeu a son propre écran titre :
  - le grand chiffre, le nom, et le visage d'un animatronique qui vous fixe ;
  - de temps en temps, l'image grésille et le visage est remplacé par celui d'un autre animatronique ;
  - le menu propose Nouvelle partie (avec l'offre d'emploi du gardien), Continuer (reprise exacte ou prochaine nuit), 6e nuit, Custom Night et Toutes les nuits, ces trois derniers une fois débloqués ;
  - trois étoiles à gagner : les 5 nuits, la 6e nuit, un défi.
- Après une nuit, « Menu principal » ramène à l'écran titre du jeu.

**Sons**
- Écran titre 1 : une berceuse au célesta, désaccordée comme une vieille bande, sur un bourdonnement électrique et des craquements.
- Écran titre 2 : une valse de piano jouet avec un orgue, légèrement fausse.
- Jumpscares : un cri filtré qui monte puis s'effondre, et un choc métallique.
- Pas des animatroniques : talon puis pointe, avec un sifflement de servomoteur.
- Pendant les nuits : bourdonnement des néons. Au chapitre 1, de la pluie sur le toit, et parfois du tonnerre qui fait vaciller la lumière.
