import { h, clear } from '../../lib/dom.js';
import { icon } from '../../components/icons.js';
import { getPath, setPath, setKeyframe, removeKeyframe, valueAt, EASING_LABELS, MOTION_PRESETS, ANIMATABLE } from '../engine/keyframes.js';
import { EFFECTS, EFFECT_MAP, defaultParams, UNAVAILABLE_EFFECTS } from '../engine/effects.js';
import { TRANSITIONS, TRANSITION_MAP, DIRECTIONS, defaultTransition } from '../engine/transitions.js';
import { TEXT_ANIM_LABELS, TEXT_LOOPS } from '../engine/compositor.js';
import { ASPECTS, clipEnd, changeAspect, createTrack, defaultColor, sourceLimit } from '../project.js';
import { formatTime } from '../media.js';
import { uid } from '../db.js';
import { getPrefs } from '../../lib/prefs.js';

const FONTS = [
  ['Inter, "Segoe UI", system-ui, sans-serif', 'Sans moderne'],
  ['Georgia, "Times New Roman", serif', 'Serif élégante'],
  ['"Courier New", ui-monospace, monospace', 'Machine à écrire'],
  ['Impact, "Arial Black", sans-serif', 'Impact'],
  ['"Trebuchet MS", Verdana, sans-serif', 'Humaniste'],
  ['"Comic Sans MS", "Comic Neue", cursive', 'Manuscrite'],
];
const BLENDS = [
  ['source-over', 'Normal'],
  ['screen', 'Superposition claire (écran)'],
  ['multiply', 'Produit'],
  ['overlay', 'Incrustation'],
  ['lighter', 'Addition'],
  ['darken', 'Obscurcir'],
  ['lighten', 'Éclaircir'],
  ['difference', 'Différence'],
  ['color-dodge', 'Densité couleur −'],
  ['soft-light', 'Lumière douce'],
];

/**
 * Properties panel for the current selection (or the project when nothing is
 * selected). Sliders preview live and commit on release; animatable fields get
 * a ◆ button that adds/removes a keyframe at the playhead.
 */
export class Inspector {
  constructor({ store, player, mediaIndex, actions }) {
    this.store = store;
    this.player = player;
    this.mediaIndex = mediaIndex;
    this.actions = actions;
    this.tab = 'general';
    this.el = h('aside', { class: 'inspector', 'aria-label': 'Propriétés' });
    store.on((reason) => {
      if (reason === 'preview' || reason === 'saving' || reason === 'saved') return;
      this.render();
    });
    this.render();
  }

  get clip() {
    const { selection, project } = this.store;
    return selection.length ? project.clips.find((c) => c.id === selection[0]) : null;
  }

  get advanced() {
    return document.documentElement.dataset.editorMode === 'advanced';
  }

  /** Applies fn(clipCopy) to every selected clip, as preview or commit. */
  edit(label, fn, { commit = true } = {}) {
    const ids = this.store.selection;
    const project = this.store.project;
    const next = { ...project, clips: project.clips.map((c) => (ids.includes(c.id) ? fn(structuredClone(c)) || c : c)) };
    if (commit) this.store.commit(label, next);
    else this.store.preview(next);
  }

  localTime(clip) {
    return Math.max(0, Math.min(clip.duration, this.store.time - clip.start));
  }

  render() {
    clear(this.el);
    if (this.onClose)
      this.el.append(h('button', { class: 'btn btn--sm btn--ghost sheet-close', type: 'button', 'aria-label': 'Fermer les propriétés', onclick: () => this.onClose() }, icon('close')));
    const clip = this.clip;
    if (!clip) return this.renderProject();
    const tabs = [
      ['general', 'Général'],
      ['transform', 'Transformer'],
    ];
    if (['video', 'image'].includes(clip.kind)) tabs.push(['color', 'Couleur']);
    if (clip.kind === 'text') tabs.splice(1, 0, ['text', 'Texte']);
    if (clip.kind !== 'audio') tabs.push(['effects', 'Effets'], ['transitions', 'Transitions']);
    if (['video', 'audio'].includes(clip.kind)) tabs.push(['audio', 'Audio']);
    if (['video', 'image'].includes(clip.kind)) tabs.push(['mask', 'Masque & incrustation']);
    if (clip.kind !== 'audio') tabs.push(['animation', 'Animation']);
    if (!tabs.some(([id]) => id === this.tab)) this.tab = tabs[0][0];
    const bar = h('div', { class: 'insp-tabs', role: 'tablist' });
    for (const [id, label] of tabs) {
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(this.tab === id) }, label);
      b.addEventListener('click', () => {
        this.tab = id;
        this.render();
      });
      bar.append(b);
    }
    const body = h('div', { class: 'insp-body', role: 'tabpanel' });
    const count = this.store.selection.length;
    this.el.append(
      h(
        'div',
        { class: 'insp-head' },
        h('strong', {}, count > 1 ? `${count} éléments sélectionnés` : clip.name || this.kindLabel(clip)),
        h('span', { class: 'tag' }, this.kindLabel(clip)),
      ),
      bar,
      body,
    );
    const renderers = {
      general: () => this.general(body, clip),
      transform: () => this.transform(body, clip),
      color: () => this.color(body, clip),
      text: () => this.text(body, clip),
      effects: () => this.effects(body, clip),
      transitions: () => this.transitions(body, clip),
      audio: () => this.audio(body, clip),
      mask: () => this.mask(body, clip),
      animation: () => this.animation(body, clip),
    };
    renderers[this.tab]();
  }

  kindLabel(clip) {
    return {
      video: 'Vidéo',
      image: 'Image',
      audio: 'Audio',
      text: 'Texte',
      sticker: 'Sticker',
      shape: 'Forme',
      placeholder: 'Emplacement',
    }[clip.kind];
  }

  // ---------------------------------------------------------------- field helpers
  slider(clip, path, label, { min, max, step = 0.01, format = (v) => v, animatable = false, fallback = 0 }) {
    const animated = Boolean(clip.keyframes?.[path]?.length);
    const local = this.localTime(clip);
    const value = animated ? valueAt(clip, path, local) : (getPath(clip, path) ?? fallback);
    const id = `f-${path.replace(/\W/g, '-')}`;
    const input = h('input', { type: 'range', id, min, max, step, value: String(value) });
    const out = h('output', { for: id }, String(format(value)));
    const apply = (commit) => {
      const v = Number(input.value);
      out.textContent = String(format(v));
      this.edit(
        label,
        (c) => {
          if (c.keyframes?.[path]?.length)
            setKeyframe(c, path, this.localTime(c), v, keyframeAt(c, path, this.localTime(c))?.ease || 'easeInOut');
          else setPath(c, path, v);
          return c;
        },
        { commit },
      );
    };
    input.addEventListener('input', () => apply(false));
    input.addEventListener('change', () => apply(true));
    const row = h('div', { class: 'insp-row' }, h('label', { for: id }, label), input, out);
    if (animatable) {
      const has = keyframeAt(clip, path, local);
      const kf = h(
        'button',
        {
          type: 'button',
          class: `kf-btn${has ? ' is-on' : animated ? ' is-animated' : ''}`,
          title: has ? 'Supprimer l’image clé au curseur' : 'Ajouter une image clé au curseur',
          'aria-label': `Image clé ${label}`,
          'aria-pressed': String(Boolean(has)),
        },
        '◆',
      );
      kf.addEventListener('click', () => {
        if (this.store.time < clip.start || this.store.time > clipEnd(clip))
          return this.actions.toast('Placez le curseur sur le clip pour poser une image clé.');
        this.edit(has ? 'Supprimer une image clé' : 'Ajouter une image clé', (c) =>
          has ? removeKeyframe(c, path, this.localTime(c)) : setKeyframe(c, path, this.localTime(c), Number(input.value)),
        );
      });
      row.append(kf);
    }
    return row;
  }

  select(label, value, options, onChange) {
    const id = `s-${Math.random().toString(36).slice(2, 8)}`;
    const sel = h(
      'select',
      { class: 'select select--sm', id },
      options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)),
    );
    sel.addEventListener('change', () => onChange(sel.value));
    return h('div', { class: 'insp-row insp-row--select' }, h('label', { for: id }, label), sel);
  }

  colorInput(label, value, onChange) {
    const id = `c-${Math.random().toString(36).slice(2, 8)}`;
    const input = h('input', { type: 'color', id, value: /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff' });
    input.addEventListener('change', () => onChange(input.value));
    return h('div', { class: 'insp-row insp-row--color' }, h('label', { for: id }, label), input);
  }

  check(label, value, onChange) {
    const input = h('input', { type: 'checkbox', checked: Boolean(value) });
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'insp-check' }, input, label);
  }

  section(title, ...children) {
    return h('div', { class: 'insp-section' }, title ? h('h3', {}, title) : null, ...children);
  }

  // ---------------------------------------------------------------- tabs
  general(body, clip) {
    const media = clip.mediaId ? this.mediaIndex.get(clip.mediaId) : null;
    const name = h('input', {
      class: 'input input--sm',
      value: clip.name || '',
      placeholder: this.kindLabel(clip),
      'aria-label': 'Nom du clip',
    });
    name.addEventListener('change', () => this.edit('Renommer', (c) => ((c.name = name.value), c)));
    const timeField = (label, value, onChange) => {
      const input = h('input', {
        class: 'input input--sm',
        type: 'number',
        step: '0.01',
        min: '0',
        value: value.toFixed(2),
        'aria-label': label,
      });
      input.addEventListener('change', () => onChange(Math.max(0, Number(input.value) || 0)));
      return h('div', { class: 'insp-row insp-row--select' }, h('label', {}, label), input);
    };
    body.append(
      this.section(
        'Clip',
        h('div', { class: 'insp-row insp-row--select' }, h('label', {}, 'Nom'), name),
        timeField('Début (s)', clip.start, (v) => this.edit('Position', (c) => ((c.start = v), c))),
        timeField('Durée (s)', clip.duration, (v) =>
          this.edit('Durée', (c) => {
            const limit = sourceLimit(c, media);
            c.duration = Math.max(0.1, Number.isFinite(limit) ? Math.min(v, (limit - c.in) / c.speed) : v);
            return c;
          }),
        ),
        media
          ? h(
              'p',
              { class: 'field__hint' },
              `Source : ${media.name}${media.duration ? ` · ${formatTime(media.duration)}` : ''}${media.width ? ` · ${media.width}×${media.height}` : ''}`,
            )
          : null,
      ),
    );
    if (clip.kind === 'video' || clip.kind === 'audio') {
      const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
      const speed = h('div', { class: 'chips' });
      for (const s of speeds) {
        const b = h('button', { type: 'button', class: `btn btn--sm${clip.speed === s ? ' btn--primary' : ''}` }, `${s}×`);
        b.addEventListener('click', () =>
          this.edit('Vitesse', (c) => {
            const sourceSpan = c.duration * c.speed;
            c.speed = s;
            c.duration = sourceSpan / s;
            return c;
          }),
        );
        speed.append(b);
      }
      body.append(
        this.section(
          'Vitesse',
          speed,
          this.check('Conserver la hauteur du son', clip.preservePitch !== false, (v) =>
            this.edit('Hauteur du son', (c) => ((c.preservePitch = v), c)),
          ),
          h(
            'p',
            { class: 'field__hint' },
            'Vitesse constante de 0,25× à 4×. Rampes de vitesse, courbes et lecture inversée : non disponibles avec le moteur navigateur actuel.',
          ),
        ),
      );
    }
    if (clip.kind === 'video' || clip.kind === 'image') {
      body.append(
        this.section(
          'Cadrage',
          this.select(
            'Ajustement',
            clip.fit || 'contain',
            [
              ['contain', 'Adapter (bandes)'],
              ['cover', 'Remplir (recadrer)'],
            ],
            (v) => this.edit('Ajustement', (c) => ((c.fit = v), c)),
          ),
          h(
            'div',
            { class: 'chips' },
            this.check('Retourner horizontalement', clip.flipH, (v) => this.edit('Retourner', (c) => ((c.flipH = v), c))),
            this.check('Retourner verticalement', clip.flipV, (v) => this.edit('Retourner', (c) => ((c.flipV = v), c))),
          ),
          this.slider(clip, 'crop.x', 'Recadrage gauche', { min: 0, max: 0.9, step: 0.01, format: pct }),
          this.slider(clip, 'crop.y', 'Recadrage haut', { min: 0, max: 0.9, step: 0.01, format: pct }),
          this.slider(clip, 'crop.w', 'Largeur gardée', { min: 0.1, max: 1, step: 0.01, format: pct, fallback: 1 }),
          this.slider(clip, 'crop.h', 'Hauteur gardée', { min: 0.1, max: 1, step: 0.01, format: pct, fallback: 1 }),
        ),
      );
    }
    if (clip.kind === 'sticker') {
      const emoji = h('input', { class: 'input input--sm', value: clip.sticker?.emoji || '', maxLength: 8, 'aria-label': 'Émoji' });
      emoji.addEventListener('change', () => this.edit('Sticker', (c) => ((c.sticker = { emoji: emoji.value || '⭐' }), c)));
      body.append(this.section('Sticker', h('div', { class: 'insp-row insp-row--select' }, h('label', {}, 'Émoji'), emoji)));
    }
    if (clip.kind === 'shape') {
      const s = clip.shape || {};
      body.append(
        this.section(
          'Forme',
          this.colorInput('Remplissage', s.fill, (v) => this.edit('Couleur de forme', (c) => ((c.shape = { ...c.shape, fill: v }), c))),
          this.colorInput('Contour', s.stroke, (v) => this.edit('Contour', (c) => ((c.shape = { ...c.shape, stroke: v }), c))),
          this.slider(clip, 'shape.strokeWidth', 'Épaisseur contour', { min: 0, max: 40, step: 1 }),
          this.slider(clip, 'shape.w', 'Largeur', { min: 0.02, max: 1.5, step: 0.01, format: pct }),
          this.slider(clip, 'shape.h', 'Hauteur', { min: 0.02, max: 1.5, step: 0.01, format: pct }),
          this.slider(clip, 'shape.radius', 'Arrondi', { min: 0, max: 0.5, step: 0.01, format: pct }),
        ),
      );
    }
    body.append(
      this.section(
        'Composition',
        this.select('Fusion', clip.blend || 'source-over', BLENDS, (v) => this.edit('Mode de fusion', (c) => ((c.blend = v), c))),
        h(
          'div',
          { class: 'insp-actions' },
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.layer(1) }, '↑ Calque au-dessus'),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.layer(-1) }, '↓ Calque en dessous'),
        ),
      ),
    );
  }

  transform(body, clip) {
    body.append(
      this.section(
        'Position et échelle',
        this.slider(clip, 'transform.x', 'Position X', { min: -0.5, max: 1.5, step: 0.001, format: pct, animatable: true }),
        this.slider(clip, 'transform.y', 'Position Y', { min: -0.5, max: 1.5, step: 0.001, format: pct, animatable: true }),
        this.slider(clip, 'transform.scale', 'Échelle', {
          min: 0.05,
          max: 5,
          step: 0.01,
          format: (v) => `${Math.round(v * 100)} %`,
          animatable: true,
        }),
        this.slider(clip, 'transform.rotation', 'Rotation', {
          min: -360,
          max: 360,
          step: 0.5,
          format: (v) => `${Math.round(v)}°`,
          animatable: true,
        }),
        this.slider(clip, 'transform.opacity', 'Opacité', { min: 0, max: 1, step: 0.01, format: pct, animatable: true }),
        h(
          'p',
          { class: 'field__hint' },
          'Astuce : faites glisser l’élément directement dans l’aperçu. ◆ ajoute une image clé à la position du curseur.',
        ),
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () =>
              this.edit(
                'Réinitialiser la transformation',
                (c) => (
                  (c.transform = { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 }),
                  delete c.keyframes['transform.x'],
                  delete c.keyframes['transform.y'],
                  delete c.keyframes['transform.scale'],
                  delete c.keyframes['transform.rotation'],
                  delete c.keyframes['transform.opacity'],
                  c
                ),
              ),
          },
          'Réinitialiser',
        ),
      ),
    );
  }

  color(body, clip) {
    body.append(
      this.section(
        'Correction',
        this.slider(clip, 'color.exposure', 'Exposition', { min: -100, max: 100, step: 1, animatable: true }),
        this.slider(clip, 'color.contrast', 'Contraste', { min: -100, max: 100, step: 1 }),
        this.slider(clip, 'color.saturation', 'Saturation', { min: -100, max: 100, step: 1, animatable: true }),
        this.slider(clip, 'color.temperature', 'Température', { min: -100, max: 100, step: 1 }),
        this.slider(clip, 'color.tint', 'Teinte vert/magenta', { min: -100, max: 100, step: 1 }),
        this.slider(clip, 'color.hue', 'Rotation de teinte', { min: -180, max: 180, step: 1, format: (v) => `${v}°` }),
        this.slider(clip, 'color.vignette', 'Vignettage', { min: 0, max: 100, step: 1 }),
        h(
          'div',
          { class: 'insp-actions' },
          h(
            'button',
            {
              class: 'btn btn--sm',
              type: 'button',
              onclick: () => this.edit('Réinitialiser la couleur', (c) => ((c.color = defaultColor()), c)),
            },
            'Réinitialiser',
          ),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.copyColor(clip) }, 'Copier'),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.pasteColor() }, 'Coller'),
        ),
        h(
          'p',
          { class: 'field__hint' },
          'Réglages non destructifs, appliqués au rendu. Avant/après : désactivez temporairement avec « Comparer » dans l’aperçu.',
        ),
      ),
      this.section(
        'Préréglages',
        h(
          'div',
          { class: 'chips' },
          ...[
            ['Cinéma froid', { exposure: -5, contrast: 15, saturation: -10, temperature: -20, tint: 0, hue: 0, vignette: 30 }],
            ['Été chaud', { exposure: 8, contrast: 5, saturation: 15, temperature: 30, tint: 5, hue: 0, vignette: 10 }],
            ['Néon', { exposure: 0, contrast: 25, saturation: 40, temperature: -10, tint: 15, hue: 0, vignette: 20 }],
            ['Délavé', { exposure: 10, contrast: -25, saturation: -30, temperature: 5, tint: 0, hue: 0, vignette: 0 }],
            ['Neutre', defaultColor()],
          ].map(([label, color]) =>
            h(
              'button',
              {
                class: 'btn btn--sm',
                type: 'button',
                onclick: () => this.edit(`Préréglage ${label}`, (c) => ((c.color = { ...color }), c)),
              },
              label,
            ),
          ),
        ),
        h(
          'p',
          { class: 'field__hint' },
          'Courbes, roues chromatiques, LUT et histogramme : disponibles dans l’éditeur photo. Pour la vidéo, ils nécessitent un rendu WebGL non encore implémenté.',
        ),
      ),
    );
  }

  text(body, clip) {
    const t = clip.text;
    const content = h('textarea', { class: 'textarea textarea--sm', rows: 3, 'aria-label': 'Texte' });
    content.value = t.content;
    content.addEventListener('input', () => this.edit('Texte', (c) => ((c.text.content = content.value), c), { commit: false }));
    content.addEventListener('change', () => this.edit('Texte', (c) => ((c.text.content = content.value), c)));
    const set = (label, key) => (v) => this.edit(label, (c) => ((c.text[key] = v), c));
    body.append(
      this.section('Contenu', content),
      this.section(
        'Typographie',
        this.select('Police', t.font, FONTS, set('Police', 'font')),
        this.slider(clip, 'text.size', 'Taille', { min: 12, max: 400, step: 1 }),
        this.select(
          'Graisse',
          String(t.weight),
          [
            ['300', 'Fine'],
            ['400', 'Normale'],
            ['600', 'Demi-gras'],
            ['700', 'Gras'],
            ['900', 'Extra-gras'],
          ],
          (v) => this.edit('Graisse', (c) => ((c.text.weight = Number(v)), c)),
        ),
        this.check('Italique', t.italic, set('Italique', 'italic')),
        this.slider(clip, 'text.letterSpacing', 'Espacement', { min: -10, max: 60, step: 1 }),
        this.slider(clip, 'text.lineHeight', 'Interlignage', { min: 0.8, max: 2.5, step: 0.05 }),
        this.select(
          'Alignement',
          t.align,
          [
            ['left', 'Gauche'],
            ['center', 'Centré'],
            ['right', 'Droite'],
          ],
          set('Alignement', 'align'),
        ),
      ),
      this.section(
        'Style',
        this.colorInput('Couleur', t.color, set('Couleur du texte', 'color')),
        this.check('Dégradé bleu → violet', Boolean(t.gradient), (v) =>
          this.edit('Dégradé', (c) => ((c.text.gradient = v ? ['#45E5F5', '#8B5CF6'] : null), c)),
        ),
        this.colorInput('Contour', t.stroke, set('Couleur du contour', 'stroke')),
        this.slider(clip, 'text.strokeWidth', 'Épaisseur contour', { min: 0, max: 30, step: 1 }),
        this.slider(clip, 'text.shadow', 'Ombre', { min: 0, max: 1, step: 0.05 }),
        this.check('Fond', Boolean(t.background), (v) =>
          this.edit('Fond du texte', (c) => ((c.text.background = v ? 'rgba(8,11,22,0.7)' : null), c)),
        ),
      ),
      this.section(
        'Animation du texte',
        this.select('Entrée', t.animIn || 'none', Object.entries(TEXT_ANIM_LABELS), set('Animation d’entrée', 'animIn')),
        this.select('Sortie', t.animOut || 'none', Object.entries(TEXT_ANIM_LABELS), set('Animation de sortie', 'animOut')),
        this.select('En continu', t.loop || 'none', Object.entries(TEXT_LOOPS), set('Animation continue', 'loop')),
        this.slider(clip, 'text.animDuration', 'Durée', { min: 0.1, max: 3, step: 0.05, format: (v) => `${v} s` }),
      ),
    );
  }

  effects(body, clip) {
    const list = h('div', { class: 'fx-list' });
    clip.effects.forEach((effect, index) => {
      const def = EFFECT_MAP[effect.type];
      if (!def) return;
      const params = def.params.map((p) => {
        const id = `fx-${effect.id}-${p.key}`;
        const input = h('input', {
          type: 'range',
          id,
          min: p.min,
          max: p.max,
          step: p.step,
          value: String(effect.params[p.key] ?? p.default),
        });
        const out = h('output', { for: id }, String(effect.params[p.key] ?? p.default));
        const apply = (commit) => {
          out.textContent = input.value;
          this.edit(`Réglage ${def.label}`, (c) => ((c.effects[index].params[p.key] = Number(input.value)), c), { commit });
        };
        input.addEventListener('input', () => apply(false));
        input.addEventListener('change', () => apply(true));
        return h('div', { class: 'insp-row' }, h('label', { for: id }, p.label), input, out);
      });
      const toggle = h('input', { type: 'checkbox', checked: effect.enabled !== false, 'aria-label': `Activer ${def.label}` });
      toggle.addEventListener('change', () =>
        this.edit(`${toggle.checked ? 'Activer' : 'Désactiver'} ${def.label}`, (c) => ((c.effects[index].enabled = toggle.checked), c)),
      );
      list.append(
        h(
          'div',
          { class: 'fx-item' },
          h(
            'div',
            { class: 'fx-head' },
            toggle,
            h('strong', {}, def.label),
            def.heavy ? h('span', { class: 'tag', title: 'Calcul pixel par pixel : peut ralentir l’aperçu' }, 'lourd') : null,
            h(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                type: 'button',
                'aria-label': `Retirer ${def.label}`,
                onclick: () => this.edit(`Retirer ${def.label}`, (c) => (c.effects.splice(index, 1), c)),
              },
              icon('trash'),
            ),
          ),
          ...params,
        ),
      );
    });
    const groups = {};
    for (const e of EFFECTS) (groups[e.category] ??= []).push(e);
    const add = h('div', { class: 'fx-add' });
    for (const [category, items] of Object.entries(groups)) {
      add.append(
        h('h4', {}, category),
        h(
          'div',
          { class: 'chips' },
          items.map((e) =>
            h(
              'button',
              {
                class: 'btn btn--sm',
                type: 'button',
                onclick: () =>
                  this.edit(`Effet ${e.label}`, (c) => (c.effects.push({ id: uid('e'), type: e.id, params: defaultParams(e.id) }), c)),
              },
              `+ ${e.label}`,
            ),
          ),
        ),
      );
    }
    body.append(
      this.section(clip.effects.length ? 'Effets appliqués' : 'Aucun effet appliqué', list),
      this.section('Ajouter un effet', add),
      this.section(
        'Non disponibles',
        h(
          'ul',
          { class: 'unavailable' },
          UNAVAILABLE_EFFECTS.map((u) => h('li', {}, h('strong', {}, u.label), ' — ', u.reason)),
        ),
      ),
    );
  }

  transitions(body, clip) {
    const block = (edge, title) => {
      const current = clip[edge];
      const options = [
        ['', 'Aucune'],
        ...TRANSITIONS.filter((t) => edge === 'transitionIn' || !t.inOnly).map((t) => [t.id, `${t.label} · ${t.category}`]),
      ];
      const children = [
        this.select('Type', current?.type || '', options, (v) =>
          this.edit(
            `${title}`,
            (c) => (
              (c[edge] = v ? { ...defaultTransition(v), duration: getPrefs().defaultTransition, ...(c[edge] || {}), type: v } : null),
              c
            ),
          ),
        ),
      ];
      if (current) {
        children.push(
          this.slider(clip, `${edge}.duration`, 'Durée', {
            min: 0.1,
            max: Math.max(0.2, Math.min(5, clip.duration)),
            step: 0.05,
            format: (v) => `${v} s`,
          }),
        );
        children.push(this.slider(clip, `${edge}.intensity`, 'Intensité', { min: 0.1, max: 2, step: 0.05 }));
        if (TRANSITION_MAP[current.type]?.directional)
          children.push(
            this.select('Direction', current.direction || 'left', Object.entries(DIRECTIONS), (v) =>
              this.edit('Direction', (c) => ((c[edge].direction = v), c)),
            ),
          );
        if (current.type === 'crossfade')
          children.push(
            h(
              'p',
              { class: 'field__hint' },
              'Fond le clip avec la dernière image du clip précédent sur la même piste (les deux clips doivent se toucher).',
            ),
          );
      }
      return this.section(title, ...children);
    };
    body.append(
      block('transitionIn', 'Transition d’entrée'),
      block('transitionOut', 'Transition de sortie'),
      this.section(
        '',
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () => {
              const tin = clip.transitionIn;
              const all = this.store.project.clips.filter((c) => c.trackId === clip.trackId && c.kind !== 'audio');
              this.store.commit('Appliquer la transition à la piste', {
                ...this.store.project,
                clips: this.store.project.clips.map((c) =>
                  all.some((x) => x.id === c.id) ? { ...c, transitionIn: tin ? { ...tin } : null } : c,
                ),
              });
            },
          },
          'Appliquer la transition d’entrée à toute la piste',
        ),
      ),
    );
  }

  audio(body, clip) {
    body.append(
      this.section(
        'Volume',
        this.slider(clip, 'audio.volume', 'Volume', {
          min: 0,
          max: 2,
          step: 0.01,
          format: (v) => `${Math.round(v * 100)} %`,
          animatable: true,
        }),
        this.slider(clip, 'audio.fadeIn', 'Fondu d’entrée', {
          min: 0,
          max: Math.min(10, clip.duration / 2),
          step: 0.05,
          format: (v) => `${v} s`,
        }),
        this.slider(clip, 'audio.fadeOut', 'Fondu de sortie', {
          min: 0,
          max: Math.min(10, clip.duration / 2),
          step: 0.05,
          format: (v) => `${v} s`,
        }),
        this.slider(clip, 'audio.pan', 'Panoramique', {
          min: -1,
          max: 1,
          step: 0.01,
          format: (v) => (v === 0 ? 'Centre' : v < 0 ? `G ${Math.round(-v * 100)}` : `D ${Math.round(v * 100)}`),
        }),
        this.check('Muet', clip.muted, (v) => this.edit('Muet', (c) => ((c.muted = v), c))),
      ),
      this.section(
        'Outils',
        h(
          'div',
          { class: 'insp-actions' },
          clip.kind === 'video'
            ? h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.detachAudio(clip) }, 'Détacher l’audio')
            : null,
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.normalize(clip) }, 'Normaliser (−1 dB)'),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.cutSilences(clip) }, 'Couper les silences'),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.findPeaks(clip) }, 'Détecter les pics'),
        ),
        h(
          'p',
          { class: 'field__hint' },
          'Réduction de bruit, égaliseur, compresseur, réverbération et amélioration de voix : non disponibles pour le moment (traitement audio hors ligne non implémenté).',
        ),
      ),
    );
  }

  mask(body, clip) {
    const m = clip.mask;
    const ch = clip.chroma;
    const children = [
      this.select(
        'Forme',
        m.type,
        [
          ['none', 'Aucun'],
          ['rect', 'Rectangle'],
          ['ellipse', 'Ellipse'],
          ['polygon', 'Tracé libre'],
        ],
        (v) =>
          this.edit(
            'Masque',
            (c) => (
              (c.mask.type = v),
              v === 'polygon' &&
                !c.mask.points?.length &&
                (c.mask.points = [
                  [0.3, 0.3],
                  [0.7, 0.3],
                  [0.7, 0.7],
                  [0.3, 0.7],
                ]),
              c
            ),
          ),
      ),
    ];
    if (m.type !== 'none') {
      if (m.type !== 'polygon') {
        children.push(
          this.slider(clip, 'mask.x', 'Centre X', { min: 0, max: 1, step: 0.001, format: pct, animatable: true }),
          this.slider(clip, 'mask.y', 'Centre Y', { min: 0, max: 1, step: 0.001, format: pct, animatable: true }),
          this.slider(clip, 'mask.w', 'Largeur', { min: 0.02, max: 2, step: 0.001, format: pct, animatable: true }),
          this.slider(clip, 'mask.h', 'Hauteur', { min: 0.02, max: 2, step: 0.001, format: pct, animatable: true }),
        );
      } else {
        children.push(
          h(
            'button',
            { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.drawMask(clip) },
            icon('brush'),
            'Dessiner le tracé dans l’aperçu',
          ),
        );
      }
      children.push(
        this.slider(clip, 'mask.feather', 'Contour progressif', { min: 0, max: 0.3, step: 0.005, format: pct }),
        this.check('Inverser le masque', m.invert, (v) => this.edit('Inverser le masque', (c) => ((c.mask.invert = v), c))),
      );
    }
    body.append(
      this.section('Masque', ...children),
      this.section(
        'Incrustation (fond vert / bleu)',
        this.check('Activer la chrominance', ch.enabled, (v) => this.edit('Chrominance', (c) => ((c.chroma.enabled = v), c))),
        ...(ch.enabled
          ? [
              this.colorInput('Couleur à retirer', ch.color, (v) => this.edit('Couleur de chrominance', (c) => ((c.chroma.color = v), c))),
              h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.pickChroma(clip) }, 'Pipette dans l’aperçu'),
              this.slider(clip, 'chroma.tolerance', 'Tolérance', { min: 0, max: 1, step: 0.01, format: pct }),
              this.slider(clip, 'chroma.softness', 'Contour', { min: 0, max: 1, step: 0.01, format: pct }),
              this.slider(clip, 'chroma.spill', 'Suppression du débordement', { min: 0, max: 1, step: 0.01, format: pct }),
            ]
          : []),
        h(
          'p',
          { class: 'field__hint' },
          'Suppression d’arrière-plan par IA et détourage intelligent pour la vidéo : non disponibles (aucun modèle de segmentation vidéo connecté).',
        ),
      ),
    );
  }

  animation(body, clip) {
    const presets = h('div', { class: 'chips' });
    for (const [id, preset] of Object.entries(MOTION_PRESETS)) {
      presets.append(
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () =>
              this.edit(`Mouvement ${preset.label}`, (c) => ((c.keyframes = { ...c.keyframes, ...preset.build(c.duration) }), c)),
          },
          preset.label,
        ),
      );
    }
    const rows = [];
    for (const [path, list] of Object.entries(clip.keyframes || {})) {
      const label = ANIMATABLE.find((a) => a.path === path)?.label || path;
      list.forEach((k, i) => {
        const ease = h(
          'select',
          { class: 'select select--sm', 'aria-label': 'Interpolation' },
          Object.entries(EASING_LABELS).map(([v, l]) => h('option', { value: v, selected: v === k.ease }, l)),
        );
        ease.addEventListener('change', () => this.edit('Interpolation', (c) => ((c.keyframes[path][i].ease = ease.value), c)));
        rows.push(
          h(
            'div',
            { class: 'kf-row' },
            h(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                type: 'button',
                onclick: () => this.actions.seek(clip.start + k.t),
                title: 'Aller à cette image clé',
              },
              `◆ ${formatTime(k.t, 30, true)}`,
            ),
            h('span', {}, `${label} = ${Math.round(k.v * 100) / 100}`),
            ease,
            h(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                type: 'button',
                'aria-label': 'Supprimer',
                onclick: () => this.edit('Supprimer une image clé', (c) => removeKeyframe(c, path, k.t)),
              },
              '✕',
            ),
          ),
        );
      });
    }
    body.append(
      this.section('Préréglages de mouvement', presets),
      this.section(
        rows.length ? 'Images clés' : 'Aucune image clé',
        ...rows,
        rows.length
          ? h(
              'button',
              { class: 'btn btn--sm', type: 'button', onclick: () => this.edit('Supprimer l’animation', (c) => ((c.keyframes = {}), c)) },
              'Tout supprimer',
            )
          : h('p', { class: 'field__hint' }, 'Utilisez ◆ dans les onglets Transformer, Couleur, Audio ou Masque.'),
      ),
      this.section(
        'Copier l’animation',
        h(
          'div',
          { class: 'insp-actions' },
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.copyAnimation(clip) }, 'Copier'),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.pasteAnimation() }, 'Coller sur la sélection'),
        ),
      ),
      this.section(
        'Suivi de mouvement',
        h(
          'p',
          { class: 'field__hint' },
          'Suivi d’objet, de visage et planaire : non disponibles (aucun algorithme de tracking intégré pour le moment). Alternative : animez la position avec des images clés.',
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- project panel
  renderProject() {
    const project = this.store.project;
    const tabs = [
      ['project', 'Projet'],
      ['subtitles', 'Sous-titres'],
      ['history', 'Historique'],
    ];
    if (!tabs.some(([id]) => id === this.tab)) this.tab = 'project';
    const bar = h('div', { class: 'insp-tabs', role: 'tablist' });
    for (const [id, label] of tabs) {
      const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(this.tab === id) }, label);
      b.addEventListener('click', () => {
        this.tab = id;
        this.render();
      });
      bar.append(b);
    }
    const body = h('div', { class: 'insp-body' });
    this.el.append(h('div', { class: 'insp-head' }, h('strong', {}, project.name), h('span', { class: 'tag' }, 'Projet')), bar, body);
    if (this.tab === 'subtitles') return this.actions.renderSubtitles(body);
    if (this.tab === 'history') return this.renderHistory(body);
    const fps = this.select(
      'Images par seconde',
      String(project.settings.fps),
      [
        ['24', '24 i/s'],
        ['25', '25 i/s'],
        ['30', '30 i/s'],
        ['50', '50 i/s'],
        ['60', '60 i/s'],
      ],
      (v) => this.store.commit('Fréquence d’images', { ...project, settings: { ...project.settings, fps: Number(v) } }),
    );
    body.append(
      this.section(
        'Format',
        this.select(
          'Rapport',
          project.settings.aspect,
          Object.entries(ASPECTS).map(([id, a]) => [id, `${a.label} · ${a.width}×${a.height}`]),
          (v) => this.store.commit('Format du projet', changeAspect(project, v)),
        ),
        fps,
        this.colorInput('Fond', project.settings.background, (v) =>
          this.store.commit('Couleur de fond', { ...project, settings: { ...project.settings, background: v } }),
        ),
      ),
      this.section(
        'Audio',
        this.check('Atténuer la musique pendant la voix', project.ducking?.enabled, (v) =>
          this.store.commit('Atténuation automatique', { ...project, ducking: { ...project.ducking, enabled: v } }),
        ),
        (() => {
          const id = 'duck-amount';
          const input = h('input', { type: 'range', id, min: 0, max: 1, step: 0.05, value: String(project.ducking?.amount ?? 0.3) });
          input.addEventListener('change', () =>
            this.store.commit('Niveau d’atténuation', { ...project, ducking: { ...project.ducking, amount: Number(input.value) } }),
          );
          return h(
            'div',
            { class: 'insp-row' },
            h('label', { for: id }, 'Niveau musique'),
            input,
            h('output', {}, pct(project.ducking?.amount ?? 0.3)),
          );
        })(),
        h('p', { class: 'field__hint' }, 'Rôles « Voix » et « Musique » réglables dans l’en-tête de chaque piste.'),
      ),
      this.section(
        'Ajouter',
        h(
          'div',
          { class: 'insp-actions' },
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => this.actions.addText() }, '+ Texte'),
          h(
            'button',
            {
              class: 'btn btn--sm',
              type: 'button',
              onclick: () => this.store.commit('Ajouter une piste texte', { ...project, tracks: [createTrack('text'), ...project.tracks] }),
            },
            '+ Piste texte',
          ),
        ),
      ),
      this.section(
        'Marqueurs',
        project.markers.length
          ? h(
              'ul',
              { class: 'marker-list' },
              project.markers.map((m) =>
                h(
                  'li',
                  {},
                  h(
                    'button',
                    { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => this.actions.seek(m.t) },
                    `${formatTime(m.t)} · ${m.label}`,
                  ),
                ),
              ),
            )
          : h('p', { class: 'field__hint' }, 'Aucun marqueur (touche M).'),
      ),
    );
  }

  renderHistory(body) {
    const entries = this.store.history.entries;
    if (!entries.length) {
      body.append(h('p', { class: 'field__hint' }, 'Aucune modification pour le moment.'));
      return;
    }
    const list = h('ol', { class: 'history-list' });
    entries.forEach((entry, index) => {
      list.append(
        h(
          'li',
          {},
          h('span', {}, entry.label),
          h('time', {}, new Date(entry.at).toLocaleTimeString('fr-FR')),
          h(
            'button',
            {
              class: 'btn btn--sm btn--ghost',
              type: 'button',
              title: 'Revenir à l’état d’avant cette action',
              onclick: () => this.actions.revertTo(index),
            },
            'Revenir avant',
          ),
        ),
      );
    });
    body.append(this.section(`${entries.length} action(s)`, list));
  }
}

function keyframeAt(clip, path, t) {
  return clip.keyframes?.[path]?.find((k) => Math.abs(k.t - t) < 1 / 60);
}

function pct(v) {
  return `${Math.round(v * 100)} %`;
}
