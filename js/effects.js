import { lightningEffect } from './fx/lightning.js';
import { fireballEffect } from './fx/fireball.js';
import { auraEffect } from './fx/aura.js';
import { telekinesisEffect } from './fx/telekinesis.js';
import { teleportEffect } from './fx/teleport.js';
import { floatingEffect } from './fx/floating.js';
import { magicCircleEffect } from './fx/magiccircle.js';
import { plasmaEffect } from './fx/plasma.js';
import { galaxyEffect } from './fx/galaxy.js';
import { sakuraEffect } from './fx/sakura.js';
import { fireBeamEffect } from './fx/firebeam.js';
import { kamehamehaEffect } from './fx/kamehameha.js';
import { saberEffect } from './fx/saber.js';
import { portalEffect } from './fx/portal.js';
import { heartEffect } from './fx/heart.js';
import { koiEffect } from './fx/koi.js';
import { fireworksEffect } from './fx/fireworks.js';
import { rasenganEffect } from './fx/rasengan.js';
import { iceEffect } from './fx/ice.js';
import { waterEffect } from './fx/water.js';
import { shadowEffect } from './fx/shadow.js';
import { butterfliesEffect } from './fx/butterflies.js';
import { blackholeEffect } from './fx/blackhole.js';
import { wingsEffect } from './fx/wings.js';
import { thunderEffect } from './fx/thunder.js';
import { hudEffect } from './fx/hud.js';
import { runesEffect } from './fx/runes.js';
import { freeModeEffect } from './fx/free.js';
import { crownEffect, heroMaskEffect } from './fx/pack-face.js';
import { fireFingersEffect, gauntletEffect } from './fx/pack-hands.js';
import { stringsEffect, fireTornadoEffect, whipEffect } from './fx/pack-energy2.js';
import { discoEffect, neonOutlineEffect, glassEffect, starCatchEffect, spotlightEffect } from './fx/pack-party.js';
import { rainEffect, snowfallEffect, electroEffect, frostEffect } from './fx/pack-weather.js';
import { clonesEffect, invisibleEffect, sizeEffect, livingShadowEffect, dustEffect, speedEffect, hologramEffect } from './fx/pack-body.js';
import { mindGrabEffect, shockwaveEffect, magnetEffect, chronoEffect, gravityEffect, ripplesEffect } from './fx/pack-physics.js';
import { dragonEffect, tornadoEffect, meteorEffect, lavaEffect, sunEffect, sonicEffect } from './fx/pack-elements.js';
import { planetEffect, crystalBallEffect, auroraEffect, starsEffect, cometEffect, rainbowEffect } from './fx/pack-cosmic.js';
import { bubblesEffect, confettiEffect, coinsEffect, snowEffect, firefliesEffect, wispsEffect } from './fx/pack-fun.js';
import {
  chidoriEffect,
  spiritBombEffect,
  getsugaEffect,
  hollowPurpleEffect,
  sharinganEffect,
  superSaiyanEffect,
  waterBreathingEffect,
  fireFistEffect,
  hakiEffect,
  domainEffect,
} from './fx/pack-anime.js';
import { shieldEffect, neonEffect, matrixEffect, webEffect, laserEyesEffect, haloEffect } from './fx/pack-tech.js';

// Categories of the powers screen (filter chips), in display order.
export const CATEGORIES = [
  { id: 'libre', name: 'Mode libre' },
  { id: 'anime', name: 'Animé' },
  { id: 'physique', name: 'Physique' },
  { id: 'feu', name: 'Feu' },
  { id: 'energie', name: 'Énergie' },
  { id: 'cosmos', name: 'Cosmos' },
  { id: 'nature', name: 'Nature' },
  { id: 'heros', name: 'Héros' },
  { id: 'fun', name: 'Fun' },
];

// Order shown on the powers screen. `charge`: the gesture that charges the
// power up to its final blast (powers without it have no charge). `tint` colours the icon and the card,
// `gesture` is the short "how to cast it" line under the name.
export const EFFECTS = [
  { id: 'free', cat: 'libre', make: freeModeEffect, tint: '#ffd27a', gesture: 'Chaque geste fait un pouvoir' },
  { id: 'chidori', cat: 'anime', make: chidoriEffect, tint: '#78c8ff', gesture: 'Main ouverte ou poing', charge: 'open' },
  {
    id: 'genkidama',
    cat: 'anime',
    make: spiritBombEffect,
    tint: '#a0d2ff',
    gesture: 'Levez la main, puis lancez vers le bas',
    charge: 'raised',
  },
  { id: 'getsuga', cat: 'anime', make: getsugaEffect, tint: '#ff3030', gesture: 'Poing fermé, tranchez vite', charge: 'fist' },
  { id: 'hollowpurple', cat: 'anime', make: hollowPurpleEffect, tint: '#be50ff', gesture: 'Deux mains, rapprochez-les' },
  { id: 'sharingan', cat: 'anime', make: sharinganEffect, tint: '#e0101e', gesture: 'Regardez la caméra' },
  { id: 'supersaiyan', cat: 'anime', make: superSaiyanEffect, tint: '#ffd23c', gesture: 'Reculez, serrez les poings', charge: 'fist' },
  { id: 'waterbreath', cat: 'anime', make: waterBreathingEffect, tint: '#3c96ff', gesture: 'Tranchez l’air avec la main' },
  { id: 'firefist', cat: 'anime', make: fireFistEffect, tint: '#ff7820', gesture: 'Poing, puis frappez', charge: 'fist' },
  { id: 'haki', cat: 'anime', make: hakiEffect, tint: '#ff2840', gesture: 'Serrez le poing', charge: 'fist' },
  { id: 'domain', cat: 'anime', make: domainEffect, tint: '#b4dcff', gesture: 'Signe V ou index levé, tenez 1 s' },
  { id: 'mindgrab', cat: 'physique', make: mindGrabEffect, tint: '#be78ff', gesture: 'Pointez un objet, restez immobile' },
  { id: 'shockwave', cat: 'physique', make: shockwaveEffect, tint: '#dcebff', gesture: 'Poing puis main ouverte, ou poussez' },
  { id: 'magnet', cat: 'physique', make: magnetEffect, tint: '#c8d7eb', gesture: 'Chaque main est un aimant' },
  { id: 'chrono', cat: 'physique', make: chronoEffect, tint: '#78c8ff', gesture: 'Claquez des doigts' },
  { id: 'gravity', cat: 'physique', make: gravityEffect, tint: '#ffc846', gesture: 'Pincez pour créer une balle' },
  { id: 'ripples', cat: 'physique', make: ripplesEffect, tint: '#aadcff', gesture: 'Touchez l’image avec l’index' },
  { id: 'kamehameha', cat: 'energie', make: kamehamehaEffect, tint: '#4aa3ff', gesture: 'Mains jointes, puis poussez', charge: 'open' },
  { id: 'runes', cat: 'fun', make: runesEffect, tint: '#ffc86e', gesture: 'Pincez, dessinez ○ △ □ ⚡ ／ V, lâchez' },
  { id: 'hud', cat: 'heros', make: hudEffect, tint: '#50dcff', gesture: 'Tapez sur le clavier holographique' },
  { id: 'firebeam', cat: 'feu', make: fireBeamEffect, tint: '#ff7a1a', gesture: 'Pointez l’index', charge: 'point' },
  { id: 'saber', cat: 'energie', make: saberEffect, tint: '#ff3b3b', gesture: 'Fermez le poing', charge: 'fist' },
  { id: 'portal', cat: 'cosmos', make: portalEffect, tint: '#ff9a2e', gesture: 'Faites des cercles avec la main, comme Doctor Strange' },
  { id: 'circle', cat: 'energie', make: magicCircleEffect, tint: '#ffaa3a', gesture: 'Montrez la paume', charge: 'open' },
  { id: 'plasma', cat: 'energie', make: plasmaEffect, tint: '#d24dff', gesture: 'Main ouverte', charge: 'open' },
  { id: 'lightning', cat: 'energie', make: lightningEffect, tint: '#5cb2ff', gesture: 'Main ouverte, doigts écartés', charge: 'open' },
  { id: 'thunder', cat: 'energie', make: thunderEffect, tint: '#a9c4ff', gesture: 'Levez la main vers le ciel', charge: 'raised' },
  { id: 'fireball', cat: 'feu', make: fireballEffect, tint: '#ff8c2a', gesture: 'Tendez la main : elle part' },
  { id: 'rasengan', cat: 'energie', make: rasenganEffect, tint: '#5ab4ff', gesture: 'Main ouverte, poussez pour lancer', charge: 'open' },
  { id: 'blackhole', cat: 'cosmos', make: blackholeEffect, tint: '#ffaa50', gesture: 'Main ouverte', charge: 'open' },
  { id: 'galaxy', cat: 'cosmos', make: galaxyEffect, tint: '#ff8fd0', gesture: 'Main ouverte, tournez-la' },
  { id: 'heart', cat: 'fun', make: heartEffect, tint: '#ff3366', gesture: 'Cœur avec les doigts (pincez)' },
  { id: 'sakura', cat: 'nature', make: sakuraEffect, tint: '#ff9ec4', gesture: 'Balayez l’air' },
  { id: 'butterflies', cat: 'nature', make: butterfliesEffect, tint: '#50aaff', gesture: 'Main immobile, ils se posent' },
  { id: 'koi', cat: 'nature', make: koiEffect, tint: '#ff7a1e', gesture: 'Main ouverte au-dessus de l’eau' },
  { id: 'fireworks', cat: 'feu', make: fireworksEffect, tint: '#ffcc40', gesture: 'Pointez l’index vers le ciel' },
  { id: 'ice', cat: 'nature', make: iceEffect, tint: '#96dcff', gesture: 'Main ouverte, ou poing pour geler', charge: 'fist' },
  { id: 'water', cat: 'nature', make: waterEffect, tint: '#3ca0ff', gesture: 'Dessinez avec l’index' },
  { id: 'shadow', cat: 'heros', make: shadowEffect, tint: '#9640ff', gesture: 'Mains ouvertes, poing pour l’orbe', charge: 'fist' },
  { id: 'aura', cat: 'heros', make: auraEffect, tint: '#9a6bff', gesture: 'Reculez, levez les mains' },
  { id: 'wings', cat: 'heros', make: wingsEffect, tint: '#ffe0a0', gesture: 'Reculez, levez les bras' },
  { id: 'teleport', cat: 'heros', make: teleportEffect, tint: '#2fe0d0', gesture: 'Claquez des doigts comme Thanos' },
  { id: 'clones', cat: 'heros', make: clonesEffect, tint: '#e6e6f0', gesture: 'Mains jointes, index levés (ninja)' },
  { id: 'invisible', cat: 'heros', make: invisibleEffect, tint: '#c8e6ff', gesture: 'Paumes jointes devant vous' },
  { id: 'size', cat: 'heros', make: sizeEffect, tint: '#ff4646', gesture: 'Bras écartés = géant, double pince = mini' },
  { id: 'livingshadow', cat: 'heros', make: livingShadowEffect, tint: '#7a3cff', gesture: 'Bougez : votre ombre vous suit' },
  { id: 'dust', cat: 'heros', make: dustEffect, tint: '#c8a078', gesture: 'Claquez des doigts' },
  { id: 'speed', cat: 'heros', make: speedEffect, tint: '#ff3c28', gesture: 'Bougez vite de côté' },
  { id: 'hologram', cat: 'heros', make: hologramEffect, tint: '#50c8ff', gesture: 'Restez dans l’image' },
  { id: 'telekinesis', cat: 'heros', make: telekinesisEffect, tint: '#3fc1ff', gesture: 'Main ouverte, pincez pour attraper' },
  { id: 'floating', cat: 'heros', make: floatingEffect, tint: '#8fb8ff', gesture: 'Paume vers le haut' },
  { id: 'dragon', cat: 'feu', make: dragonEffect, tint: '#ff7020', gesture: 'Guidez-le avec l’index' },
  { id: 'tornado', cat: 'nature', make: tornadoEffect, tint: '#c8d7e6', gesture: 'Main ouverte', charge: 'open' },
  { id: 'meteor', cat: 'feu', make: meteorEffect, tint: '#ff8c32', gesture: 'Levez la main', charge: 'raised' },
  { id: 'lava', cat: 'feu', make: lavaEffect, tint: '#ff5a14', gesture: 'Main ouverte', charge: 'open' },
  { id: 'sun', cat: 'feu', make: sunEffect, tint: '#ffc850', gesture: 'Main ouverte', charge: 'open' },
  { id: 'firetornado', cat: 'feu', make: fireTornadoEffect, tint: '#ff6a2d', gesture: 'Levez les bras pour l’agrandir' },
  { id: 'firefingers', cat: 'feu', make: fireFingersEffect, tint: '#ff8a2d', gesture: 'Ouvrez la main' },
  { id: 'sonic', cat: 'energie', make: sonicEffect, tint: '#dcebff', gesture: 'Tapez dans vos mains' },
  { id: 'electro', cat: 'energie', make: electroEffect, tint: '#6ebeff', gesture: 'Serrez les poings, puis ouvrez' },
  { id: 'strings', cat: 'energie', make: stringsEffect, tint: '#50dcff', gesture: 'Deux mains ouvertes face à face' },
  { id: 'whip', cat: 'energie', make: whipEffect, tint: '#6ec8ff', gesture: 'Poing fermé, fouettez' },
  { id: 'shield', cat: 'heros', make: shieldEffect, tint: '#50beff', gesture: 'Paume face à la caméra', charge: 'open' },
  { id: 'lasereyes', cat: 'heros', make: laserEyesEffect, tint: '#ff2828', gesture: 'Regardez, visez avec l’index' },
  { id: 'web', cat: 'heros', make: webEffect, tint: '#e6e6f0', gesture: 'Pointez l’index pour tirer' },
  { id: 'neon', cat: 'fun', make: neonEffect, tint: '#ff3cc8', gesture: 'Pincez pour dessiner' },
  { id: 'matrix', cat: 'heros', make: matrixEffect, tint: '#50ff78', gesture: 'Écartez le code avec les mains' },
  { id: 'halo', cat: 'heros', make: haloEffect, tint: '#ffd76e', gesture: 'Regardez la caméra' },
  { id: 'planet', cat: 'cosmos', make: planetEffect, tint: '#78beff', gesture: 'Main ouverte' },
  { id: 'crystalball', cat: 'cosmos', make: crystalBallEffect, tint: '#aa6eff', gesture: 'Main ouverte' },
  { id: 'aurora', cat: 'cosmos', make: auroraEffect, tint: '#50ffa0', gesture: 'Bougez la main, levez-la' },
  { id: 'stars', cat: 'cosmos', make: starsEffect, tint: '#fff0c8', gesture: 'Pointez l’index' },
  { id: 'comet', cat: 'cosmos', make: cometEffect, tint: '#ffb450', gesture: 'Bougez les doigts' },
  { id: 'rainbow', cat: 'nature', make: rainbowEffect, tint: '#ffe63c', gesture: 'Écartez les deux mains' },
  { id: 'bubbles', cat: 'fun', make: bubblesEffect, tint: '#a0d8ff', gesture: 'Main ouverte, crevez-les' },
  { id: 'confetti', cat: 'fun', make: confettiEffect, tint: '#ff4d6d', gesture: 'Poing puis main ouverte' },
  { id: 'coins', cat: 'fun', make: coinsEffect, tint: '#ffc83c', gesture: 'Pincez les doigts' },
  { id: 'snow', cat: 'nature', make: snowEffect, tint: '#e6f4ff', gesture: 'Soufflez la neige avec la main' },
  { id: 'fireflies', cat: 'nature', make: firefliesEffect, tint: '#d2ff5a', gesture: 'Ouvrez les mains' },
  { id: 'rain', cat: 'nature', make: rainEffect, tint: '#9fc4ff', gesture: 'Main ouverte au-dessus = parapluie' },
  { id: 'snowfall', cat: 'nature', make: snowfallEffect, tint: '#f0f8ff', gesture: 'Restez immobile, la neige se pose' },
  { id: 'frost', cat: 'nature', make: frostEffect, tint: '#bee8ff', gesture: 'Serrez les poings, puis ouvrez' },
  { id: 'wisps', cat: 'fun', make: wispsEffect, tint: '#5ac8ff', gesture: 'Main ouverte' },
  { id: 'disco', cat: 'fun', make: discoEffect, tint: '#ff3d8b', gesture: 'Levez vite la main pour le beat' },
  { id: 'starcatch', cat: 'fun', make: starCatchEffect, tint: '#ffd24a', gesture: 'Attrapez les étoiles, main ouverte' },
  { id: 'spotlight', cat: 'fun', make: spotlightEffect, tint: '#fff0c8', gesture: 'Le projecteur vous suit' },
  { id: 'neonline', cat: 'fun', make: neonOutlineEffect, tint: '#3fd0ff', gesture: 'Votre contour brille en néon' },
  { id: 'glass', cat: 'fun', make: glassEffect, tint: '#dcefff', gesture: 'Coup de poing vers la caméra' },
  { id: 'crown', cat: 'fun', make: crownEffect, tint: '#f2c14e', gesture: 'Regardez la caméra' },
  { id: 'heromask', cat: 'heros', make: heroMaskEffect, tint: '#c4161c', gesture: 'Regardez la caméra' },
  { id: 'gauntlet', cat: 'heros', make: gauntletEffect, tint: '#e3b23c', gesture: 'Montrez la main, claquez des doigts' },
];

const instances = new Map();
export function getEffect(id) {
  if (!instances.has(id)) {
    const def = EFFECTS.find((d) => d.id === id) || EFFECTS[0];
    const fx = def.make();
    fx.chargeMode = def.charge || null;
    instances.set(def.id, fx);
  }
  return instances.get(id) || instances.get(EFFECTS[0].id);
}
