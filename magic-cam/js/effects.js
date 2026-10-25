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

// Order shown in the app. `tag` is the small label on each card.
export const EFFECTS = [
  { id: 'lightning', make: lightningEffect, tag: 'Mains' },
  { id: 'fireball', make: fireballEffect, tag: 'Mains' },
  { id: 'aura', make: auraEffect, tag: 'Corps' },
  { id: 'telekinesis', make: telekinesisEffect, tag: 'Mains · 3D' },
  { id: 'teleport', make: teleportEffect, tag: 'Corps' },
  { id: 'floating', make: floatingEffect, tag: 'Mains · 3D' },
  { id: 'circle', make: magicCircleEffect, tag: 'Mains · 3D' },
  { id: 'plasma', make: plasmaEffect, tag: 'Mains' },
  { id: 'galaxy', make: galaxyEffect, tag: 'Mains · 3D' },
  { id: 'sakura', make: sakuraEffect, tag: 'Ambiance' },
];

const instances = new Map();
export function getEffect(id) {
  if (!instances.has(id)) {
    const def = EFFECTS.find((d) => d.id === id) || EFFECTS[0];
    instances.set(def.id, def.make());
  }
  return instances.get(id) || instances.get(EFFECTS[0].id);
}
