import { h, clear } from '../../lib/dom.js';
import { saveFile } from '../../lib/download.js';
import { icon } from '../../components/icons.js';
import { confirmDialog, openModal, toast, setBusy } from '../../components/feedback.js';
import { EditorStore, openProject } from '../editorStore.js';
import { PhotoRenderer, ADJUSTMENTS, FILTER_PRESETS, SOCIAL_SIZES, parseCube } from '../photo/engine.js';
import { importFile, ACCEPT } from '../media.js';
import { db, uid } from '../db.js';
import { defaultText } from '../project.js';
import { SHAPES, queryStickers } from '../stickers.js';
import { createMaskPainter, canvasToBlob } from '../../lib/imageOps.js';
import { api, watchCreation } from '../../lib/api.js';
import { getCapabilities, providerFor } from '../../lib/state.js';
import { isStatic } from '../../lib/env.js';
import { logoMark } from '../../components/logo.js';

const say = (message, type = 'info') => toast(message, { type });
const PREVIEW_EDGE = 1600;

function newLayer(kind, fields = {}) {
  return {
    id: uid('l'),
    kind,
    name: '',
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    opacity: 1,
    blend: 'source-over',
    flipH: false,
    flipV: false,
    hidden: false,
    adjust: {},
    crop: { x: 0, y: 0, w: 1, h: 1 },
    ...fields,
  };
}

export async function photoEditorPage({ params }) {
  const opened = params.get('id') ? await openProject(params.get('id')).catch(() => null) : null;
  if (!opened || opened.project.type !== 'photo') {
    return {
      title: 'Projet introuvable',
      el: h(
        'div',
        { class: 'page container', style: { padding: '80px 0' } },
        h('h1', {}, 'Projet introuvable'),
        h('a', { class: 'btn btn--primary', href: '/projets', 'data-link': '' }, 'Retour aux projets'),
      ),
    };
  }
  let project = opened.project;
  if (
    opened.recovery &&
    (await confirmDialog({
      title: 'Récupérer les modifications ?',
      message: 'Une version plus récente non enregistrée a été trouvée.',
      confirmLabel: 'Récupérer',
    }))
  )
    project = opened.recovery;
  const store = new EditorStore(project);
  if (store.project.layers[0]) store.selection = [store.project.layers.at(-1).id];
  const renderer = new PhotoRenderer();
  const imageProvider = providerFor('image');
  const aiReady = !isStatic() && imageProvider?.configured;
  let tab = 'adjust';
  let compare = false;
  let painter = null;

  // LUTs are stored separately in IndexedDB (kv) and loaded on demand.
  for (const layer of store.project.layers) {
    if (layer.lutId && !renderer.luts.has(layer.lutId)) {
      const lut = await db.get(`lut:${layer.lutId}`).catch(() => null);
      if (lut) renderer.luts.set(layer.lutId, lut);
    }
  }

  const canvas = h('canvas', { class: 'photo-canvas', 'aria-label': 'Aperçu de l’image' });
  const ctx = canvas.getContext('2d');
  const stageBox = h('div', { class: 'preview-box photo-box' }, canvas);
  let renderToken = 0;
  let queued = false;
  const render = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(async () => {
      queued = false;
      const token = ++renderToken;
      const { width, height } = store.project.settings;
      const scale = Math.min(1, PREVIEW_EDGE / Math.max(width, height));
      const off = document.createElement('canvas');
      off.width = Math.round(width * scale);
      off.height = Math.round(height * scale);
      try {
        await renderer.render(off.getContext('2d'), store.project, { original: compare });
      } catch (error) {
        say(`Rendu impossible : ${error.message}`, 'error');
        return;
      }
      if (token !== renderToken) return;
      canvas.width = off.width;
      canvas.height = off.height;
      ctx.drawImage(off, 0, 0);
      fit();
    });
  };
  const fit = () => {
    const box = stageBox.getBoundingClientRect();
    const { width, height } = store.project.settings;
    const s = Math.min(box.width / width, box.height / height);
    canvas.style.width = `${Math.floor(width * s)}px`;
    canvas.style.height = `${Math.floor(height * s)}px`;
    if (painter) Object.assign(painter.canvas.style, { width: canvas.style.width, height: canvas.style.height });
  };

  const selected = () => store.project.layers.find((l) => l.id === store.selection[0]) || null;
  const editLayer = (label, fn, { commit = true } = {}) => {
    const l = selected();
    if (!l) return;
    const next = { ...store.project, layers: store.project.layers.map((x) => (x.id === l.id ? fn(structuredClone(x)) || x : x)) };
    if (commit) store.commit(label, next);
    else store.preview(next);
  };
  const editProject = (label, patch) => store.commit(label, { ...store.project, ...patch });

  // drag selected layer on canvas
  canvas.addEventListener('pointerdown', (event) => {
    if (painter) return;
    const l = selected();
    if (!l || l.locked) return;
    const rect = canvas.getBoundingClientRect();
    const before = store.project;
    canvas.setPointerCapture(event.pointerId);
    const move = (e) => {
      const dx = (e.clientX - event.clientX) / rect.width;
      const dy = (e.clientY - event.clientY) / rect.height;
      store.preview({ ...before, layers: before.layers.map((x) => (x.id === l.id ? { ...x, x: l.x + dx, y: l.y + dy } : x)) });
    };
    const up = () => {
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      if (store.project !== before) store.finishGesture('Déplacer le calque', before);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
  });

  // ---------------------------------------------------------------- layers panel
  const layersPanel = h('aside', { class: 'library photo-layers', 'aria-label': 'Calques' });
  const imgInput = h('input', { type: 'file', accept: ACCEPT.image.join(','), hidden: true });
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files[0];
    if (!file) return;
    try {
      const meta = await importFile(file);
      const layer = newLayer('image', { mediaId: meta.id, name: meta.name });
      store.commit('Ajouter une image', { ...store.project, layers: [...store.project.layers, layer] }, { select: [layer.id] });
    } catch (error) {
      say(error.message, 'error');
    }
    imgInput.value = '';
  });
  const renderLayers = () => {
    clear(layersPanel);
    layersPanel.append(h('button', { class: 'btn btn--sm btn--ghost sheet-close', type: 'button', 'aria-label': 'Fermer les calques', onclick: () => setSheet('') }, icon('close')));
    const list = h('ol', { class: 'layer-list', 'aria-label': 'Calques (le premier est au-dessus)' });
    [...store.project.layers].reverse().forEach((layer) => {
      const idx = store.project.layers.indexOf(layer);
      const item = h(
        'li',
        { class: `layer-item${store.selection.includes(layer.id) ? ' is-selected' : ''}` },
        h(
          'button',
          { class: 'layer-select', type: 'button', onclick: () => store.select([layer.id]) },
          h('span', { class: 'tag' }, { image: 'Image', text: 'Texte', shape: 'Forme', sticker: 'Sticker' }[layer.kind]),
          ' ',
          layer.name || layer.text?.content?.slice(0, 20) || layer.emoji || 'Calque',
        ),
        h(
          'button',
          {
            class: 'tl-hbtn',
            type: 'button',
            title: layer.hidden ? 'Afficher' : 'Masquer',
            onclick: () =>
              store.commit('Visibilité du calque', {
                ...store.project,
                layers: store.project.layers.map((x) => (x.id === layer.id ? { ...x, hidden: !x.hidden } : x)),
              }),
          },
          layer.hidden ? '🙈' : '👁',
        ),
        h(
          'button',
          {
            class: 'tl-hbtn',
            type: 'button',
            title: 'Monter',
            disabled: idx === store.project.layers.length - 1,
            onclick: () => move(idx, 1),
          },
          '↑',
        ),
        h('button', { class: 'tl-hbtn', type: 'button', title: 'Descendre', disabled: idx === 0, onclick: () => move(idx, -1) }, '↓'),
        h(
          'button',
          {
            class: 'tl-hbtn',
            type: 'button',
            title: 'Supprimer',
            onclick: () =>
              store.commit(
                'Supprimer le calque',
                { ...store.project, layers: store.project.layers.filter((x) => x.id !== layer.id) },
                { select: [] },
              ),
          },
          '✕',
        ),
      );
      list.append(item);
    });
    const stickerRow = h(
      'div',
      { class: 'sticker-grid sticker-grid--sm' },
      queryStickers({ pageSize: 24 }).items.map((s) =>
        h(
          'button',
          { class: 'sticker', type: 'button', onclick: () => addLayer(newLayer('sticker', { emoji: s.emoji, name: s.emoji, scale: 0.6 })) },
          s.emoji,
        ),
      ),
    );
    layersPanel.append(
      h('h2', { class: 'stage__title' }, 'Calques'),
      list,
      h(
        'div',
        { class: 'insp-actions' },
        h('label', { class: 'btn btn--sm' }, '+ Image', imgInput),
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () => addLayer(newLayer('text', { text: { ...defaultText(), animIn: 'none', animOut: 'none' }, name: 'Texte' })),
          },
          '+ Texte',
        ),
      ),
      h('h3', { class: 'field__label' }, 'Formes'),
      h(
        'div',
        { class: 'chips' },
        SHAPES.map((s) =>
          h(
            'button',
            { class: 'btn btn--sm', type: 'button', onclick: () => addLayer(newLayer('shape', { shape: { ...s.shape }, name: s.label })) },
            s.label,
          ),
        ),
      ),
      h('h3', { class: 'field__label' }, 'Stickers'),
      stickerRow,
    );
  };
  const move = (idx, dir) => {
    const layers = [...store.project.layers];
    const [l] = layers.splice(idx, 1);
    layers.splice(idx + dir, 0, l);
    store.commit('Ordre des calques', { ...store.project, layers });
  };
  const addLayer = (layer) =>
    store.commit(`Ajouter ${layer.name}`, { ...store.project, layers: [...store.project.layers, layer] }, { select: [layer.id] });

  // ---------------------------------------------------------------- properties
  const props = h('aside', { class: 'inspector', 'aria-label': 'Propriétés' });
  const PHOTO_TABS = [
    ['adjust', 'Réglages', 'sun'],
    ['curve', 'Courbe & LUT', 'brush'],
    ['layer', 'Calque', 'layers'],
    ['canvas', 'Toile', 'image'],
    ['ai', 'Outils IA', 'wand'],
  ];
  let drawCats = null;
  let root = null;
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  function setSheet(name) {
    if (root) root.dataset.sheet = name;
    drawCats?.();
  }
  const slider = (label, value, min, max, step, onInput) => {
    const id = `p-${Math.random().toString(36).slice(2, 8)}`;
    const input = h('input', { type: 'range', id, min, max, step, value: String(value) });
    const out = h('output', { for: id }, String(value));
    input.addEventListener('input', () => ((out.textContent = input.value), onInput(Number(input.value), false)));
    input.addEventListener('change', () => onInput(Number(input.value), true));
    return h('div', { class: 'insp-row' }, h('label', { for: id }, label), input, out);
  };
  const section = (title, ...children) => h('div', { class: 'insp-section' }, title ? h('h3', {}, title) : null, ...children);
  const labelTag = (kind) =>
    h('span', { class: `tag ${kind === 'IA distante' ? 'tag--run' : kind === 'Expérimental' ? 'tag--off' : 'tag--ok'}` }, kind);

  const renderProps = () => {
    clear(props);
    props.append(h('button', { class: 'btn btn--sm btn--ghost sheet-close', type: 'button', 'aria-label': 'Fermer le panneau', onclick: () => setSheet('') }, icon('close')));
    drawCats?.();
    const l = selected();
    const tabs = PHOTO_TABS;
    const bar = h(
      'div',
      { class: 'insp-tabs', role: 'tablist' },
      tabs.map(([id, label]) =>
        h(
          'button',
          { type: 'button', role: 'tab', 'aria-selected': String(tab === id), onclick: () => ((tab = id), renderProps()) },
          label,
        ),
      ),
    );
    const body = h('div', { class: 'insp-body' });
    props.append(h('div', { class: 'insp-head' }, h('strong', {}, l ? l.name || 'Calque' : store.project.name)), bar, body);
    const needImage = () => body.append(h('p', { class: 'field__hint' }, 'Sélectionnez un calque image.'));
    if (tab === 'adjust') {
      if (!l || l.kind !== 'image') return needImage();
      body.append(
        section(
          'Filtres',
          h(
            'div',
            { class: 'chips' },
            Object.entries(FILTER_PRESETS).map(([id, f]) =>
              h(
                'button',
                {
                  class: 'btn btn--sm',
                  type: 'button',
                  onclick: () => editLayer(`Filtre ${f.label}`, (x) => ((x.adjust = { ...f.adjust }), x)),
                },
                f.label,
              ),
            ),
          ),
        ),
        section(
          'Réglages',
          labelTag('Local'),
          ...ADJUSTMENTS.map((a) =>
            slider(a.label, l.adjust?.[a.key] || 0, a.min, a.max, 1, (v, commit) =>
              editLayer(a.label, (x) => ((x.adjust = { ...x.adjust, [a.key]: v }), x), { commit }),
            ),
          ),
        ),
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            onclick: () => editLayer('Réinitialiser les réglages', (x) => ((x.adjust = {}), (x.curve = null), (x.lutId = null), x)),
          },
          'Réinitialiser',
        ),
      );
    } else if (tab === 'curve') {
      if (!l || l.kind !== 'image') return needImage();
      body.append(section('Courbe de tonalité (RVB)', labelTag('Local'), curveEditor(l)), lutSection(l));
    } else if (tab === 'layer') {
      if (!l) return body.append(h('p', { class: 'field__hint' }, 'Aucun calque sélectionné.'));
      const blend = h(
        'select',
        { class: 'select select--sm' },
        [
          ['source-over', 'Normal'],
          ['multiply', 'Produit'],
          ['screen', 'Écran'],
          ['overlay', 'Incrustation'],
          ['soft-light', 'Lumière douce'],
          ['lighten', 'Éclaircir'],
          ['darken', 'Obscurcir'],
          ['difference', 'Différence'],
        ].map(([v, t]) => h('option', { value: v, selected: v === l.blend }, t)),
      );
      blend.addEventListener('change', () => editLayer('Fusion', (x) => ((x.blend = blend.value), x)));
      body.append(
        section(
          'Transformer',
          slider('Position X', l.x, -0.5, 1.5, 0.001, (v, c) => editLayer('Position', (x) => ((x.x = v), x), { commit: c })),
          slider('Position Y', l.y, -0.5, 1.5, 0.001, (v, c) => editLayer('Position', (x) => ((x.y = v), x), { commit: c })),
          slider('Échelle', l.scale, 0.05, 5, 0.01, (v, c) => editLayer('Échelle', (x) => ((x.scale = v), x), { commit: c })),
          slider('Rotation', l.rotation, -180, 180, 0.5, (v, c) => editLayer('Rotation', (x) => ((x.rotation = v), x), { commit: c })),
          slider('Opacité', l.opacity, 0, 1, 0.01, (v, c) => editLayer('Opacité', (x) => ((x.opacity = v), x), { commit: c })),
          h('div', { class: 'insp-row insp-row--select' }, h('label', {}, 'Fusion'), blend),
          h(
            'div',
            { class: 'insp-actions' },
            h(
              'button',
              { class: 'btn btn--sm', type: 'button', onclick: () => editLayer('Retourner', (x) => ((x.flipH = !x.flipH), x)) },
              '⇋ Horizontal',
            ),
            h(
              'button',
              { class: 'btn btn--sm', type: 'button', onclick: () => editLayer('Retourner', (x) => ((x.flipV = !x.flipV), x)) },
              '⇵ Vertical',
            ),
            h(
              'button',
              {
                class: 'btn btn--sm',
                type: 'button',
                onclick: () => editLayer('Rotation 90°', (x) => ((x.rotation = ((x.rotation || 0) + 90) % 360), x)),
              },
              '↻ 90°',
            ),
          ),
        ),
      );
      if (l.kind === 'image') {
        body.append(
          section(
            'Recadrer le calque',
            ...['x', 'y', 'w', 'h'].map((k) =>
              slider(
                { x: 'Gauche', y: 'Haut', w: 'Largeur', h: 'Hauteur' }[k],
                l.crop?.[k] ?? (k === 'w' || k === 'h' ? 1 : 0),
                k === 'w' || k === 'h' ? 0.05 : 0,
                k === 'w' || k === 'h' ? 1 : 0.95,
                0.005,
                (v, c) => editLayer('Recadrage', (x) => ((x.crop = { x: 0, y: 0, w: 1, h: 1, ...x.crop, [k]: v }), x), { commit: c }),
              ),
            ),
            h(
              'label',
              { class: 'insp-check' },
              h('input', {
                type: 'checkbox',
                checked: l.fit === 'cover',
                onchange: (e) => editLayer('Remplissage', (x) => ((x.fit = e.target.checked ? 'cover' : 'contain'), x)),
              }),
              'Remplir la toile',
            ),
            h('p', { class: 'field__hint' }, 'Correction de perspective : non disponible.'),
          ),
        );
      }
      if (l.kind === 'text') {
        const content = h('textarea', { class: 'textarea textarea--sm', rows: 3 });
        content.value = l.text.content;
        content.addEventListener('input', () => editLayer('Texte', (x) => ((x.text.content = content.value), x), { commit: false }));
        content.addEventListener('change', () => editLayer('Texte', (x) => ((x.text.content = content.value), x)));
        const color = h('input', { type: 'color', value: l.text.color });
        color.addEventListener('change', () => editLayer('Couleur', (x) => ((x.text.color = color.value), x)));
        body.append(
          section(
            'Texte',
            content,
            slider('Taille', l.text.size, 12, 400, 1, (v, c) => editLayer('Taille', (x) => ((x.text.size = v), x), { commit: c })),
            slider('Espacement', l.text.letterSpacing || 0, -10, 60, 1, (v, c) =>
              editLayer('Espacement', (x) => ((x.text.letterSpacing = v), x), { commit: c }),
            ),
            slider('Contour', l.text.strokeWidth || 0, 0, 30, 1, (v, c) =>
              editLayer('Contour', (x) => ((x.text.strokeWidth = v), x), { commit: c }),
            ),
            slider('Ombre', l.text.shadow || 0, 0, 1, 0.05, (v, c) => editLayer('Ombre', (x) => ((x.text.shadow = v), x), { commit: c })),
            h('div', { class: 'insp-row insp-row--color' }, h('label', {}, 'Couleur'), color),
            h(
              'label',
              { class: 'insp-check' },
              h('input', {
                type: 'checkbox',
                checked: Boolean(l.text.gradient),
                onchange: (e) => editLayer('Dégradé', (x) => ((x.text.gradient = e.target.checked ? ['#45E5F5', '#8B5CF6'] : null), x)),
              }),
              'Dégradé',
            ),
            h(
              'label',
              { class: 'insp-check' },
              h('input', {
                type: 'checkbox',
                checked: Boolean(l.text.background),
                onchange: (e) => editLayer('Fond', (x) => ((x.text.background = e.target.checked ? 'rgba(8,11,22,0.7)' : null), x)),
              }),
              'Fond',
            ),
          ),
        );
      }
    } else if (tab === 'canvas') {
      const bgType = h(
        'select',
        { class: 'select select--sm' },
        [
          ['color', 'Couleur'],
          ['gradient', 'Dégradé'],
          ['transparent', 'Transparent'],
        ].map(([v, t]) => h('option', { value: v, selected: store.project.background.type === v }, t)),
      );
      bgType.addEventListener('change', () =>
        editProject('Arrière-plan', { background: { ...store.project.background, type: bgType.value } }),
      );
      const c1 = h('input', { type: 'color', value: store.project.background.color || '#0b1030' });
      c1.addEventListener('change', () =>
        editProject('Couleur de fond', {
          background: {
            ...store.project.background,
            color: c1.value,
            colors: [c1.value, store.project.background.colors?.[1] || '#080B16'],
          },
        }),
      );
      const c2 = h('input', { type: 'color', value: store.project.background.colors?.[1] || '#080B16' });
      c2.addEventListener('change', () =>
        editProject('Dégradé', {
          background: { ...store.project.background, colors: [store.project.background.colors?.[0] || c1.value, c2.value] },
        }),
      );
      const w = h('input', {
        class: 'input input--sm',
        type: 'number',
        min: 16,
        max: 8192,
        value: String(store.project.settings.width),
        'aria-label': 'Largeur',
      });
      const hh = h('input', {
        class: 'input input--sm',
        type: 'number',
        min: 16,
        max: 8192,
        value: String(store.project.settings.height),
        'aria-label': 'Hauteur',
      });
      const apply = () =>
        editProject('Taille de la toile', {
          settings: {
            ...store.project.settings,
            aspect: 'custom',
            width: Math.min(8192, Math.max(16, Number(w.value))),
            height: Math.min(8192, Math.max(16, Number(hh.value))),
          },
        });
      w.addEventListener('change', apply);
      hh.addEventListener('change', apply);
      body.append(
        section(
          'Taille de la toile',
          h('div', { class: 'grid-2' }, w, hh),
          h(
            'div',
            { class: 'chips' },
            SOCIAL_SIZES.map(([label, sw, sh]) =>
              h(
                'button',
                {
                  class: 'btn btn--sm',
                  type: 'button',
                  onclick: () =>
                    editProject(`Format ${label}`, { settings: { ...store.project.settings, aspect: 'custom', width: sw, height: sh } }),
                },
                `${label} ${sw}×${sh}`,
              ),
            ),
          ),
        ),
        section(
          'Arrière-plan',
          h('div', { class: 'insp-row insp-row--select' }, h('label', {}, 'Type'), bgType),
          h('div', { class: 'insp-row insp-row--color' }, h('label', {}, 'Couleur 1'), c1),
          h('div', { class: 'insp-row insp-row--color' }, h('label', {}, 'Couleur 2'), c2),
        ),
        section(
          'Collage rapide',
          h('p', { class: 'field__hint' }, 'Répartit les calques image en grille.'),
          h(
            'div',
            { class: 'chips' },
            [2, 3, 4].map((cols) =>
              h('button', { class: 'btn btn--sm', type: 'button', onclick: () => collage(cols) }, `Grille ${cols} colonnes`),
            ),
          ),
        ),
      );
    } else if (tab === 'ai') {
      body.append(aiSection());
    }
  };

  function collage(cols) {
    const images = store.project.layers.filter((l) => l.kind === 'image');
    if (images.length < 2) return say('Ajoutez au moins deux images.');
    const rows = Math.ceil(images.length / cols);
    const layers = store.project.layers.map((l) => {
      const i = images.indexOf(l);
      if (i === -1) return l;
      return {
        ...l,
        fit: 'cover',
        x: ((i % cols) + 0.5) / cols,
        y: (Math.floor(i / cols) + 0.5) / rows,
        scale: 1 / Math.max(cols, rows),
        rotation: 0,
      };
    });
    store.commit(`Collage ${cols} colonnes`, { ...store.project, layers });
  }

  function curveEditor(l) {
    const size = 220;
    const c = h('canvas', { class: 'curve', width: size, height: size, 'aria-label': 'Courbe de tonalité : faites glisser les points' });
    let points = l.curve
      ? l.curve.map((p) => [...p])
      : [
          [0, 0],
          [0.25, 0.25],
          [0.5, 0.5],
          [0.75, 0.75],
          [1, 1],
        ];
    const draw = () => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, size, size);
      g.strokeStyle = 'rgba(130,148,255,0.2)';
      for (let i = 1; i < 4; i += 1) {
        g.beginPath();
        g.moveTo((i * size) / 4, 0);
        g.lineTo((i * size) / 4, size);
        g.moveTo(0, (i * size) / 4);
        g.lineTo(size, (i * size) / 4);
        g.stroke();
      }
      g.strokeStyle = '#45E5F5';
      g.lineWidth = 2;
      g.beginPath();
      points.forEach(([x, y], i) => (i ? g.lineTo(x * size, size - y * size) : g.moveTo(x * size, size - y * size)));
      g.stroke();
      g.fillStyle = '#F5F7FF';
      points.forEach(([x, y]) => g.fillRect(x * size - 4, size - y * size - 4, 8, 8));
    };
    c.addEventListener('pointerdown', (event) => {
      const rect = c.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const index = points.reduce((best, p, i) => (Math.abs(p[0] - px) < Math.abs(points[best][0] - px) ? i : best), 0);
      c.setPointerCapture(event.pointerId);
      const moveP = (e) => {
        const y = 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
        points[index][1] = y;
        draw();
        editLayer('Courbe', (x) => ((x.curve = points.map((p) => [...p])), x), { commit: false });
      };
      const up = () => {
        c.removeEventListener('pointermove', moveP);
        c.removeEventListener('pointerup', up);
        editLayer('Courbe', (x) => ((x.curve = points.map((p) => [...p])), x));
      };
      moveP(event);
      c.addEventListener('pointermove', moveP);
      c.addEventListener('pointerup', up);
    });
    draw();
    return h(
      'div',
      {},
      c,
      h(
        'button',
        {
          class: 'btn btn--sm',
          type: 'button',
          onclick: () => (
            (points = [
              [0, 0],
              [0.25, 0.25],
              [0.5, 0.5],
              [0.75, 0.75],
              [1, 1],
            ]),
            draw(),
            editLayer('Courbe neutre', (x) => ((x.curve = null), x))
          ),
        },
        'Réinitialiser la courbe',
      ),
    );
  }

  function lutSection(l) {
    const input = h('input', { type: 'file', accept: '.cube', hidden: true });
    input.addEventListener('change', async () => {
      try {
        const lut = parseCube(await input.files[0].text());
        const lutId = uid('lut');
        await db.set(`lut:${lutId}`, lut);
        renderer.luts.set(lutId, lut);
        editLayer('Appliquer une LUT', (x) => ((x.lutId = lutId), (x.lutName = input.files[0].name), x));
      } catch (error) {
        say(error.message, 'error');
      }
    });
    return section(
      'LUT 3D (.cube)',
      labelTag('Local'),
      l.lutId ? h('p', {}, `LUT appliquée : ${l.lutName || 'personnalisée'}`) : h('p', { class: 'field__hint' }, 'Aucune LUT.'),
      h(
        'div',
        { class: 'insp-actions' },
        h('label', { class: 'btn btn--sm' }, 'Importer une LUT', input),
        l.lutId
          ? h(
              'button',
              { class: 'btn btn--sm', type: 'button', onclick: () => editLayer('Retirer la LUT', (x) => ((x.lutId = null), x)) },
              'Retirer',
            )
          : null,
      ),
    );
  }

  // ---------------------------------------------------------------- AI tools
  async function flatten(maxEdge = 2048) {
    const { width, height } = store.project.settings;
    const s = Math.min(1, maxEdge / Math.max(width, height));
    const c = document.createElement('canvas');
    c.width = Math.round(width * s);
    c.height = Math.round(height * s);
    await renderer.render(c.getContext('2d'), store.project);
    return c;
  }

  async function runAi(operation, prompt, { mask = null, extend = 0 } = {}) {
    let image = await flatten();
    let maskCanvas = mask;
    if (extend) {
      const pad = Math.round(Math.max(image.width, image.height) * extend);
      const big = document.createElement('canvas');
      big.width = image.width + pad * 2;
      big.height = image.height + pad * 2;
      big.getContext('2d').drawImage(image, pad, pad);
      maskCanvas = document.createElement('canvas');
      maskCanvas.width = big.width;
      maskCanvas.height = big.height;
      const m = maskCanvas.getContext('2d');
      m.fillStyle = '#000';
      m.fillRect(pad, pad, image.width, image.height); // opaque = keep, transparent border = generate
      image = big;
    }
    const upload = await api.upload(await canvasToBlob(image));
    const payload = { operation, prompt, uploadId: upload.id, provider: imageProvider.id };
    if (maskCanvas) payload.maskUploadId = (await api.upload(await new Promise((r) => maskCanvas.toBlob(r, 'image/png')))).id;
    const { creation } = await api.editImage(payload);
    say('Traitement envoyé au fournisseur IA…');
    const final = await watchCreation(creation.id, { onUpdate: () => {} });
    if (final.status !== 'succeeded') throw new Error(final.error || 'Échec du traitement IA.');
    const blob = await (await fetch(final.outputs[0].url)).blob();
    const meta = await importFile(new File([blob], `ia-${final.id}.png`, { type: blob.type || 'image/png' }), {
      name: `IA — ${final.operationLabel}`,
      origin: 'solvex-ai',
    });
    const layer = newLayer('image', { mediaId: meta.id, name: `IA — ${final.operationLabel}` });
    let next = { ...store.project, layers: [...store.project.layers.map((x) => ({ ...x, hidden: true })), layer] };
    if (extend) next = { ...next, settings: { ...next.settings, aspect: 'custom', width: meta.width, height: meta.height } };
    store.commit(`IA : ${final.operationLabel}`, next, { select: [layer.id] });
    say('Résultat ajouté comme nouveau calque (les calques précédents sont masqués, pas supprimés).', 'success');
  }

  function aiSection() {
    const wrap = h('div');
    if (!aiReady) {
      wrap.append(
        h(
          'div',
          { class: 'notice' },
          h(
            'p',
            {},
            isStatic()
              ? 'Version publique sans serveur : les fonctions IA nécessitent le serveur SOLVEX.'
              : 'Aucun fournisseur d’images configuré (OPENAI_API_KEY).',
          ),
        ),
      );
    }
    const prompt = h('textarea', {
      class: 'textarea textarea--sm',
      rows: 2,
      placeholder: 'Instruction (ex. : style aquarelle, remplace le ciel par un coucher de soleil)',
    });
    const tool = (label, kind, desc, fn) => {
      const b = h(
        'button',
        { class: 'tool', type: 'button', disabled: kind !== 'Local' && !aiReady },
        h('span', {}, h('strong', {}, label, ' ', labelTag(kind)), h('small', {}, desc)),
      );
      b.addEventListener('click', async () => {
        setBusy(b, true);
        try {
          await fn();
        } catch (error) {
          say(error.message, 'error');
        } finally {
          setBusy(b, false);
        }
      });
      return b;
    };
    const maskBtn = h(
      'button',
      { class: 'btn btn--sm', type: 'button', disabled: !aiReady },
      icon('brush'),
      painter ? 'Terminer le masque' : 'Peindre la zone à modifier',
    );
    maskBtn.addEventListener('click', () => {
      if (painter) {
        painter.canvas.remove();
        painter = null;
      } else {
        painter = createMaskPainter(canvas.width, canvas.height);
        stageBox.append(painter.canvas);
        fit();
      }
      renderProps();
    });
    const maskCanvasFor = async () => {
      if (!painter?.hasMask()) return null;
      const img = await flatten();
      const blob = await painter.toBlob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return c;
    };
    wrap.append(
      section(
        'Instruction',
        prompt,
        h(
          'div',
          { class: 'insp-actions' },
          maskBtn,
          painter ? h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => painter.clear() }, 'Effacer') : null,
        ),
      ),
      section(
        'Outils',
        h(
          'div',
          { class: 'tool-list' },
          tool('Modifier par instruction', 'IA distante', 'Avec ou sans zone peinte.', async () =>
            runAi('edit', need(prompt), { mask: await maskCanvasFor() }),
          ),
          tool('Supprimer un objet', 'IA distante', 'Peignez l’objet puis lancez.', async () => {
            const mask = await maskCanvasFor();
            if (!mask) throw new Error('Peignez d’abord l’objet à supprimer.');
            await runAi(
              'objects',
              prompt.value.trim() || 'Supprime l’objet dans la zone peinte et reconstruis le fond de façon naturelle.',
              { mask },
            );
          }),
          tool('Remplacer l’arrière-plan', 'IA distante', 'Décrivez le nouveau décor.', () => runAi('background', need(prompt))),
          tool('Fond uni (détourage)', 'IA distante', 'Sujet conservé sur fond blanc.', () =>
            runAi('background', 'un fond blanc uni de studio'),
          ),
          tool('Étendre l’image', 'IA distante', 'Agrandit la toile de 20 % de chaque côté et complète la scène.', () =>
            runAi('edit', prompt.value.trim() || 'Prolonge la scène de façon naturelle dans les zones vides, en cohérence avec l’image.', {
              extend: 0.2,
            }),
          ),
          tool('Transformer le style', 'IA distante', 'Ex. : « style bande dessinée ».', () =>
            runAi('edit', `Transforme cette image en ${need(prompt)}, en gardant la composition.`),
          ),
          tool('Coloriser', 'Expérimental', 'Pour une photo noir et blanc.', () =>
            runAi('edit', 'Colorise cette photographie noir et blanc avec des couleurs naturelles et réalistes.'),
          ),
          tool('Variante', 'IA distante', 'Nouvelle version proche.', () => runAi('variation', prompt.value.trim())),
          tool('Agrandissement ×2', 'Local', 'Interpolation de qualité (pas de super-résolution IA).', async () => {
            editProject('Agrandir ×2', {
              settings: {
                ...store.project.settings,
                width: Math.min(8192, store.project.settings.width * 2),
                height: Math.min(8192, store.project.settings.height * 2),
              },
            });
          }),
        ),
      ),
    );
    return wrap;
  }
  const need = (input) => {
    const v = input.value.trim();
    if (!v) {
      input.focus();
      throw new Error('Écrivez d’abord une instruction.');
    }
    return v;
  };

  // ---------------------------------------------------------------- export
  function openExport() {
    const formats = [
      ['image/png', 'PNG (sans perte)'],
      ['image/jpeg', 'JPEG'],
      ['image/webp', 'WebP'],
    ].filter(([type]) => document.createElement('canvas').toDataURL(type).startsWith(`data:${type}`));
    const name = h('input', { class: 'input', value: store.project.name });
    const format = h(
      'select',
      { class: 'select' },
      formats.map(([v, l]) => h('option', { value: v }, l)),
    );
    const quality = h('input', { type: 'range', min: 0.5, max: 1, step: 0.01, value: '0.92' });
    const scale = h(
      'select',
      { class: 'select' },
      [1, 0.75, 0.5, 0.25, 2].map((s) =>
        h(
          'option',
          { value: String(s) },
          `${Math.round(store.project.settings.width * s)} × ${Math.round(store.project.settings.height * s)}${s === 1 ? ' (taille réelle)' : ''}`,
        ),
      ),
    );
    const go = h('button', { class: 'btn btn--primary', type: 'button' }, icon('download'), 'Exporter');
    const out = h('p', { class: 'field__hint', 'aria-live': 'polite' });
    go.addEventListener('click', async () => {
      setBusy(go, true);
      try {
        const s = Number(scale.value);
        const c = document.createElement('canvas');
        c.width = Math.min(8192, Math.round(store.project.settings.width * s));
        c.height = Math.min(8192, Math.round(store.project.settings.height * s));
        renderer.cache.clear(); // render export at full resolution
        await renderer.render(c.getContext('2d'), store.project);
        const blob = await new Promise((r) => c.toBlob(r, format.value, Number(quality.value)));
        const ext = format.value.split('/')[1].replace('jpeg', 'jpg');
        const saved = await saveFile(blob, `${name.value || 'solvex'}.${ext}`);
        out.textContent = saved ? '' : 'Téléchargement annulé.';
        if (!saved) return;
        out.textContent = `Exporté : ${c.width} × ${c.height}, ${Math.round(blob.size / 1024)} Ko.`;
      } catch (error) {
        out.textContent = `Échec : ${error.message}`;
      } finally {
        setBusy(go, false);
        render();
      }
    });
    openModal(
      h(
        'div',
        { class: 'dialog__body' },
        h('h2', {}, 'Exporter l’image'),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Nom du fichier'), name),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Format'), format),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Qualité (JPEG/WebP)'), quality),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Taille'), scale),
        h('div', { class: 'dialog__actions', style: { padding: '16px 0 0' } }, go),
        out,
      ),
      { label: 'Exporter l’image' },
    );
  }

  // ---------------------------------------------------------------- toolbar & wiring
  const nameInput = h('input', { class: 'editor-name', value: store.project.name, 'aria-label': 'Nom du projet' });
  nameInput.addEventListener('change', () => store.commit('Renommer', { ...store.project, name: nameInput.value.trim() || 'Image' }));
  const saveState = h('span', { class: 'save-state', 'aria-live': 'polite' });
  const compareBtn = h(
    'button',
    { class: 'btn btn--sm btn--ghost editor-compare', type: 'button', title: 'Maintenir pour voir l’original' },
    'Avant / après',
  );
  compareBtn.addEventListener('pointerdown', () => ((compare = true), render()));
  for (const t of ['pointerup', 'pointerleave']) compareBtn.addEventListener(t, () => compare && ((compare = false), render()));
  const undo = h(
    'button',
    { class: 'btn btn--sm btn--ghost btn--icon', type: 'button', 'aria-label': 'Annuler', onclick: () => store.undo() },
    icon('undo'),
  );
  const redo = h(
    'button',
    { class: 'btn btn--sm btn--ghost btn--icon', type: 'button', 'aria-label': 'Rétablir', onclick: () => store.redo() },
    h('span', { style: { transform: 'scaleX(-1)', display: 'inline-flex' } }, icon('undo')),
  );
  const thumbnail = () => {
    const t = document.createElement('canvas');
    t.width = 320;
    t.height = Math.round((320 * canvas.height) / Math.max(1, canvas.width));
    t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL('image/jpeg', 0.7);
  };
  store.thumbnailProvider = thumbnail;
  // Top-bar categories open the matching panel (bottom sheets on phones).
  const cats = h('nav', { class: 'editor-cats', 'aria-label': 'Catégories' });
  drawCats = () => {
    const sheet = root?.dataset.sheet;
    cats.replaceChildren(
      ...[['layers-panel', 'Calques', 'gallery'], ...PHOTO_TABS].map(([id, label, ic]) => {
        const active = id === 'layers-panel' ? (isMobile() ? sheet === 'library' : root?.dataset.panel !== 'hidden') : tab === id && (!isMobile() || sheet === 'inspector');
        const b = h('button', { type: 'button', 'aria-pressed': String(active), title: label }, icon(ic, { size: 18 }), h('span', {}, label));
        b.addEventListener('click', () => {
          if (id === 'layers-panel') {
            if (isMobile()) return setSheet(sheet === 'library' ? '' : 'library');
            root.dataset.panel = root.dataset.panel === 'hidden' ? '' : 'hidden';
            return drawCats();
          }
          tab = id;
          renderProps();
          if (isMobile()) setSheet(sheet === 'inspector' && active ? '' : 'inspector');
        });
        return b;
      }),
    );
  };
  const bar = h(
    'header',
    { class: 'editor-bar' },
    h('a', { class: 'editor-logo', href: '/', 'data-link': '', 'aria-label': 'SOLVEX AI, accueil' }, logoMark({ title: '' })),
    h('a', { class: 'btn btn--sm btn--ghost', href: '/projets', 'data-link': '', 'aria-label': 'Retour aux projets' }, '←'),
    nameInput,
    saveState,
    cats,
    undo,
    redo,
    compareBtn,
    h(
      'button',
      { class: 'btn btn--sm editor-save', type: 'button', onclick: () => store.save(thumbnail()).then(() => say('Image enregistrée.', 'success')) },
      'Enregistrer',
    ),
    h('button', { class: 'btn btn--sm btn--primary', type: 'button', onclick: openExport }, icon('download'), h('span', {}, 'Exporter')),
  );
  const updateBar = () => {
    undo.disabled = !store.history.canUndo;
    redo.disabled = !store.history.canRedo;
    saveState.textContent = store.saving ? 'Enregistrement…' : store.project.saved ? '✓ Enregistré' : '● Modifié';
  };
  const unsub = store.on((reason) => {
    updateBar();
    if (reason === 'saving' || reason === 'saved' || reason === 'history') return;
    render();
    if (reason !== 'preview') {
      renderLayers();
      renderProps();
    }
  });
  const onKey = (event) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || document.querySelector('dialog[open]')) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.key.toLowerCase() === 'z') (event.preventDefault(), event.shiftKey ? store.redo() : store.undo());
    else if (ctrl && event.key.toLowerCase() === 'y') (event.preventDefault(), store.redo());
    else if (ctrl && event.key.toLowerCase() === 's') (event.preventDefault(), store.save(thumbnail()));
    else if (event.key === 'Delete' && selected())
      store.commit(
        'Supprimer le calque',
        { ...store.project, layers: store.project.layers.filter((x) => x.id !== selected().id) },
        { select: [] },
      );
  };
  window.addEventListener('keydown', onKey);
  const resize = new ResizeObserver(fit);
  requestAnimationFrame(() => resize.observe(stageBox));
  renderLayers();
  renderProps();
  updateBar();
  render();

  const mobileNav = h('div', { class: 'editor-mobile-nav' });
  root = h(
    'div',
    { class: 'editor editor--photo', dataset: { sheet: '' } },
    h('h1', { class: 'sr-only' }, `Éditeur photo — ${store.project.name}`),
    bar,
    h('div', { class: 'editor-main' }, layersPanel, h('section', { class: 'preview', 'aria-label': 'Image' }, stageBox), props),
    mobileNav,
  );
  const mq = window.matchMedia('(max-width: 900px)');
  const placeCats = () => {
    if (mq.matches) mobileNav.append(cats);
    else bar.insertBefore(cats, undo);
    drawCats();
  };
  mq.addEventListener('change', placeCats);
  placeCats();
  return {
    el: root,
    title: store.project.name,
    fullscreen: true,
    cleanup: () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', placeCats);
      resize.disconnect();
      unsub();
      if (!store.project.saved) store.save(thumbnail());
    },
  };
}
