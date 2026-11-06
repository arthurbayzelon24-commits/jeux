# FAZNIGHT — la collection d'horreur animatronique

Jeu d'horreur de surveillance nocturne jouable dans le navigateur, pensé d'abord pour le téléphone (Android et iPhone) et compatible ordinateur. Tout est original : les personnages, les décors et les animations sont dessinés en code (rendu Canvas 2.5D), et chaque son ou musique est synthétisé en direct avec la Web Audio API. Le jeu n'utilise aucun fichier image ou audio externe et aucune dépendance.

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
- **Nuits 1 à 7** dans chaque chapitre : écran de lancement, appel téléphonique sous-titré (voix de synthèse de l'appareil), difficulté qui augmente heure par heure, animation de 6 h, récompenses et sauvegarde automatique.
- **Custom Night** (débloquée après la Nuit 6) : niveaux de 0 à 20 par personnage, défis prédéfinis (sans caméra, sans lumière, énergie limitée, sans erreur, tous au maximum, cauchemar), un défi secret et des records personnels.
- **27 trophées** (bronze, argent, or, platine). Chacun est attribué uniquement quand sa condition est réellement remplie, avec une notification, une galerie, un pourcentage et une fiche détaillée.
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
  js/art.js            squelette articulé des animatroniques, yeux lumineux, textures, effets analogiques
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
- Les personnages sont des modèles 2.5D articulés dessinés en temps réel, pas de vrais modèles 3D : c'est ce qui permet au jeu de rester léger et fluide sur téléphone.
