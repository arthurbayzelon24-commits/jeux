import { h } from '../lib/dom.js';
import { defaultText } from './project.js';
import { drawText } from './engine/compositor.js';
import { TEXT_ANIM_LABELS } from './engine/compositor.js';

/**
 * Styled texts (Stickers › « Textes stylisés ») and the text controls shared
 * by the video and photo editors. Presets are ordinary text clips/layers:
 * they are drawn by the same renderer in the preview, the thumbnail and the
 * exported file, and every property stays editable.
 */

// System font stacks only (no download): the first available font is used.
export const FONTS = [
  ['Inter, "Segoe UI", system-ui, sans-serif', 'Sans moderne'],
  ['"Arial Black", "Helvetica Neue", Arial, sans-serif', 'Sans très grasse'],
  ['Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif', 'Impact (titres)'],
  ['"Trebuchet MS", Verdana, sans-serif', 'Humaniste'],
  ['Georgia, "Times New Roman", serif', 'Serif élégante'],
  ['"Palatino Linotype", Palatino, "Book Antiqua", serif', 'Serif classique'],
  ['"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive', 'Manuscrite élégante'],
  ['"Comic Sans MS", "Comic Neue", cursive', 'Manuscrite ronde'],
  ['"Courier New", ui-monospace, monospace', 'Machine à écrire'],
  ['"Lucida Console", "Consolas", ui-monospace, monospace', 'Futuriste (monospace)'],
];
const F = Object.fromEntries(FONTS.map(([stack], i) => [['sans', 'black', 'impact', 'human', 'serif', 'classic', 'script', 'round', 'mono', 'tech'][i], stack]));

const preset = (id, category, label, text, extra = {}) => ({ id, category, label, text: { ...defaultText(), animIn: 'fade', animOut: 'fade', shadow: 0, ...text }, ...extra });

export const STYLED_TEXTS = [
  preset('cine-epopee', 'Titres cinématographiques', 'Épopée', { content: 'LÉGENDE', font: F.classic, weight: 700, size: 130, letterSpacing: 22, gradient: ['#FFE3A8', '#C99A3A'], glow: 0.35, glowColor: '#FFB547', animIn: 'blur', animDuration: 1.2 }),
  preset('cine-trailer', 'Titres cinématographiques', 'Bande-annonce', { content: 'BIENTÔT', font: F.impact, size: 150, letterSpacing: 6, color: '#F5F7FF', stroke: '#080B16', strokeWidth: 4, shadow: 0.7, animIn: 'zoom', animDuration: 0.8 }),
  preset('cine-chapitre', 'Titres cinématographiques', 'Chapitre', { content: 'CHAPITRE I\nL’éveil', font: F.serif, weight: 400, size: 70, letterSpacing: 10, lineHeight: 1.5, color: '#F5F7FF', boxStyle: 'underline', background: '#45E5F5' }),
  preset('mini-fin', 'Titres minimalistes', 'Fin et aéré', { content: 'minimal', weight: 300, size: 96, letterSpacing: 18, color: '#F5F7FF' }),
  preset('mini-simple', 'Titres minimalistes', 'Simple', { content: 'Votre titre', weight: 600, size: 80, color: '#F5F7FF', boxStyle: 'underline', background: '#F5F7FF' }),
  preset('neon-cyan', 'Textes néon', 'Néon cyan', { content: 'OPEN', font: F.round, weight: 700, size: 130, color: '#E9FDFF', glow: 1, glowColor: '#45E5F5', loop: 'pulse' }),
  preset('neon-rose', 'Textes néon', 'Néon rose', { content: 'Night Club', font: F.script, weight: 400, size: 120, color: '#FFE3F1', glow: 1, glowColor: '#FF5CA8' }),
  preset('neon-violet', 'Textes néon', 'Néon violet', { content: 'SOLVEX', font: F.black, weight: 900, size: 120, letterSpacing: 10, color: 'rgba(0,0,0,0)', stroke: '#C9B6FF', strokeWidth: 3, glow: 0.9, glowColor: '#8B5CF6' }),
  preset('futur-holo', 'Textes futuristes', 'Hologramme', { content: 'SYSTÈME EN LIGNE', font: F.tech, weight: 700, size: 64, letterSpacing: 12, color: '#7FF3FF', glow: 0.6, glowColor: '#45E5F5', animIn: 'typewriter', animDuration: 1.5 }),
  preset('futur-cyber', 'Textes futuristes', 'Cyber', { content: 'CYBER 2099', font: F.black, weight: 900, size: 120, gradient: ['#45E5F5', '#8B5CF6'], stroke: '#080B16', strokeWidth: 5, animIn: 'slide-left' }),
  preset('grad-aurore', 'Textes en dégradé', 'Aurore', { content: 'Aurore', weight: 800, size: 140, gradient: ['#45E5F5', '#8B5CF6'], shadow: 0.4 }),
  preset('grad-sunset', 'Textes en dégradé', 'Coucher de soleil', { content: 'Été 2026', weight: 900, size: 130, gradient: ['#FFB547', '#FF5CA8'], shadow: 0.4 }),
  preset('grad-ocean', 'Textes en dégradé', 'Océan', { content: 'Océan', font: F.serif, weight: 700, size: 130, gradient: ['#3DDC97', '#4263FF'] }),
  preset('elegant-signature', 'Titres élégants', 'Signature', { content: 'Merci', font: F.script, weight: 400, size: 150, color: '#F5F7FF', shadow: 0.5 }),
  preset('elegant-classique', 'Titres élégants', 'Classique', { content: 'Une soirée inoubliable', font: F.serif, italic: true, weight: 400, size: 72, letterSpacing: 3, color: '#F5F7FF' }),
  preset('elegant-or', 'Titres élégants', 'Or', { content: 'Mariage', font: F.classic, weight: 400, size: 110, letterSpacing: 12, gradient: ['#FFF1C9', '#C99A3A'], shadow: 0.3 }),
  preset('sub-boite', 'Sous-titres modernes', 'Boîte sombre', { content: 'Un sous-titre lisible', weight: 600, size: 48, color: '#F5F7FF', background: 'rgba(8,11,22,0.75)', boxStyle: 'box' }, { transform: { y: 0.84 } }),
  preset('sub-mot', 'Sous-titres modernes', 'Mot clé jaune', { content: 'INCROYABLE', font: F.black, weight: 900, size: 72, color: '#FFE14D', stroke: '#000000', strokeWidth: 8, animIn: 'pop' }, { transform: { y: 0.78 } }),
  preset('sub-pilule', 'Sous-titres modernes', 'Pilule', { content: 'Sous-titre moderne', weight: 700, size: 46, color: '#080B16', background: 'rgba(245,247,255,0.92)', boxStyle: 'pill' }, { transform: { y: 0.84 } }),
  preset('bulle-blanche', 'Bulles de dialogue', 'Bulle blanche', { content: 'Salut tout le monde !', font: F.round, weight: 700, size: 54, color: '#080B16', background: '#F5F7FF', boxStyle: 'bubble', animIn: 'pop' }),
  preset('bulle-bleue', 'Bulles de dialogue', 'Bulle bleue', { content: 'Tu as vu ça ?', weight: 700, size: 54, color: '#F5F7FF', background: '#4263FF', boxStyle: 'bubble', animIn: 'pop' }),
  preset('badge-nouveau', 'Étiquettes et badges', 'Nouveau', { content: 'NOUVEAU', font: F.black, weight: 900, size: 52, letterSpacing: 4, color: '#F5F7FF', background: '#FF5C7A', boxStyle: 'pill', animIn: 'pop' }),
  preset('badge-prix', 'Étiquettes et badges', 'Prix', { content: '−30 %', font: F.black, weight: 900, size: 72, color: '#080B16', background: '#FFE14D', boxStyle: 'pill' }),
  preset('badge-abonne', 'Étiquettes et badges', 'Abonne-toi', { content: '▶ Abonne-toi', weight: 800, size: 54, color: '#F5F7FF', background: '#E62117', boxStyle: 'box', animIn: 'slide-up' }),
  preset('badge-cadre', 'Étiquettes et badges', 'Cadre', { content: 'ÉDITION LIMITÉE', weight: 700, size: 46, letterSpacing: 6, color: '#45E5F5', background: '#45E5F5', boxStyle: 'outline' }),
  preset('anim-machine', 'Textes animés', 'Machine à écrire', { content: 'Il était une fois…', font: F.mono, weight: 600, size: 64, color: '#F5F7FF', animIn: 'typewriter', animDuration: 1.5 }),
  preset('anim-rebond', 'Textes animés', 'Rebond', { content: 'WOW !', font: F.black, weight: 900, size: 140, color: '#FFB547', stroke: '#080B16', strokeWidth: 6, animIn: 'pop' }),
  preset('anim-vague', 'Textes animés', 'Vague', { content: 'Bonne vibe', weight: 800, size: 96, color: '#45E5F5', loop: 'wave', animIn: 'pop' }),
  preset('court-accroche', 'Titres pour vidéos courtes', 'Accroche', { content: 'ATTENDS LA FIN 😱', font: F.impact, size: 96, color: '#F5F7FF', stroke: '#000000', strokeWidth: 8, animIn: 'pop' }, { transform: { y: 0.22 } }),
  preset('court-partie', 'Titres pour vidéos courtes', 'Partie 1', { content: 'PARTIE 1', font: F.black, weight: 900, size: 64, color: '#080B16', background: '#FFE14D', boxStyle: 'box' }, { transform: { y: 0.15 } }),
  preset('court-question', 'Titres pour vidéos courtes', 'Question', { content: 'Tu savais ? 🤔', weight: 800, size: 80, color: '#F5F7FF', background: 'rgba(66,99,255,0.9)', boxStyle: 'pill' }, { transform: { y: 0.2 } }),
  preset('photo-carte', 'Textes décoratifs pour photos', 'Carte postale', { content: 'Souvenirs de vacances', font: F.script, weight: 400, size: 96, color: '#FFFFFF', shadow: 0.6, animIn: 'none', animOut: 'none' }),
  preset('photo-citation', 'Textes décoratifs pour photos', 'Citation', { content: '« Créer, c’est vivre deux fois. »', font: F.serif, italic: true, weight: 400, size: 60, color: '#F5F7FF', background: '#F5F7FF', boxStyle: 'outline', animIn: 'none', animOut: 'none' }),
  preset('photo-date', 'Textes décoratifs pour photos', 'Date', { content: '19 · 10 · 2026', font: F.tech, weight: 400, size: 48, letterSpacing: 8, color: '#FFB547', glow: 0.4, glowColor: '#FF8A5C', animIn: 'none', animOut: 'none' }),
];
export const STYLED_CATEGORIES = [...new Set(STYLED_TEXTS.map((p) => p.category))];

/** Thumbnail drawn by the real text renderer. */
export function stylePreview(p, width = 150, height = 84) {
  const canvas = h('canvas', { width: width * 2, height: height * 2, class: 'styled-preview', 'aria-hidden': 'true' });
  const c = canvas.getContext('2d');
  c.fillStyle = '#121935';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.save();
  c.translate(canvas.width / 2, canvas.height / 2);
  const lines = p.text.content.split('\n');
  c.font = `${p.text.weight} ${p.text.size}px ${p.text.font}`;
  const textWidth = Math.max(...lines.map((l) => c.measureText(l).width)) * (1 + (p.text.letterSpacing || 0) / 60);
  const unit = Math.min((canvas.width * 0.78) / Math.max(1, textWidth), (canvas.height * 0.6) / (p.text.size * lines.length * (p.text.lineHeight || 1.15)));
  drawText(c, { ...p.text, animIn: 'none', animOut: 'none', loop: 'none' }, 1, 2, unit);
  c.restore();
  return canvas;
}

const hexOf = (value, fallback) => {
  if (/^#[0-9a-f]{6}$/i.test(value || '')) return value;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value || '');
  return m ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : fallback;
};
const alphaOf = (value) => Number(/rgba\([^)]*,\s*([\d.]+)\)/i.exec(value || '')?.[1] ?? 1);
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * Style controls for a text: font, size, weight, alignment, colour, gradient,
 * outline, shadow, glow, background box and animations. `edit(label, mutate,
 * { commit })` applies `mutate(textObject)` to the clip or layer.
 */
export function textStyleControls(t, edit, { animations = true } = {}) {
  const row = (label, control, out) => h('label', { class: 'insp-row' }, h('span', {}, label), control, out || h('span'));
  const slider = (label, key, min, max, step, format = (v) => v) => {
    const input = h('input', { type: 'range', min, max, step, value: String(t[key] ?? 0) });
    const out = h('output', {}, format(t[key] ?? 0));
    const apply = (commit) => {
      out.textContent = format(Number(input.value));
      edit(label, (x) => ((x[key] = Number(input.value)), x), { commit });
    };
    input.addEventListener('input', () => apply(false));
    input.addEventListener('change', () => apply(true));
    return row(label, input, out);
  };
  const color = (label, value, apply) => {
    const input = h('input', { type: 'color', value });
    input.addEventListener('input', () => edit(label, (x) => (apply(x, input.value), x), { commit: false }));
    input.addEventListener('change', () => edit(label, (x) => (apply(x, input.value), x)));
    return h('label', { class: 'insp-row insp-row--color' }, h('span', {}, label), input);
  };
  const select = (label, value, options, apply) => {
    const el = h('select', { class: 'select select--sm' }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
    el.addEventListener('change', () => edit(label, (x) => (apply(x, el.value), x)));
    return h('label', { class: 'insp-row insp-row--select' }, h('span', {}, label), el);
  };
  const check = (label, value, apply) => {
    const input = h('input', { type: 'checkbox', checked: Boolean(value) });
    input.addEventListener('change', () => edit(label, (x) => (apply(x, input.checked), x)));
    return h('label', { class: 'insp-check' }, input, label);
  };
  const section = (title, ...children) => h('div', { class: 'insp-section' }, h('h3', {}, title), ...children.filter(Boolean));
  const align = h(
    'div',
    { class: 'seg', role: 'radiogroup', 'aria-label': 'Alignement' },
    [
      ['left', 'Gauche'],
      ['center', 'Centre'],
      ['right', 'Droite'],
    ].map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String((t.align || 'center') === v), onclick: () => edit('Alignement', (x) => ((x.align = v), x)) }, l)),
  );
  const boxColor = hexOf(t.background, '#080B16');
  return [
    section(
      'Typographie',
      select('Police', FONTS.some(([f]) => f === t.font) ? t.font : FONTS[0][0], FONTS, (x, v) => (x.font = v)),
      slider('Taille', 'size', 12, 400, 1),
      select('Graisse', String(t.weight), [['300', 'Fine'], ['400', 'Normale'], ['600', 'Demi-gras'], ['700', 'Gras'], ['900', 'Extra-gras']], (x, v) => (x.weight = Number(v))),
      check('Italique', t.italic, (x, v) => (x.italic = v)),
      h('div', { class: 'insp-row' }, h('span', {}, 'Alignement'), align),
      slider('Espacement', 'letterSpacing', -10, 60, 1),
      slider('Interlignage', 'lineHeight', 0.8, 2.5, 0.05),
    ),
    section(
      'Couleur',
      color('Couleur', hexOf(t.color, '#F5F7FF'), (x, v) => (x.color = v)),
      check('Dégradé', Boolean(t.gradient), (x, v) => (x.gradient = v ? ['#45E5F5', '#8B5CF6'] : null)),
      t.gradient ? color('Dégradé : début', hexOf(t.gradient[0], '#45E5F5'), (x, v) => (x.gradient = [v, x.gradient?.[1] || '#8B5CF6'])) : null,
      t.gradient ? color('Dégradé : fin', hexOf(t.gradient[1], '#8B5CF6'), (x, v) => (x.gradient = [x.gradient?.[0] || '#45E5F5', v])) : null,
    ),
    section(
      'Contour, ombre et lueur',
      color('Contour', hexOf(t.stroke, '#000000'), (x, v) => (x.stroke = v)),
      slider('Épaisseur du contour', 'strokeWidth', 0, 30, 1),
      color('Couleur de l’ombre', hexOf(t.shadowColor, '#000000'), (x, v) => (x.shadowColor = v)),
      slider('Ombre', 'shadow', 0, 1, 0.05),
      color('Couleur de la lueur', hexOf(t.glowColor || t.color, '#45E5F5'), (x, v) => (x.glowColor = v)),
      slider('Lueur (néon)', 'glow', 0, 1, 0.05),
    ),
    section(
      'Fond du texte',
      select('Forme', t.background ? t.boxStyle || 'box' : 'none', [['none', 'Aucun'], ['box', 'Boîte'], ['pill', 'Pilule'], ['bubble', 'Bulle'], ['underline', 'Soulignement'], ['outline', 'Cadre']], (x, v) => {
        if (v === 'none') x.background = null;
        else {
          x.background ??= 'rgba(8,11,22,0.75)';
          x.boxStyle = v;
        }
      }),
      t.background ? color('Couleur du fond', boxColor, (x, v) => (x.background = rgba(v, alphaOf(x.background)))) : null,
      t.background
        ? (() => {
            const input = h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: String(alphaOf(t.background)) });
            const out = h('output', {}, `${Math.round(alphaOf(t.background) * 100)} %`);
            const apply = (commit) => {
              out.textContent = `${Math.round(Number(input.value) * 100)} %`;
              edit('Opacité du fond', (x) => ((x.background = rgba(hexOf(x.background, '#080B16'), Number(input.value))), x), { commit });
            };
            input.addEventListener('input', () => apply(false));
            input.addEventListener('change', () => apply(true));
            return row('Opacité du fond', input, out);
          })()
        : null,
    ),
    animations
      ? section(
          'Animation',
          select('Entrée', t.animIn || 'none', Object.entries(TEXT_ANIM_LABELS), (x, v) => (x.animIn = v)),
          select('Sortie', t.animOut || 'none', Object.entries(TEXT_ANIM_LABELS), (x, v) => (x.animOut = v)),
          slider('Durée de l’animation', 'animDuration', 0.1, 3, 0.05, (v) => `${v} s`),
        )
      : null,
  ].filter(Boolean);
}
