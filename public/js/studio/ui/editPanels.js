import { h } from '../../lib/dom.js';
import { icon } from '../../components/icons.js';
import { EFFECTS, defaultParams, UNAVAILABLE_EFFECTS } from '../engine/effects.js';
import { TRANSITIONS, defaultTransition } from '../engine/transitions.js';
import { defaultColor } from '../project.js';
import { uid } from '../db.js';
import { getPrefs } from '../../lib/prefs.js';

/**
 * Catalogue panels opened from the editor's top bar (Effets, Transitions,
 * Filtres). Each item applies to the clips selected in the timeline; the
 * fine settings stay in the properties panel on the right.
 *
 * ctx: { store, say, openInspector(tab) }
 */

const visual = (c) => c.kind !== 'audio';

function selectedClips(store) {
  return store.project.clips.filter((c) => store.selection.includes(c.id));
}

function editSelected(store, label, fn, filter = visual) {
  const ids = selectedClips(store)
    .filter(filter)
    .map((c) => c.id);
  if (!ids.length) return false;
  const p = store.project;
  store.commit(label, { ...p, clips: p.clips.map((c) => (ids.includes(c.id) ? fn(structuredClone(c)) || c : c)) });
  return true;
}

function targetNotice(store, { filter = visual, what = 'un clip vidéo, image, texte ou sticker' } = {}) {
  const clips = selectedClips(store).filter(filter);
  return clips.length
    ? h('p', { class: 'panel-target' }, icon('check', { size: 14 }), clips.length > 1 ? `S’applique aux ${clips.length} éléments sélectionnés` : `S’applique à « ${clips[0].name || clips[0].kind} »`)
    : h('p', { class: 'panel-target panel-target--none' }, `Sélectionnez ${what} dans la timeline, puis choisissez ci-dessous.`);
}

export function effectsPanel(body, { store, say, openInspector }) {
  const clips = selectedClips(store).filter(visual);
  const groups = {};
  for (const e of EFFECTS) (groups[e.category] ??= []).push(e);
  const applied = clips[0]?.effects?.length || 0;
  body.append(
    targetNotice(store),
    applied
      ? h('button', { class: 'btn btn--sm', type: 'button', onclick: () => openInspector('effects') }, `${applied} effet(s) appliqué(s) — régler`)
      : null,
    ...Object.entries(groups).map(([category, items]) =>
      h(
        'section',
        { class: 'panel-group' },
        h('h4', {}, category),
        h(
          'div',
          { class: 'cat-grid' },
          items.map((e) =>
            h(
              'button',
              {
                class: `cat-card cat-card--fx cat-card--${e.id}`,
                type: 'button',
                disabled: !clips.length,
                title: e.heavy ? 'Calcul pixel par pixel : peut ralentir l’aperçu' : e.label,
                onclick: () => {
                  editSelected(store, `Effet ${e.label}`, (c) => (c.effects.push({ id: uid('e'), type: e.id, params: defaultParams(e.id) }), c));
                  say(`Effet « ${e.label} » ajouté. Réglez-le dans Propriétés.`, 'success');
                  openInspector('effects');
                },
              },
              h('span', { class: 'cat-card__swatch', 'aria-hidden': 'true' }),
              h('span', {}, e.label),
            ),
          ),
        ),
      ),
    ),
    h(
      'details',
      { class: 'panel-group' },
      h('summary', {}, 'Effets non disponibles et pourquoi'),
      h(
        'ul',
        { class: 'unavailable' },
        UNAVAILABLE_EFFECTS.map((u) => h('li', {}, h('strong', {}, u.label), ' — ', u.reason)),
      ),
    ),
  );
}

let transitionEdge = 'transitionIn';

export function transitionsPanel(body, ctx) {
  const { store, say, openInspector } = ctx;
  const clips = selectedClips(store).filter(visual);
  const edges = h(
    'div',
    { class: 'seg', role: 'radiogroup', 'aria-label': 'Appliquer la transition' },
    [
      ['transitionIn', 'En entrée'],
      ['transitionOut', 'En sortie'],
    ].map(([id, label]) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(transitionEdge === id) }, label);
      b.addEventListener('click', () => {
        transitionEdge = id;
        body.replaceChildren();
        transitionsPanel(body, ctx);
      });
      return b;
    }),
  );
  const apply = (t) => {
    const edge = transitionEdge;
    editSelected(
      store,
      t ? `Transition ${t.label}` : 'Retirer la transition',
      (c) => ((c[edge] = t ? { ...defaultTransition(t.id), duration: Math.min(getPrefs().defaultTransition, c.duration / 2) } : null), c),
    );
    if (t) {
      say(`Transition « ${t.label} » appliquée ${edge === 'transitionIn' ? 'en entrée' : 'en sortie'}.`, 'success');
      openInspector('transitions');
    }
  };
  const groups = {};
  for (const t of TRANSITIONS) if (transitionEdge === 'transitionIn' || !t.inOnly) (groups[t.category] ??= []).push(t);
  const current = clips[0]?.[transitionEdge]?.type;
  body.append(
    targetNotice(store),
    edges,
    h('button', { class: 'btn btn--sm', type: 'button', disabled: !clips.length || !current, onclick: () => apply(null) }, 'Aucune transition'),
    ...Object.entries(groups).map(([category, items]) =>
      h(
        'section',
        { class: 'panel-group' },
        h('h4', {}, category),
        h(
          'div',
          { class: 'cat-grid' },
          items.map((t) =>
            h(
              'button',
              { class: `cat-card cat-card--tr${current === t.id ? ' is-on' : ''}`, type: 'button', disabled: !clips.length, 'aria-pressed': String(current === t.id), onclick: () => apply(t) },
              h('span', { class: `cat-card__swatch tr-${t.id}`, 'aria-hidden': 'true' }),
              h('span', {}, t.label),
            ),
          ),
        ),
      ),
    ),
    h('p', { class: 'field__hint' }, 'La durée, l’intensité et la direction se règlent dans Propriétés › Transitions.'),
  );
}

// Colour looks built only from the existing, non-destructive colour settings and effects.
const LOOKS = [
  { id: 'neutre', label: 'Original', color: defaultColor() },
  { id: 'cinema', label: 'Cinéma froid', color: { exposure: -5, contrast: 15, saturation: -10, temperature: -20, tint: 0, hue: 0, vignette: 30 } },
  { id: 'ete', label: 'Été chaud', color: { exposure: 8, contrast: 5, saturation: 15, temperature: 30, tint: 5, hue: 0, vignette: 10 } },
  { id: 'neon', label: 'Néon', color: { exposure: 0, contrast: 25, saturation: 40, temperature: -10, tint: 15, hue: 0, vignette: 20 } },
  { id: 'delave', label: 'Délavé', color: { exposure: 10, contrast: -25, saturation: -30, temperature: 5, tint: 0, hue: 0, vignette: 0 } },
  { id: 'vif', label: 'Vif', color: { exposure: 4, contrast: 18, saturation: 35, temperature: 0, tint: 0, hue: 0, vignette: 0 } },
  { id: 'crepuscule', label: 'Crépuscule', color: { exposure: -8, contrast: 12, saturation: 10, temperature: 22, tint: 18, hue: 0, vignette: 35 } },
  { id: 'menthe', label: 'Menthe', color: { exposure: 5, contrast: 0, saturation: -5, temperature: -15, tint: -20, hue: 0, vignette: 0 } },
  { id: 'nb', label: 'Noir et blanc', color: defaultColor(), effect: 'noir' },
  { id: 'sepia', label: 'Sépia', color: defaultColor(), effect: 'sepia' },
  { id: 'film', label: 'Film', color: { exposure: 0, contrast: 10, saturation: -5, temperature: 8, tint: 0, hue: 0, vignette: 25 }, effect: 'grain' },
];
const LOOK_EFFECTS = new Set(LOOKS.map((l) => l.effect).filter(Boolean));

export function filtersPanel(body, { store, say, openInspector }) {
  const filter = (c) => c.kind === 'video' || c.kind === 'image';
  const clips = selectedClips(store).filter(filter);
  const swatch = (look) => {
    const c = look.color;
    const css = [
      `brightness(${1 + c.exposure / 200})`,
      `contrast(${1 + c.contrast / 100})`,
      `saturate(${look.effect === 'noir' ? 0 : 1 + c.saturation / 100})`,
      look.effect === 'sepia' ? 'sepia(0.9)' : '',
      `hue-rotate(${c.temperature > 0 ? -c.temperature / 4 : -c.temperature / 3}deg)`,
    ].join(' ');
    return h('span', { class: 'look-swatch', style: { filter: css }, 'aria-hidden': 'true' });
  };
  body.append(
    targetNotice(store, { filter, what: 'un clip vidéo ou image' }),
    h(
      'div',
      { class: 'cat-grid cat-grid--looks' },
      LOOKS.map((look) =>
        h(
          'button',
          {
            class: 'cat-card',
            type: 'button',
            disabled: !clips.length,
            onclick: () => {
              editSelected(
                store,
                `Filtre ${look.label}`,
                (c) => {
                  c.color = { ...look.color };
                  c.effects = c.effects.filter((e) => !LOOK_EFFECTS.has(e.type));
                  if (look.effect) c.effects.push({ id: uid('e'), type: look.effect, params: defaultParams(look.effect) });
                  return c;
                },
                filter,
              );
              say(`Filtre « ${look.label} » appliqué.`, 'success');
            },
          },
          swatch(look),
          h('span', {}, look.label),
        ),
      ),
    ),
    h('p', { class: 'field__hint' }, 'Aperçu des vignettes approximatif. Le filtre règle la couleur du clip (non destructif) ; affinez dans Propriétés › Couleur.'),
    h('button', { class: 'btn btn--sm', type: 'button', disabled: !clips.length, onclick: () => openInspector('color') }, 'Réglages de couleur détaillés'),
  );
}
