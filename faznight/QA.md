# FAZNIGHT — Contrôle qualité

Liste générée par un test automatique dans Chromium (script Playwright), le 7 novembre 2026, après les corrections de la version 1.2.2.

## Nuits

| Chapitre | Nuit | Démarrage | Horloge 12 AM → 6 AM | IA active (somme des niveaux) | Victoire | Sauvegarde | Défaite |
|---|---|---|---|---|---|---|---|
| 1 | 1 | ✅ | ✅ | ✅ (3) | ✅ | ✅ | ✅ (gus) |
| 1 | 2 | ✅ | ✅ | ✅ (9) | ✅ | ✅ | ✅ (gus) |
| 1 | 3 | ✅ | ✅ | ✅ (16) | ✅ | ✅ | ✅ (bruno) |
| 1 | 4 | ✅ | ✅ | ✅ (25) | ✅ | ✅ | ✅ (bruno) |
| 1 | 5 | ✅ | ✅ | ✅ (34) | ✅ | ✅ | ✅ (bruno) |
| 1 | 6 | ✅ | ✅ | ✅ (49) | ✅ | ✅ | ✅ (bruno) |
| 2 | 1 | ✅ | ✅ | ✅ (5) | ✅ | ✅ | ✅ (pepper) |
| 2 | 2 | ✅ | ✅ | ✅ (14) | ✅ | ✅ | ✅ (pepper) |
| 2 | 3 | ✅ | ✅ | ✅ (25) | ✅ | ✅ | ✅ (pepper) |
| 2 | 4 | ✅ | ✅ | ✅ (40) | ✅ | ✅ | ✅ (pepper) |
| 2 | 5 | ✅ | ✅ | ✅ (54) | ✅ | ✅ | ✅ (pepper) |
| 2 | 6 | ✅ | ✅ | ✅ (78) | ✅ | ✅ | ✅ (pepper) |

Victoire testée en avançant l’horloge jusqu’à 6 h. Défaite testée en déclenchant une attaque. Les vraies parties jouées par le joueur automatique sont listées plus bas.

## Personnages

| Personnage | Modèle 3D (pièces) | Textures | Matériaux | Mâchoire | Yeux | Doigts | Pistons | Animations | Hauteur | En jeu | Galerie |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Bruno le Blaireau | ✅ 183 | ✅ | 3 | ✅ | 2 | 8 | 4 | 9/9 | 2.67 m | ✅ | ✅ |
| Gus le Bouc | ✅ 182 | ✅ | 4 | ✅ | 2 | 8 | 4 | 9/9 | 2.6 m | ✅ | ✅ |
| Nora la Chouette | ✅ 156 | ✅ | 3 | ✅ | 2 | 8 | 4 | 9/9 | 2.58 m | ✅ | ✅ |
| Krok le Crocodile | ✅ 207 | ✅ | 3 | ✅ | 2 | 8 | 4 | 9/9 | 2.73 m | ✅ | ✅ |
| Hank le Creux | ✅ 154 | ✅ | 2 | ✅ | 2 | 8 | 4 | 9/9 | 2.87 m | ✅ | ✅ |
| Pepper le Panda | ✅ 175 | ✅ | 4 | ✅ | 2 | 8 | 4 | 9/9 | 2.47 m | ✅ | ✅ |
| Rico le Raton laveur | ✅ 179 | ✅ | 4 | ✅ | 2 | 8 | 4 | 9/9 | 2.25 m | ✅ | ✅ |
| Lumi la Méduse | ✅ 183 | ✅ | 4 | ✅ | 2 | 8 | 2 | 9/9 | 2.32 m | ✅ | ✅ |
| Vieux Krok | ✅ 217 | ✅ | 4 | ✅ | 2 | 8 | 4 | 9/9 | 2.42 m | ✅ | ✅ |
| Vieux Bruno | ✅ 199 | ✅ | 4 | ✅ | 2 | 8 | 4 | 9/9 | 2.59 m | ✅ | ✅ |
| Madame Chime | ✅ 164 | ✅ | 4 | ✅ | 2 | 8 | 4 | 9/9 | 2.45 m | ✅ | ✅ |
| Static | ✅ 129 | ✅ | 4 | ✅ | écran TV | 8 | 4 | 9/9 | 2.58 m | ✅ | ✅ |
| Endo-7 | ✅ 193 | ✅ | 3 | ✅ | 2 | 8 | 4 | 9/9 | 2.42 m | ✅ | ✅ |
| Le gardien | ✅ 167 | ✅ | 4 | ✅ | 2 | 8 | 4 | 9/9 | 1.86 m | ✅ | ✅ |

Les hauteurs sont mesurées sur le modèle sans mise à l’échelle de scène.

Il n’y a pas de collisions physiques : les personnages se déplacent entre des positions fixes (pièces, portes, couloirs, conduits). Les positions sont choisies pour qu’ils ne traversent pas les murs ni le bureau.

## Parties complètes jouées par le joueur automatique (rendu 2.5D, temps accéléré)

- Chapitre 1 : Nuits 1, 2, 3, 4, 5 et 6 gagnées au moins une fois. Les défaites viennent surtout de coupures de courant à 4-5 h.
- Chapitre 2 : Nuits 3 et 4 gagnées après l’équilibrage (le temps pour mettre le masque passe de 0,65-1,3 s à 1,0-1,65 s).

## Erreurs JavaScript

Aucune erreur pendant l’ensemble des tests.
