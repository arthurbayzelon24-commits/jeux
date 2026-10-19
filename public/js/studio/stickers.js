/**
 * Sticker catalogue. Stickers are Unicode emoji rendered with the system emoji
 * font (no licence needed) plus vector shapes. The library is queried page by
 * page (see `queryStickers`) so the UI never renders the whole catalogue: the
 * same API can be backed by a server index of 100 000+ assets later.
 */
const GROUPS = [
  {
    id: 'emotions',
    label: 'Émojis',
    keywords: 'visage sourire rire joie triste colère amour emoji',
    chars:
      '😀😃😄😁😆😅🤣😂🙂😉😊😇🥰😍🤩😘😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠️💩🤡👹👺👻👽👾🤖',
  },
  {
    id: 'reactions',
    label: 'Réactions',
    keywords: 'like pouce coeur feu applaudir bravo réaction',
    chars: '👍👎👏🙌👐🤲🤝🙏✌️🤞🤟🤘👌🤌🤏👈👉👆👇☝️✋🤚🖐️🖖👋🤙💪❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝🔥✨🌟⭐💫💥💢💦💨🎉🎊💯✅❌⚠️❓❗💤',
  },
  { id: 'memes', label: 'Mèmes', keywords: 'meme drôle humour lol', chars: '🗿🤡💀😂🤣🙃😬🫠🫡🤌👀🧠🐸🦆🍿🥲🫢🫣🤷🤦🙈🙉🙊🐒🐶🐱🍌' },
  {
    id: 'gaming',
    label: 'Gaming',
    keywords: 'jeu manette gaming victoire trophée',
    chars: '🎮🕹️👾🏆🥇🥈🥉🎯🎲♟️🃏🧩⚔️🛡️🏹💣🧨🔫🪄👑💎🪙🚀🛸',
  },
  {
    id: 'arrows',
    label: 'Flèches',
    keywords: 'flèche direction annotation',
    chars: '⬆️↗️➡️↘️⬇️↙️⬅️↖️↕️↔️↩️↪️⤴️⤵️🔃🔄🔙🔚🔛🔜🔝▶️◀️🔼🔽⏩⏪⏫⏬',
  },
  {
    id: 'annotations',
    label: 'Annotations',
    keywords: 'note symbole info attention coche',
    chars: '✔️☑️✖️➕➖➗❔❕💬💭🗯️📌📍🔖🏷️🔔🔕📣📢💡🔍🔎⏰⏱️📅📝✏️🖊️',
  },
  {
    id: 'light',
    label: 'Lumières et particules',
    keywords: 'lumière étoile éclat particule brillant',
    chars: '✨⭐🌟💫⚡🔆🔅☀️🌙🌈☄️🪐🌌🎇🎆🕯️💡🔦🏮',
  },
  {
    id: 'social',
    label: 'Réseaux sociaux',
    keywords: 'abonne like partage commentaire notification',
    chars: '❤️👍💬🔁📤🔔📲📱💻📸🎥📹🎬🎙️🎧📺🔴🟢🔵🟣',
  },
  { id: 'future', label: 'Futuriste', keywords: 'futur robot espace technologie science', chars: '🤖🦾🦿🧬🔬🔭🛰️🚀🛸🪐👽💾💿📡🔋⚙️🧪🧲🌐' },
  {
    id: 'nature',
    label: 'Nature et voyage',
    keywords: 'nature voyage animal plage montagne',
    chars: '🌍🌎🌏🏔️⛰️🌋🏝️🏖️🌅🌄🌊🌲🌴🌵🌸🌻🌺🍁🍂🐶🐱🦊🐼🦁🐯🐬🦋✈️🚗🚲⛵🏕️🗺️📷',
  },
  {
    id: 'food',
    label: 'Nourriture',
    keywords: 'nourriture repas boisson fruit',
    chars: '🍕🍔🍟🌭🌮🍣🍜🍩🍪🎂🍰🧁🍫🍿🍓🍉🍇🍎🍋🥑☕🍵🧋🥤🍷🍹',
  },
  { id: 'deco', label: 'Décorations', keywords: 'décoration fête cadeau ballon', chars: '🎈🎁🎀🎊🎉🪅🪩💐🌹🏵️🎗️🎐🧧🔮🪞🖼️' },
];

export const SHAPES = [
  { id: 'rect', label: 'Rectangle', shape: { shape: 'rect', w: 0.4, h: 0.25, fill: '#4263FF', radius: 0 } },
  { id: 'rounded', label: 'Carte arrondie', shape: { shape: 'rect', w: 0.4, h: 0.25, fill: '#8B5CF6', radius: 0.15 } },
  { id: 'ellipse', label: 'Cercle', shape: { shape: 'ellipse', w: 0.2, h: 0.355, fill: '#45E5F5' } },
  { id: 'arrow', label: 'Flèche', shape: { shape: 'arrow', w: 0.3, h: 0.15, fill: '#F5F7FF' } },
  { id: 'line', label: 'Ligne', shape: { shape: 'line', w: 0.5, h: 0.2, fill: '#45E5F5' } },
  { id: 'frame', label: 'Cadre', shape: { shape: 'frame', w: 0.9, h: 0.84, fill: '#F5F7FF' } },
  {
    id: 'lower-third',
    label: 'Bandeau de titre',
    shape: { shape: 'rect', w: 0.55, h: 0.12, fill: 'rgba(8,11,22,0.75)', radius: 0.2, stroke: '#4263FF', strokeWidth: 4 },
  },
  {
    id: 'outline',
    label: 'Contour lumineux',
    shape: { shape: 'rect', w: 0.5, h: 0.3, fill: 'transparent', stroke: '#45E5F5', strokeWidth: 8, radius: 0.1 },
  },
];

let catalogue = null;
function build() {
  if (catalogue) return catalogue;
  catalogue = [];
  for (const group of GROUPS) {
    for (const emoji of Array.from(new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(group.chars), (s) => s.segment)) {
      catalogue.push({ id: `${group.id}:${emoji}`, emoji, category: group.id, categoryLabel: group.label, keywords: group.keywords });
    }
  }
  return catalogue;
}

export const STICKER_CATEGORIES = GROUPS.map(({ id, label }) => ({ id, label }));

/** Paginated query: { items, total, hasMore }. */
export function queryStickers({ category = '', search = '', favorites = null, page = 0, pageSize = 120 } = {}) {
  let list = build();
  if (category === 'favorites' && favorites) list = list.filter((item) => favorites.has(item.id));
  else if (category) list = list.filter((item) => item.category === category);
  const q = search.trim().toLowerCase();
  if (q) list = list.filter((item) => item.emoji.includes(q) || item.keywords.includes(q) || item.categoryLabel.toLowerCase().includes(q));
  const items = list.slice(page * pageSize, (page + 1) * pageSize);
  return { items, total: list.length, hasMore: (page + 1) * pageSize < list.length };
}

export function stickerCount() {
  return build().length;
}
