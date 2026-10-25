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

// Order shown on the powers screen. `tint` colours the icon and the card,
// `gesture` is the short "how to cast it" line under the name.
export const EFFECTS = [
  { id: 'firebeam', make: fireBeamEffect, tint: '#ff7a1a', gesture: 'Pointez l’index' },
  { id: 'kamehameha', make: kamehamehaEffect, tint: '#4aa3ff', gesture: 'Mains jointes, puis poussez' },
  { id: 'saber', make: saberEffect, tint: '#ff3b3b', gesture: 'Fermez le poing' },
  { id: 'portal', make: portalEffect, tint: '#ff9a2e', gesture: 'Tracez un cercle avec l’index' },
  { id: 'lightning', make: lightningEffect, tint: '#5cb2ff', gesture: 'Main ouverte, doigts écartés' },
  { id: 'fireball', make: fireballEffect, tint: '#ff8c2a', gesture: 'Main ouverte, lancez vite' },
  { id: 'aura', make: auraEffect, tint: '#9a6bff', gesture: 'Reculez, levez les mains' },
  { id: 'telekinesis', make: telekinesisEffect, tint: '#3fc1ff', gesture: 'Main ouverte, pincez pour attraper' },
  { id: 'teleport', make: teleportEffect, tint: '#2fe0d0', gesture: 'Poing puis main ouverte' },
  { id: 'floating', make: floatingEffect, tint: '#8fb8ff', gesture: 'Paume vers le haut' },
  { id: 'circle', make: magicCircleEffect, tint: '#ffaa3a', gesture: 'Montrez la paume' },
  { id: 'plasma', make: plasmaEffect, tint: '#d24dff', gesture: 'Main ouverte, pincez' },
  { id: 'galaxy', make: galaxyEffect, tint: '#ff8fd0', gesture: 'Main ouverte, tournez-la' },
  { id: 'sakura', make: sakuraEffect, tint: '#ff9ec4', gesture: 'Balayez l’air' },
];

const instances = new Map();
export function getEffect(id) {
  if (!instances.has(id)) {
    const def = EFFECTS.find((d) => d.id === id) || EFFECTS[0];
    instances.set(def.id, def.make());
  }
  return instances.get(id) || instances.get(EFFECTS[0].id);
}
