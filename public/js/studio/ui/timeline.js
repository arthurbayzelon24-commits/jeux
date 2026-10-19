import { h, clear } from '../../lib/dom.js';
import { icon } from '../../components/icons.js';
import {
  clipEnd,
  snapTime,
  expandGroups,
  trackKindFor,
  MIN_CLIP,
  sourceLimit,
  createTrack,
  splitAt,
  removeClips,
  duplicateClips,
  rippleDelete,
  groupClips,
  ungroupClips,
  projectDuration,
} from '../project.js';
import { formatTime } from '../media.js';
import { getPrefs } from '../../lib/prefs.js';
import { uid } from '../db.js';

const TRACK_H = { video: 62, audio: 54, text: 40 };
const HEADER_W = 168;

/**
 * Multi-track timeline (DOM). Clips are absolutely positioned; gestures update
 * the project through store.preview and commit once on release.
 */
export class Timeline {
  constructor({ store, player, mediaIndex, onDropMedia, onSeek, toast }) {
    this.store = store;
    this.player = player;
    this.mediaIndex = mediaIndex;
    this.onDropMedia = onDropMedia;
    this.onSeek = onSeek;
    this.toast = toast;
    this.zoom = 60; // px per second
    this.snapping = getPrefs().snapping;
    this.waveforms = new Map();

    this.zoomInput = h('input', { type: 'range', min: 8, max: 400, value: String(this.zoom), 'aria-label': 'Zoom de la timeline' });
    this.zoomInput.addEventListener('input', () => this.setZoom(Number(this.zoomInput.value)));
    this.snapBtn = h(
      'button',
      { class: 'tl-btn', type: 'button', 'aria-pressed': String(this.snapping), title: 'Aimantation (N)' },
      icon('focus'),
      h('span', {}, 'Aimant'),
    );
    this.snapBtn.addEventListener('click', () => {
      this.snapping = !this.snapping;
      this.snapBtn.setAttribute('aria-pressed', String(this.snapping));
    });

    const tool = (iconName, label, title, fn) => {
      const b = h(
        'button',
        { class: 'tl-btn', type: 'button', title, 'aria-label': title },
        icon(iconName),
        label ? h('span', {}, label) : null,
      );
      b.addEventListener('click', fn);
      return b;
    };
    this.toolbar = h(
      'div',
      { class: 'tl-toolbar', role: 'toolbar', 'aria-label': 'Outils de montage' },
      tool('layers', 'Diviser', 'Diviser au curseur (S)', () => this.split()),
      tool('trash', '', 'Supprimer (Suppr)', () => this.deleteSelection()),
      tool('focus', 'Couper', 'Supprimer la zone entre les points d’entrée et de sortie et resserrer', () => this.rippleInOut()),
      tool('gallery', '', 'Dupliquer (Ctrl+D)', () => this.duplicate()),
      tool('shuffle', 'Grouper', 'Grouper / dégrouper (Ctrl+G)', () => this.toggleGroup()),
      tool('info', 'Marqueur', 'Ajouter un marqueur (M)', () => this.addMarker()),
      tool('arrow', 'Entrée', 'Point d’entrée (I)', () => this.setInOut('in')),
      tool('arrow', 'Sortie', 'Point de sortie (O)', () => this.setInOut('out')),
      this.snapBtn,
      h('span', { class: 'tl-spacer' }),
      tool('video', 'Piste', 'Ajouter une piste vidéo', () => this.addTrack('video')),
      tool('play', 'Piste', 'Ajouter une piste audio', () => this.addTrack('audio')),
      tool('expand', 'Ajuster', 'Afficher tout le montage', () => this.fit()),
      h('label', { class: 'tl-zoom' }, icon('zoom'), this.zoomInput),
    );

    this.ruler = h('div', { class: 'tl-ruler' });
    this.lanes = h('div', { class: 'tl-lanes' });
    this.headers = h('div', { class: 'tl-headers' });
    this.playhead = h('div', { class: 'tl-playhead', 'aria-hidden': 'true' });
    this.inOut = h('div', { class: 'tl-inout', hidden: true });
    this.content = h('div', { class: 'tl-content' }, this.ruler, this.lanes, this.inOut, this.playhead);
    this.scroller = h('div', { class: 'tl-scroller' }, this.content);
    this.el = h(
      'section',
      { class: 'timeline', 'aria-label': 'Timeline' },
      this.toolbar,
      h('div', { class: 'tl-body' }, h('div', { class: 'tl-corner' }, h('span', {}, 'Pistes')), this.headers, this.scroller),
    );
    this.scroller.addEventListener('scroll', () => {
      this.headers.scrollTop = this.scroller.scrollTop;
    });
    this.scroller.addEventListener('wheel', (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      this.setZoom(this.zoom * (event.deltaY < 0 ? 1.15 : 0.87));
    });
    this.ruler.addEventListener('pointerdown', (event) => this.scrub(event));
    this.lanes.addEventListener('pointerdown', (event) => {
      if (event.target === this.lanes || event.target.classList.contains('tl-lane')) {
        this.store.select([]);
        this.scrub(event);
      }
    });
    store.on((reason) => {
      if (reason !== 'saving' && reason !== 'saved' && reason !== 'history') this.render();
    });
    this.render();
  }

  /** Zoom so the whole project fits in the visible width. */
  fit() {
    const duration = Math.max(1, projectDuration(this.store.project));
    this.setZoom((this.scroller.clientWidth - 40) / duration);
    this.scroller.scrollLeft = 0;
  }

  setZoom(value) {
    const center = (this.scroller.scrollLeft + this.scroller.clientWidth / 2) / this.zoom;
    this.zoom = Math.max(8, Math.min(400, value));
    this.zoomInput.value = String(Math.round(this.zoom));
    this.render();
    this.scroller.scrollLeft = center * this.zoom - this.scroller.clientWidth / 2;
  }

  xToTime(clientX) {
    const rect = this.content.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / this.zoom);
  }

  scrub(event) {
    const move = (e) => this.onSeek(this.snap(this.xToTime(e.clientX), [], 0.05));
    move(event);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  snap(t, exclude = [], extraThreshold) {
    if (!this.snapping) return t;
    return snapTime(this.store.project, t, { exclude, threshold: extraThreshold ?? 8 / this.zoom, extra: [this.store.time] });
  }

  updatePlayhead(t) {
    this.playhead.style.transform = `translateX(${t * this.zoom}px)`;
    // keep the playhead visible while playing
    if (this.player.playing) {
      const x = t * this.zoom;
      if (x > this.scroller.scrollLeft + this.scroller.clientWidth - 40) this.scroller.scrollLeft = x - 80;
    }
  }

  // ---------------------------------------------------------------- render
  render() {
    const project = this.store.project;
    const duration = Math.max(30, ...project.clips.map(clipEnd)) + 20;
    const width = duration * this.zoom;
    this.content.style.width = `${width}px`;
    this.renderRuler(duration);
    clear(this.headers);
    clear(this.lanes);
    for (const track of project.tracks) {
      const height = TRACK_H[track.kind];
      this.headers.append(this.trackHeader(track, height));
      const lane = h('div', {
        class: `tl-lane tl-lane--${track.kind}${track.locked ? ' is-locked' : ''}${track.hidden ? ' is-hidden' : ''}`,
        style: { height: `${height}px` },
        dataset: { track: track.id },
      });
      this.bindDrop(lane, track);
      for (const clip of project.clips.filter((c) => c.trackId === track.id)) lane.append(this.clipEl(clip, track));
      this.lanes.append(lane);
    }
    for (const marker of project.markers) {
      const m = h('button', {
        class: 'tl-marker',
        type: 'button',
        style: { left: `${marker.t * this.zoom}px`, '--c': marker.color },
        title: `${marker.label} (${formatTime(marker.t)}) — clic : aller, Maj+clic : supprimer`,
      });
      m.addEventListener('click', (event) => {
        if (event.shiftKey)
          this.store.commit('Supprimer un marqueur', { ...project, markers: project.markers.filter((x) => x.id !== marker.id) });
        else this.onSeek(marker.t);
      });
      this.ruler.append(m);
    }
    if (project.inPoint != null || project.outPoint != null) {
      const a = project.inPoint ?? 0;
      const b = project.outPoint ?? duration;
      Object.assign(this.inOut.style, { left: `${a * this.zoom}px`, width: `${Math.max(0, b - a) * this.zoom}px` });
      this.inOut.hidden = false;
    } else this.inOut.hidden = true;
    this.updatePlayhead(this.store.time);
  }

  renderRuler(duration) {
    clear(this.ruler);
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
    const major = steps.find((s) => s * this.zoom >= 70) || 300;
    for (let t = 0; t <= duration; t += major) {
      this.ruler.append(h('span', { class: 'tl-tick', style: { left: `${t * this.zoom}px` } }, formatTime(t)));
    }
  }

  trackHeader(track, height) {
    const project = this.store.project;
    const toggle = (key, on, off, label) => {
      const b = h(
        'button',
        {
          class: `tl-hbtn${track[key] ? ' is-on' : ''}`,
          type: 'button',
          title: label,
          'aria-label': `${label} : ${track.name}`,
          'aria-pressed': String(track[key]),
        },
        track[key] ? on : off,
      );
      b.addEventListener('click', () =>
        this.store.commit(label, { ...project, tracks: project.tracks.map((t) => (t.id === track.id ? { ...t, [key]: !t[key] } : t)) }),
      );
      return b;
    };
    const name = h('input', { class: 'tl-track-name', value: track.name, 'aria-label': 'Nom de la piste' });
    name.addEventListener('change', () =>
      this.store.commit('Renommer une piste', {
        ...project,
        tracks: project.tracks.map((t) => (t.id === track.id ? { ...t, name: name.value || t.name } : t)),
      }),
    );
    const extra = [];
    if (track.kind === 'audio' || track.kind === 'video') {
      const role = h(
        'select',
        { class: 'tl-role', 'aria-label': 'Rôle audio de la piste' },
        h('option', { value: '', selected: !track.role }, 'Rôle —'),
        h('option', { value: 'voice', selected: track.role === 'voice' }, 'Voix'),
        h('option', { value: 'music', selected: track.role === 'music' }, 'Musique'),
      );
      role.addEventListener('change', () =>
        this.store.commit('Rôle de piste', {
          ...project,
          tracks: project.tracks.map((t) => (t.id === track.id ? { ...t, role: role.value || null } : t)),
        }),
      );
      extra.push(role, toggle('muted', '🔇', '🔊', 'Couper le son'));
    }
    const remove = h(
      'button',
      { class: 'tl-hbtn', type: 'button', title: 'Supprimer la piste', 'aria-label': `Supprimer la piste ${track.name}` },
      '✕',
    );
    remove.addEventListener('click', () => {
      if (project.clips.some((c) => c.trackId === track.id)) return this.toast('Videz la piste avant de la supprimer.');
      this.store.commit('Supprimer une piste', { ...project, tracks: project.tracks.filter((t) => t.id !== track.id) });
    });
    return h(
      'div',
      { class: `tl-header tl-header--${track.kind}`, style: { height: `${height}px` } },
      name,
      h(
        'div',
        { class: 'tl-header-btns' },
        toggle('locked', '🔒', '🔓', 'Verrouiller'),
        track.kind !== 'audio' ? toggle('hidden', '🙈', '👁', 'Masquer') : null,
        ...extra,
        remove,
      ),
    );
  }

  clipEl(clip, track) {
    const selected = this.store.selection.includes(clip.id);
    const media = clip.mediaId ? this.mediaIndex.get(clip.mediaId) : null;
    const label =
      clip.kind === 'text'
        ? clip.text.content.split('\n')[0]
        : clip.kind === 'sticker'
          ? clip.sticker?.emoji
          : clip.name || media?.name || clip.kind;
    const el = h(
      'div',
      {
        class: `tl-clip tl-clip--${clip.kind}${selected ? ' is-selected' : ''}${clip.group ? ' is-grouped' : ''}`,
        style: { left: `${clip.start * this.zoom}px`, width: `${Math.max(4, clip.duration * this.zoom)}px` },
        tabindex: '0',
        role: 'button',
        'aria-label': `${label} — ${formatTime(clip.start)} à ${formatTime(clipEnd(clip))}`,
        'aria-pressed': String(selected),
        dataset: { clip: clip.id },
      },
      h('span', { class: 'tl-clip-label' }, clip.speed !== 1 ? `${clip.speed}× · ` : '', label),
    );
    if (media?.thumb && clip.kind === 'video')
      el.style.backgroundImage = `linear-gradient(rgba(8,11,22,.35),rgba(8,11,22,.35)), url("${media.thumb}")`;
    if (media?.thumb && clip.kind === 'image')
      el.style.backgroundImage = `linear-gradient(rgba(8,11,22,.25),rgba(8,11,22,.25)), url("${media.thumb}")`;
    if ((clip.kind === 'audio' || clip.kind === 'video') && media) this.drawWaveform(el, clip, media);
    if (clip.transitionIn)
      el.append(
        h('span', {
          class: 'tl-trans tl-trans--in',
          style: { width: `${clip.transitionIn.duration * this.zoom}px` },
          title: `Transition d’entrée : ${clip.transitionIn.type}`,
        }),
      );
    if (clip.transitionOut)
      el.append(
        h('span', {
          class: 'tl-trans tl-trans--out',
          style: { width: `${clip.transitionOut.duration * this.zoom}px` },
          title: `Transition de sortie : ${clip.transitionOut.type}`,
        }),
      );
    if (selected) {
      for (const list of Object.values(clip.keyframes || {})) {
        for (const k of list) el.append(h('span', { class: 'tl-kf', style: { left: `${k.t * this.zoom}px` }, 'aria-hidden': 'true' }));
      }
    }
    if (clip.effects?.length) el.append(h('span', { class: 'tl-badge', title: `${clip.effects.length} effet(s)` }, 'fx'));
    const left = h('span', { class: 'tl-handle tl-handle--l', 'aria-hidden': 'true' });
    const right = h('span', { class: 'tl-handle tl-handle--r', 'aria-hidden': 'true' });
    el.append(left, right);
    if (!track.locked) {
      el.addEventListener('pointerdown', (event) =>
        this.startDrag(event, clip, event.target === left ? 'trim-l' : event.target === right ? 'trim-r' : 'move'),
      );
    }
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.store.select([clip.id]);
      }
    });
    if (clip.kind === 'placeholder') this.bindDrop(el, track, clip);
    return el;
  }

  async drawWaveform(el, clip, media) {
    let peaks = media.peaks;
    if (!peaks) {
      if (!this.waveforms.has(media.id)) {
        const { waveformPeaks } = await import('../engine/analysis.js');
        this.waveforms.set(
          media.id,
          waveformPeaks(media).catch(() => null),
        );
      }
      peaks = await this.waveforms.get(media.id);
      if (!peaks || !el.isConnected) return;
    }
    const canvas = h('canvas', { class: 'tl-wave', 'aria-hidden': 'true' });
    const width = Math.min(4000, Math.max(4, Math.round(clip.duration * this.zoom)));
    canvas.width = width;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = clip.kind === 'audio' ? 'rgba(69,229,245,0.85)' : 'rgba(245,247,255,0.55)';
    const total = media.duration || 1;
    for (let x = 0; x < width; x += 2) {
      const srcT = clip.in + (x / width) * clip.duration * clip.speed;
      const v = peaks[Math.min(peaks.length - 1, Math.floor((srcT / total) * peaks.length))] || 0;
      const hgt = Math.max(1, v * 38 * (clip.audio?.volume ?? 1));
      ctx.fillRect(x, 20 - hgt / 2, 1.5, hgt);
    }
    el.append(canvas);
  }

  // ---------------------------------------------------------------- gestures
  startDrag(event, clip, mode) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const store = this.store;
    let selection = store.selection;
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      selection = selection.includes(clip.id) ? selection.filter((id) => id !== clip.id) : [...selection, clip.id];
      store.select(selection);
      return;
    }
    if (!selection.includes(clip.id)) selection = expandGroups(store.project, [clip.id]);
    store.select(selection);
    const before = store.project;
    const startX = event.clientX;
    const startY = event.clientY;
    const originals = new Map(before.clips.filter((c) => selection.includes(c.id)).map((c) => [c.id, c]));
    const media = clip.mediaId ? this.mediaIndex.get(clip.mediaId) : null;
    let moved = false;
    const onMove = (e) => {
      const dt = (e.clientX - startX) / this.zoom;
      if (!moved && Math.abs(e.clientX - startX) < 3 && Math.abs(e.clientY - startY) < 3) return;
      moved = true;
      let clips = before.clips;
      if (mode === 'move') {
        const base = originals.get(clip.id);
        let start = Math.max(0, base.start + dt);
        const snappedStart = this.snap(start, [...originals.keys()]);
        const snappedEnd = this.snap(start + base.duration, [...originals.keys()]) - base.duration;
        start = Math.abs(snappedStart - start) <= Math.abs(snappedEnd - start) ? snappedStart : snappedEnd;
        const delta = Math.max(-Math.min(...[...originals.values()].map((c) => c.start)), start - base.start);
        // single clip: allow moving to another compatible track under the pointer
        let targetTrack = null;
        if (originals.size === 1) {
          const lane = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.tl-lane');
          const track = lane && before.tracks.find((t) => t.id === lane.dataset.track);
          if (track && !track.locked && track.kind === trackKindFor(clip.kind)) targetTrack = track.id;
        }
        clips = before.clips.map((c) =>
          originals.has(c.id) ? { ...c, start: c.start + delta, trackId: targetTrack && c.id === clip.id ? targetTrack : c.trackId } : c,
        );
      } else {
        const base = originals.get(clip.id);
        const limit = sourceLimit(base, media);
        if (mode === 'trim-l') {
          let start = this.snap(base.start + dt, [clip.id]);
          start = Math.min(start, clipEnd(base) - MIN_CLIP);
          start = Math.max(start, base.start - base.in / base.speed, 0);
          const d = start - base.start;
          clips = before.clips.map((c) =>
            c.id === clip.id ? { ...c, start, duration: base.duration - d, in: base.in + d * base.speed } : c,
          );
        } else {
          let end = this.snap(clipEnd(base) + dt, [clip.id]);
          end = Math.max(end, base.start + MIN_CLIP);
          if (Number.isFinite(limit)) end = Math.min(end, base.start + (limit - base.in) / base.speed);
          clips = before.clips.map((c) => (c.id === clip.id ? { ...c, duration: end - base.start } : c));
        }
      }
      store.preview({ ...before, clips });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) store.finishGesture(mode === 'move' ? 'Déplacer' : 'Découper', before);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  bindDrop(target, track, placeholder = null) {
    target.addEventListener('dragover', (event) => {
      if (![...event.dataTransfer.types].includes('application/x-solvex')) return;
      event.preventDefault();
      target.classList.add('is-drop');
    });
    target.addEventListener('dragleave', () => target.classList.remove('is-drop'));
    target.addEventListener('drop', (event) => {
      target.classList.remove('is-drop');
      const raw = event.dataTransfer.getData('application/x-solvex');
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      const payload = JSON.parse(raw);
      const time = placeholder ? placeholder.start : this.snap(this.xToTime(event.clientX));
      this.onDropMedia(payload, { trackId: track.id, time, placeholder });
    });
  }

  // ---------------------------------------------------------------- commands
  split() {
    const store = this.store;
    const t = store.time;
    let ids = store.selection.length
      ? store.selection
      : store.project.clips.filter((c) => t > c.start && t < clipEnd(c) && !this.isLocked(c)).map((c) => c.id);
    ids = ids.filter((id) => !this.isLocked(store.project.clips.find((c) => c.id === id)));
    const { project, created } = splitAt(store.project, ids, t);
    if (!created.length) return this.toast('Placez le curseur à l’intérieur d’un clip pour le diviser.');
    store.commit('Diviser', project, { select: created });
  }

  isLocked(clip) {
    return this.store.project.tracks.find((t) => t.id === clip?.trackId)?.locked;
  }

  deleteSelection() {
    const ids = this.store.selection.filter((id) => !this.isLocked(this.store.project.clips.find((c) => c.id === id)));
    if (!ids.length) return;
    this.store.commit('Supprimer', removeClips(this.store.project, ids), { select: [] });
  }

  duplicate() {
    if (!this.store.selection.length) return;
    const { project, created } = duplicateClips(this.store.project, this.store.selection);
    this.store.commit('Dupliquer', project, { select: created });
  }

  rippleInOut() {
    const p = this.store.project;
    if (p.inPoint == null || p.outPoint == null || p.outPoint <= p.inPoint)
      return this.toast('Définissez d’abord un point d’entrée (I) et de sortie (O).');
    const trackIds = p.tracks.filter((t) => !t.locked).map((t) => t.id);
    const next = rippleDelete(p, p.inPoint, p.outPoint, trackIds);
    this.store.commit('Supprimer une portion', { ...next, inPoint: null, outPoint: null }, { select: [] });
  }

  toggleGroup() {
    const ids = this.store.selection;
    if (ids.length < 1) return;
    const clips = this.store.project.clips.filter((c) => ids.includes(c.id));
    const grouped = clips.every((c) => c.group && c.group === clips[0].group);
    this.store.commit(
      grouped ? 'Dégrouper' : 'Grouper',
      grouped ? ungroupClips(this.store.project, ids) : groupClips(this.store.project, ids),
    );
  }

  addMarker() {
    const p = this.store.project;
    this.store.commit('Ajouter un marqueur', {
      ...p,
      markers: [...p.markers, { id: uid('k'), t: this.store.time, label: `Marqueur ${p.markers.length + 1}`, color: '#8B5CF6' }],
    });
  }

  setInOut(which) {
    const p = this.store.project;
    const t = this.store.time;
    if (which === 'in') this.store.commit('Point d’entrée', { ...p, inPoint: p.inPoint === t ? null : t });
    else this.store.commit('Point de sortie', { ...p, outPoint: p.outPoint === t ? null : t });
  }

  addTrack(kind) {
    const p = this.store.project;
    const track = createTrack(kind, {
      name: `${kind === 'video' ? 'Vidéo' : 'Audio'} ${p.tracks.filter((t) => t.kind === kind).length + 1}`,
    });
    const tracks = [...p.tracks];
    const index = kind === 'video' ? tracks.findIndex((t) => t.kind === 'video') : tracks.length;
    tracks.splice(Math.max(0, index), 0, track);
    this.store.commit('Ajouter une piste', { ...p, tracks });
  }
}
