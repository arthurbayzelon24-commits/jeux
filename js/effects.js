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

// Order shown on the powers screen. `charge`: the gesture that charges the
// power up to its final blast (powers without it have no charge). `tint` colours the icon and the card,
// `gesture` is the short "how to cast it" line under the name.
export const EFFECTS = [
  { id: 'kamehameha', make: kamehamehaEffect, tint: '#4aa3ff', gesture: 'Mains jointes, puis poussez', charge: 'open' },
  { id: 'firebeam', make: fireBeamEffect, tint: '#ff7a1a', gesture: 'Pointez l’index', charge: 'point' },
  { id: 'saber', make: saberEffect, tint: '#ff3b3b', gesture: 'Fermez le poing', charge: 'fist' },
  { id: 'portal', make: portalEffect, tint: '#ff9a2e', gesture: 'Tracez un cercle avec l’index' },
  { id: 'circle', make: magicCircleEffect, tint: '#ffaa3a', gesture: 'Montrez la paume', charge: 'open' },
  { id: 'plasma', make: plasmaEffect, tint: '#d24dff', gesture: 'Main ouverte', charge: 'open' },
  { id: 'lightning', make: lightningEffect, tint: '#5cb2ff', gesture: 'Main ouverte, doigts écartés', charge: 'open' },
  { id: 'thunder', make: thunderEffect, tint: '#a9c4ff', gesture: 'Levez la main vers le ciel', charge: 'raised' },
  { id: 'fireball', make: fireballEffect, tint: '#ff8c2a', gesture: 'Main ouverte, lancez vite', charge: 'open' },
  { id: 'rasengan', make: rasenganEffect, tint: '#5ab4ff', gesture: 'Main ouverte, poussez pour lancer', charge: 'open' },
  { id: 'blackhole', make: blackholeEffect, tint: '#ffaa50', gesture: 'Main ouverte', charge: 'open' },
  { id: 'galaxy', make: galaxyEffect, tint: '#ff8fd0', gesture: 'Main ouverte, tournez-la' },
  { id: 'heart', make: heartEffect, tint: '#ff3366', gesture: 'Cœur avec les doigts (pincez)' },
  { id: 'sakura', make: sakuraEffect, tint: '#ff9ec4', gesture: 'Balayez l’air' },
  { id: 'butterflies', make: butterfliesEffect, tint: '#50aaff', gesture: 'Main immobile, ils se posent' },
  { id: 'koi', make: koiEffect, tint: '#ff7a1e', gesture: 'Main ouverte au-dessus de l’eau' },
  { id: 'fireworks', make: fireworksEffect, tint: '#ffcc40', gesture: 'Pointez l’index vers le ciel' },
  { id: 'ice', make: iceEffect, tint: '#96dcff', gesture: 'Main ouverte, ou poing pour geler', charge: 'fist' },
  { id: 'water', make: waterEffect, tint: '#3ca0ff', gesture: 'Dessinez avec l’index' },
  { id: 'shadow', make: shadowEffect, tint: '#9640ff', gesture: 'Mains ouvertes, poing pour l’orbe', charge: 'fist' },
  { id: 'aura', make: auraEffect, tint: '#9a6bff', gesture: 'Reculez, levez les mains' },
  { id: 'wings', make: wingsEffect, tint: '#ffe0a0', gesture: 'Reculez, levez les bras' },
  { id: 'teleport', make: teleportEffect, tint: '#2fe0d0', gesture: 'Poing puis main ouverte' },
  { id: 'telekinesis', make: telekinesisEffect, tint: '#3fc1ff', gesture: 'Main ouverte, pincez pour attraper' },
  { id: 'floating', make: floatingEffect, tint: '#8fb8ff', gesture: 'Paume vers le haut' },
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
