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

// Order shown in the effect picker. `icon` and `tint` style its button,
// `tag` says what the camera follows for this effect.
export const EFFECTS = [
  { id: 'lightning', make: lightningEffect, icon: '⚡', tint: '#4aa3ff', tag: 'Doigts' },
  { id: 'fireball', make: fireballEffect, icon: '🔥', tint: '#ff7a1a', tag: 'Main' },
  { id: 'aura', make: auraEffect, icon: '✨', tint: '#7d5cff', tag: 'Corps' },
  { id: 'telekinesis', make: telekinesisEffect, icon: '🪨', tint: '#3fc1ff', tag: 'Main · pincement' },
  { id: 'teleport', make: teleportEffect, icon: '🌀', tint: '#2fe0d0', tag: 'Corps' },
  { id: 'floating', make: floatingEffect, icon: '💎', tint: '#8fb8ff', tag: 'Paume' },
  { id: 'circle', make: magicCircleEffect, icon: '🔯', tint: '#ff9a2e', tag: 'Paume' },
  { id: 'plasma', make: plasmaEffect, icon: '🔮', tint: '#d24dff', tag: 'Doigts' },
  { id: 'galaxy', make: galaxyEffect, icon: '🌌', tint: '#ff8fd0', tag: 'Paume' },
  { id: 'sakura', make: sakuraEffect, icon: '🌸', tint: '#ff9ec4', tag: 'Mouvements' },
];

const instances = new Map();
export function getEffect(id) {
  if (!instances.has(id)) {
    const def = EFFECTS.find((d) => d.id === id) || EFFECTS[0];
    instances.set(def.id, def.make());
  }
  return instances.get(id) || instances.get(EFFECTS[0].id);
}
