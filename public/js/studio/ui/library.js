import { h, clear, formatBytes } from '../../lib/dom.js';
import { icon } from '../../components/icons.js';
import { confirmDialog } from '../../components/feedback.js';
import { db } from '../db.js';
import { ACCEPT_ATTR, importFiles, importFile, deleteMedia, formatTime } from '../media.js';
import { queryStickers, STICKER_CATEGORIES, SHAPES, stickerCount } from '../stickers.js';
import { SOUNDS, SOUND_CATEGORIES, SOUND_LICENSE, renderSound } from '../sounds.js';
import { api } from '../../lib/api.js';
import { isStatic } from '../../lib/env.js';

export const TEXT_PRESETS = [
  { id: 'title', label: 'Titre', text: { content: 'Votre titre', size: 110, weight: 800, animIn: 'zoom', animOut: 'fade' } },
  {
    id: 'subtitle',
    label: 'Sous-titre',
    text: { content: 'Un sous-titre élégant', size: 56, weight: 500, animIn: 'slide-up', animOut: 'fade' },
    transform: { y: 0.62 },
  },
  {
    id: 'caption',
    label: 'Légende',
    text: { content: 'Légende', size: 42, weight: 600, background: 'rgba(8,11,22,0.7)', animIn: 'fade', animOut: 'fade' },
    transform: { y: 0.86 },
  },
  {
    id: 'neon',
    label: 'Titre néon',
    text: {
      content: 'SOLVEX',
      size: 140,
      weight: 900,
      gradient: ['#45E5F5', '#8B5CF6'],
      letterSpacing: 12,
      shadow: 0.8,
      animIn: 'blur',
      animOut: 'blur',
      loop: 'pulse',
    },
  },
  {
    id: 'typewriter',
    label: 'Machine à écrire',
    text: {
      content: 'Il était une fois…',
      font: '"Courier New", ui-monospace, monospace',
      size: 64,
      weight: 600,
      animIn: 'typewriter',
      animOut: 'fade',
      animDuration: 1.5,
    },
  },
  {
    id: 'lower',
    label: 'Bandeau nom',
    text: {
      content: 'Prénom Nom\nFonction',
      size: 44,
      weight: 700,
      align: 'left',
      background: 'rgba(66,99,255,0.85)',
      animIn: 'slide-left',
      animOut: 'fade',
    },
    transform: { x: 0.28, y: 0.82 },
  },
  {
    id: 'credits',
    label: 'Générique',
    text: {
      content: 'Réalisation\nVotre nom\n\nMusique\nSOLVEX AI',
      size: 52,
      weight: 500,
      lineHeight: 1.4,
      animIn: 'fade',
      animOut: 'fade',
    },
  },
  {
    id: 'wave',
    label: 'Texte en vague',
    text: { content: 'Bonne vibe', size: 96, weight: 800, color: '#45E5F5', loop: 'wave', animIn: 'pop' },
  },
];

/**
 * Left panel: media bin, text presets, stickers, shapes, sounds and AI imports.
 * Items are draggable onto the timeline, or added at the playhead with +.
 */
export class Library {
  constructor({ onAdd, onMediaChange, toast }) {
    this.onAdd = onAdd;
    this.onMediaChange = onMediaChange;
    this.toast = toast;
    this.tab = 'media';
    this.media = [];
    this.stickerState = { category: '', search: '', page: 0 };
    this.soundCategory = SOUND_CATEGORIES[0];
    this.favorites = new Set();
    this.el = h('aside', { class: 'library', 'aria-label': 'Bibliothèque' });
    db.get('stickerFavorites')
      .then((list) => (this.favorites = new Set(list || [])))
      .catch(() => {});
    this.render();
    this.reloadMedia();
  }

  async reloadMedia() {
    try {
      this.media = await db.listMedia();
    } catch (error) {
      this.toast(error.message, 'error');
      this.media = [];
    }
    this.onMediaChange?.(this.media);
    if (this.tab === 'media') this.render();
  }

  drag(el, payload) {
    el.draggable = true;
    el.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('application/x-solvex', JSON.stringify(payload));
      event.dataTransfer.effectAllowed = 'copy';
    });
    return el;
  }

  render() {
    clear(this.el);
    const tabs = [
      ['media', 'Médias', 'gallery'],
      ['text', 'Texte', 'info'],
      ['stickers', 'Stickers', 'sparkles'],
      ['shapes', 'Formes', 'layers'],
      ['sounds', 'Sons', 'play'],
      ['ai', 'IA', 'wand'],
    ];
    const bar = h('div', { class: 'lib-tabs', role: 'tablist', 'aria-label': 'Catégories de la bibliothèque' });
    for (const [id, label, ic] of tabs) {
      const b = h(
        'button',
        { type: 'button', role: 'tab', 'aria-selected': String(this.tab === id), title: label },
        icon(ic),
        h('span', {}, label),
      );
      b.addEventListener('click', () => {
        this.tab = id;
        this.render();
      });
      bar.append(b);
    }
    const body = h('div', { class: 'lib-body' });
    this.el.append(bar, body);
    ({
      media: () => this.renderMedia(body),
      text: () => this.renderText(body),
      stickers: () => this.renderStickers(body),
      shapes: () => this.renderShapes(body),
      sounds: () => this.renderSounds(body),
      ai: () => this.renderAi(body),
    })[this.tab]();
  }

  renderMedia(body) {
    const input = h('input', { type: 'file', multiple: true, accept: ACCEPT_ATTR, hidden: true });
    const status = h('p', { class: 'field__hint', 'aria-live': 'polite' });
    input.addEventListener('change', () => this.importList([...input.files], status));
    const drop = h(
      'label',
      { class: 'dropzone dropzone--sm' },
      icon('upload'),
      h('span', {}, h('strong', {}, 'Importer'), ' vidéos, images, audio'),
      input,
    );
    drop.addEventListener('dragover', (e) => (e.preventDefault(), drop.classList.add('is-over')));
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
      this.importList([...(e.dataTransfer?.files || [])], status);
    });
    const filter = h('input', {
      class: 'input input--sm',
      type: 'search',
      placeholder: 'Rechercher un média',
      'aria-label': 'Rechercher un média',
    });
    const grid = h('div', { class: 'lib-grid' });
    const draw = () => {
      clear(grid);
      const q = filter.value.trim().toLowerCase();
      const list = this.media.filter((m) => !q || m.name.toLowerCase().includes(q) || m.kind.includes(q));
      if (!list.length)
        grid.append(
          h(
            'p',
            { class: 'field__hint' },
            this.media.length ? 'Aucun résultat.' : 'Importez vos fichiers : ils restent stockés dans ce navigateur.',
          ),
        );
      for (const m of list) {
        const add = h(
          'button',
          { class: 'lib-add', type: 'button', 'aria-label': `Ajouter ${m.name} au curseur`, title: 'Ajouter au curseur' },
          '+',
        );
        add.addEventListener('click', () => this.onAdd({ type: 'media', id: m.id }));
        const del = h(
          'button',
          {
            class: 'lib-del',
            type: 'button',
            'aria-label': `Supprimer ${m.name} de la bibliothèque`,
            title: 'Supprimer de la bibliothèque',
          },
          '✕',
        );
        del.addEventListener('click', async () => {
          if (
            !(await confirmDialog({
              title: 'Supprimer ce média ?',
              message: `« ${m.name} » sera supprimé de la bibliothèque. Les clips qui l’utilisent deviendront vides.`,
              confirmLabel: 'Supprimer',
              danger: true,
            }))
          )
            return;
          await deleteMedia(m.id);
          this.reloadMedia();
        });
        const fav = h(
          'button',
          {
            class: `lib-fav${m.favorite ? ' is-on' : ''}`,
            type: 'button',
            'aria-label': 'Favori',
            'aria-pressed': String(Boolean(m.favorite)),
          },
          '★',
        );
        fav.addEventListener('click', async () => {
          m.favorite = !m.favorite;
          await db.updateMedia(m);
          draw();
        });
        grid.append(
          this.drag(
            h(
              'div',
              { class: `lib-item lib-item--${m.kind}`, title: m.name },
              m.thumb
                ? h('img', { src: m.thumb, alt: '', loading: 'lazy' })
                : h('div', { class: 'lib-ph' }, icon(m.kind === 'audio' ? 'play' : 'image')),
              h('span', { class: 'lib-name' }, m.name),
              h(
                'span',
                { class: 'lib-meta' },
                [
                  m.kind === 'video' ? 'Vidéo' : m.kind === 'image' ? 'Image' : 'Audio',
                  m.duration ? formatTime(m.duration) : '',
                  formatBytes(m.size),
                ]
                  .filter(Boolean)
                  .join(' · '),
              ),
              fav,
              add,
              del,
            ),
            { type: 'media', id: m.id },
          ),
        );
      }
    };
    filter.addEventListener('input', draw);
    draw();
    body.append(drop, status, filter, grid);
  }

  async importList(files, status) {
    if (!files.length) return;
    const { results, errors } = await importFiles(files, (i, n, name) => (status.textContent = `Import ${i}/${n} : ${name}…`));
    status.textContent = results.length ? `${results.length} fichier(s) importé(s).` : '';
    errors.forEach((e) => this.toast(e, 'error'));
    await this.reloadMedia();
  }

  renderText(body) {
    const grid = h('div', { class: 'lib-cards' });
    for (const preset of TEXT_PRESETS) {
      const card = h(
        'button',
        { class: 'lib-card', type: 'button', title: 'Cliquer pour ajouter au curseur, ou glisser dans la timeline' },
        h(
          'span',
          {
            class: 'lib-card-preview',
            style: {
              fontWeight: preset.text.weight,
              background: preset.text.gradient ? 'linear-gradient(90deg,#45E5F5,#8B5CF6)' : null,
              WebkitBackgroundClip: preset.text.gradient ? 'text' : null,
              color: preset.text.gradient ? 'transparent' : null,
            },
          },
          preset.text.content.split('\n')[0],
        ),
        h('span', {}, preset.label),
      );
      card.addEventListener('click', () => this.onAdd({ type: 'text', preset: preset.id }));
      grid.append(this.drag(card, { type: 'text', preset: preset.id }));
    }
    body.append(h('p', { class: 'field__hint' }, 'Glissez un style sur une piste texte ou cliquez pour l’ajouter au curseur.'), grid);
  }

  renderStickers(body) {
    const st = this.stickerState;
    const search = h('input', {
      class: 'input input--sm',
      type: 'search',
      placeholder: 'Rechercher (ex. : cœur, jeu, flèche)',
      value: st.search,
      'aria-label': 'Rechercher un sticker',
    });
    const cats = h('div', { class: 'chips chips--scroll' });
    for (const [id, label] of [['', 'Tout'], ['favorites', '★ Favoris'], ...STICKER_CATEGORIES.map((c) => [c.id, c.label])]) {
      const b = h('button', { type: 'button', class: `btn btn--sm${st.category === id ? ' btn--primary' : ''}` }, label);
      b.addEventListener('click', () => {
        st.category = id;
        st.page = 0;
        this.render();
      });
      cats.append(b);
    }
    const grid = h('div', { class: 'sticker-grid' });
    const more = h('button', { class: 'btn btn--sm btn--block', type: 'button' }, 'Charger plus');
    const info = h('p', { class: 'field__hint' });
    const load = (reset) => {
      if (reset) {
        st.page = 0;
        clear(grid);
      }
      const { items, total, hasMore } = queryStickers({ ...st, favorites: this.favorites });
      info.textContent = `${total} sticker(s) dans cette sélection · ${stickerCount()} au catalogue (émojis Unicode affichés avec la police de votre appareil).`;
      for (const item of items) {
        const b = h(
          'button',
          {
            class: `sticker${this.favorites.has(item.id) ? ' is-fav' : ''}`,
            type: 'button',
            title: `${item.categoryLabel} — clic : ajouter, clic droit : favori`,
            'aria-label': `Sticker ${item.emoji}`,
          },
          item.emoji,
        );
        b.addEventListener('click', () => this.onAdd({ type: 'sticker', emoji: item.emoji }));
        b.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          if (this.favorites.has(item.id)) this.favorites.delete(item.id);
          else this.favorites.add(item.id);
          b.classList.toggle('is-fav');
          db.set('stickerFavorites', [...this.favorites]).catch(() => {});
        });
        grid.append(this.drag(b, { type: 'sticker', emoji: item.emoji }));
      }
      more.hidden = !hasMore;
    };
    more.addEventListener('click', () => {
      st.page += 1;
      load(false);
    });
    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        st.search = search.value;
        load(true);
      }, 200);
    });
    body.append(search, cats, info, grid, more);
    load(true);
  }

  renderShapes(body) {
    const grid = h('div', { class: 'lib-cards' });
    for (const shape of SHAPES) {
      const card = h(
        'button',
        { class: 'lib-card', type: 'button' },
        h('span', {
          class: `shape-preview shape-preview--${shape.shape.shape}`,
          style: {
            background: shape.shape.fill === 'transparent' ? 'transparent' : shape.shape.fill,
            borderColor: shape.shape.stroke || 'transparent',
          },
        }),
        h('span', {}, shape.label),
      );
      card.addEventListener('click', () => this.onAdd({ type: 'shape', id: shape.id }));
      grid.append(this.drag(card, { type: 'shape', id: shape.id }));
    }
    body.append(grid);
  }

  renderSounds(body) {
    const cats = h('div', { class: 'chips chips--scroll' });
    for (const cat of SOUND_CATEGORIES) {
      const b = h('button', { type: 'button', class: `btn btn--sm${this.soundCategory === cat ? ' btn--primary' : ''}` }, cat);
      b.addEventListener('click', () => {
        this.soundCategory = cat;
        this.render();
      });
      cats.append(b);
    }
    const list = h('div', { class: 'sound-list' });
    let current = null;
    for (const sound of SOUNDS.filter((s) => s.category === this.soundCategory)) {
      const play = h('button', { class: 'btn btn--sm btn--icon', type: 'button', 'aria-label': `Écouter ${sound.name}` }, icon('play'));
      play.addEventListener('click', async () => {
        current?.pause();
        const blob = await renderSound(sound.id);
        current = new Audio(URL.createObjectURL(blob));
        current.play();
      });
      const add = h('button', { class: 'btn btn--sm', type: 'button' }, '+ Ajouter');
      add.addEventListener('click', async () => {
        add.disabled = true;
        try {
          const blob = await renderSound(sound.id);
          const file = new File([blob], `${sound.name}.wav`, { type: 'audio/wav' });
          const meta = await importFile(file, { name: `${sound.name} (SOLVEX)`, origin: 'solvex-sound' });
          await this.reloadMedia();
          this.onAdd({ type: 'media', id: meta.id, role: /musique|ambiance/i.test(sound.category) ? 'music' : null });
        } catch (error) {
          this.toast(error.message, 'error');
        } finally {
          add.disabled = false;
        }
      });
      list.append(
        h(
          'div',
          { class: 'sound-item' },
          play,
          h(
            'div',
            {},
            h('strong', {}, sound.name),
            h('span', { class: 'field__hint' }, `${sound.duration} s${sound.loop ? ' · boucle' : ''}`),
          ),
          add,
        ),
      );
    }
    body.append(
      cats,
      list,
      h('p', { class: 'field__hint license' }, SOUND_LICENSE),
      h(
        'p',
        { class: 'field__hint' },
        'Bibliothèque musicale commerciale : non incluse. Importez vos propres musiques en vérifiant leurs droits.',
      ),
    );
  }

  async renderAi(body) {
    body.append(
      h('p', { class: 'field__hint' }, 'Générez dans les studios IA, puis importez le résultat ici.'),
      h(
        'div',
        { class: 'insp-actions' },
        h('a', { class: 'btn btn--sm', href: '/images', 'data-link': '' }, icon('image'), 'Studio d’images'),
        h('a', { class: 'btn btn--sm', href: '/videos', 'data-link': '' }, icon('video'), 'Studio vidéo'),
      ),
    );
    if (isStatic()) {
      body.append(h('p', { class: 'field__hint' }, 'Version publique sans serveur : la génération IA n’est pas disponible ici.'));
      return;
    }
    const list = h('div', { class: 'lib-grid' }, h('p', { class: 'field__hint' }, 'Chargement de la galerie…'));
    body.append(h('h4', {}, 'Créations de la galerie SOLVEX'), list);
    try {
      const { creations } = await api.creations();
      clear(list);
      const done = creations.filter((c) => c.status === 'succeeded' && c.outputs.length);
      if (!done.length) list.append(h('p', { class: 'field__hint' }, 'Aucune création pour le moment.'));
      for (const creation of done.slice(0, 40)) {
        const output = creation.outputs[0];
        const b = h(
          'button',
          { class: 'lib-item', type: 'button', title: creation.prompt || creation.operationLabel },
          creation.type === 'image'
            ? h('img', { src: output.url, alt: '', loading: 'lazy' })
            : h('div', { class: 'lib-ph' }, icon('video')),
          h('span', { class: 'lib-name' }, creation.prompt || creation.operationLabel),
        );
        b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            const blob = await (await fetch(output.url)).blob();
            const file = new File([blob], `solvex-${creation.id}.${output.mime.split('/')[1]}`, { type: output.mime });
            const meta = await importFile(file, { name: (creation.prompt || 'Création IA').slice(0, 60), origin: 'solvex-ai' });
            await this.reloadMedia();
            this.toast('Création importée dans la bibliothèque.', 'success');
            this.onAdd({ type: 'media', id: meta.id });
          } catch (error) {
            this.toast(error.message, 'error');
          } finally {
            b.disabled = false;
          }
        });
        list.append(b);
      }
    } catch (error) {
      clear(list).append(h('p', { class: 'field__hint' }, `Galerie indisponible : ${error.message}`));
    }
  }
}
