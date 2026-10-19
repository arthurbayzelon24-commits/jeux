import { mediaUrl, loadImageMedia } from '../media.js';
import { Compositor } from './compositor.js';
import { valueAt } from './keyframes.js';
import { projectDuration } from '../project.js';

const DRIFT = 0.12; // seconds of tolerated desync before re-seeking

/**
 * Drives preview/export playback: one media element per clip, kept in sync
 * with a wall clock; audio goes through Web Audio (gain, pan, ducking) so the
 * same graph can feed the speakers and the export recorder.
 */
export class Player {
  constructor({ canvas, getProject, onTime, onState }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getProject = getProject;
    this.onTime = onTime || (() => {});
    this.onState = onState || (() => {});
    this.compositor = new Compositor();
    this.elements = new Map(); // clipId -> { el, mediaId, node }
    this.images = new Map(); // mediaId -> HTMLImageElement
    this.time = 0;
    this.playing = false;
    this.loop = false;
    this.raf = 0;
    this.audio = null;
    this.exportTarget = null;
    this.renderQueued = false;
  }

  // ---------------------------------------------------------------- audio graph
  ensureAudio() {
    if (this.audio) return this.audio;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const master = ctx.createGain();
    const speakers = ctx.createGain();
    master.connect(speakers);
    speakers.connect(ctx.destination);
    this.audio = { ctx, master, speakers };
    return this.audio;
  }

  connectElement(entry) {
    const audio = this.ensureAudio();
    if (!audio || entry.node) return;
    try {
      const source = audio.ctx.createMediaElementSource(entry.el);
      const gain = audio.ctx.createGain();
      const pan = audio.ctx.createStereoPanner ? audio.ctx.createStereoPanner() : null;
      source.connect(gain);
      if (pan) {
        gain.connect(pan);
        pan.connect(audio.master);
      } else gain.connect(audio.master);
      entry.node = { source, gain, pan };
    } catch {
      // Element already wired or cross-origin: fall back to element volume.
    }
  }

  /** Routes the master bus to a MediaStream for recording (export / capture). */
  createAudioStream() {
    const audio = this.ensureAudio();
    if (!audio) return null;
    const dest = audio.ctx.createMediaStreamDestination();
    audio.master.connect(dest);
    return { stream: dest.stream, disconnect: () => audio.master.disconnect(dest) };
  }

  // ---------------------------------------------------------------- sources
  async prepare() {
    const project = this.getProject();
    const used = new Set();
    const jobs = [];
    for (const clip of project.clips) {
      if (clip.kind === 'image' && clip.mediaId && !this.images.has(clip.mediaId)) {
        jobs.push(
          loadImageMedia(clip.mediaId)
            .then((img) => this.images.set(clip.mediaId, img))
            .catch(() => {}),
        );
      }
      if ((clip.kind === 'video' || clip.kind === 'audio') && clip.mediaId) {
        used.add(clip.id);
        const existing = this.elements.get(clip.id);
        if (existing && existing.mediaId === clip.mediaId) continue;
        if (existing) this.dropElement(clip.id);
        jobs.push(this.createElement(clip));
      }
    }
    for (const id of [...this.elements.keys()]) if (!used.has(id)) this.dropElement(id);
    this.compositor.prune(project);
    await Promise.all(jobs);
  }

  async createElement(clip) {
    const url = await mediaUrl(clip.mediaId).catch(() => null);
    if (!url) return;
    const el = document.createElement(clip.kind === 'video' ? 'video' : 'audio');
    el.preload = 'auto';
    el.playsInline = true;
    el.crossOrigin = 'anonymous';
    el.src = url;
    const entry = { el, mediaId: clip.mediaId, node: null, seeking: false };
    el.addEventListener('seeked', () => this.requestRender());
    el.addEventListener('loadeddata', () => this.requestRender());
    this.elements.set(clip.id, entry);
    this.connectElement(entry);
  }

  dropElement(id) {
    const entry = this.elements.get(id);
    if (!entry) return;
    entry.el.pause();
    try {
      entry.node?.source.disconnect();
    } catch {
      /* already disconnected */
    }
    entry.el.removeAttribute('src');
    entry.el.load();
    this.elements.delete(id);
  }

  getSource = (clip) => {
    if (clip.kind === 'image') return this.images.get(clip.mediaId) || null;
    return this.elements.get(clip.id)?.el || null;
  };

  // ---------------------------------------------------------------- timing
  duration() {
    if (this.exportEnd != null) return this.exportEnd;
    const project = this.getProject();
    return project.outPoint ?? projectDuration(project);
  }

  /** Mutes the speakers without affecting what is recorded. */
  setMonitor(on) {
    const audio = this.ensureAudio();
    if (audio) audio.speakers.gain.value = on ? 1 : 0;
  }

  mediaTime(clip, t) {
    return clip.in + Math.max(0, t - clip.start) * clip.speed;
  }

  /** Synchronises every media element with timeline time t. */
  syncElements(t, { hard = false } = {}) {
    const project = this.getProject();
    const tracks = new Map(project.tracks.map((tr) => [tr.id, tr]));
    const voiceActive = project.ducking?.enabled
      ? project.clips.some(
          (c) =>
            tracks.get(c.trackId)?.role === 'voice' &&
            !tracks.get(c.trackId)?.muted &&
            t >= c.start &&
            t < c.start + c.duration &&
            (c.kind === 'audio' || c.kind === 'video'),
        )
      : false;
    for (const clip of project.clips) {
      const entry = this.elements.get(clip.id);
      if (!entry) continue;
      const { el } = entry;
      const track = tracks.get(clip.trackId);
      const active = t >= clip.start && t < clip.start + clip.duration;
      // Crossfade: the outgoing clip is held on its last frame by the compositor.
      const holding =
        !active &&
        project.clips.some(
          (c) =>
            c.trackId === clip.trackId &&
            c.transitionIn?.type === 'crossfade' &&
            Math.abs(c.start - (clip.start + clip.duration)) < 0.05 &&
            t >= c.start &&
            t < c.start + c.transitionIn.duration,
        );
      if (!active) {
        if (!el.paused) el.pause();
        if (holding) {
          const end = this.mediaTime(clip, clip.start + clip.duration - 1 / 30);
          if (Math.abs(el.currentTime - end) > 0.05) el.currentTime = end;
        }
        this.setGain(entry, 0);
        continue;
      }
      const target = this.mediaTime(clip, t);
      if (Math.abs(el.playbackRate - clip.speed) > 1e-3) {
        el.playbackRate = clip.speed;
        el.preservesPitch = clip.preservePitch !== false;
      }
      if (hard || Math.abs(el.currentTime - target) > DRIFT) {
        if (el.readyState >= 1) el.currentTime = target;
      }
      if (this.playing && el.paused) el.play().catch(() => {});
      if (!this.playing && !el.paused) el.pause();
      // ---- volume
      const local = t - clip.start;
      let volume = valueAt(clip, 'audio.volume', local) ?? 1;
      const a = clip.audio || {};
      if (a.fadeIn > 0 && local < a.fadeIn) volume *= local / a.fadeIn;
      if (a.fadeOut > 0 && clip.duration - local < a.fadeOut) volume *= (clip.duration - local) / a.fadeOut;
      volume *= track?.volume ?? 1;
      if (track?.muted || clip.muted) volume = 0;
      if (voiceActive && track?.role === 'music') volume *= project.ducking.amount;
      this.setGain(entry, volume, a.pan || 0);
    }
  }

  setGain(entry, volume, pan = 0) {
    if (entry.node) {
      entry.node.gain.gain.value = volume;
      if (entry.node.pan) entry.node.pan.pan.value = pan;
      entry.el.volume = 1;
    } else {
      entry.el.volume = Math.max(0, Math.min(1, volume));
    }
  }

  // ---------------------------------------------------------------- render & transport
  requestRender() {
    if (this.renderQueued || this.playing) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.draw();
    });
  }

  draw(target = this.ctx) {
    this.compositor.render(target, this.getProject(), this.time, this.getSource, { showPlaceholders: !this.exportTarget });
  }

  async seek(t) {
    this.time = Math.max(0, Math.min(t, Math.max(this.duration(), 0)));
    this.syncElements(this.time, { hard: true });
    this.onTime(this.time);
    this.requestRender();
  }

  async play() {
    if (this.playing) return;
    const audio = this.ensureAudio();
    if (audio?.ctx.state === 'suspended') await audio.ctx.resume();
    const end = this.duration();
    if (end <= 0) return;
    if (this.time >= end - 0.01) this.time = this.getProject().inPoint ?? 0;
    this.playing = true;
    this.clockStart = performance.now();
    this.timeStart = this.time;
    this.syncElements(this.time, { hard: true });
    this.onState(true);
    const tick = () => {
      if (!this.playing) return;
      const now = performance.now();
      this.time = this.timeStart + (now - this.clockStart) / 1000;
      const stop = this.duration();
      if (this.time >= stop) {
        if (this.loop && !this.exportTarget) {
          this.time = this.getProject().inPoint ?? 0;
          this.clockStart = now;
          this.timeStart = this.time;
          this.syncElements(this.time, { hard: true });
        } else {
          this.time = stop;
          this.draw(this.exportTarget || this.ctx);
          this.pause();
          this.onEnded?.();
          return;
        }
      }
      this.syncElements(this.time);
      this.draw(this.exportTarget || this.ctx);
      if (this.exportTarget) this.draw(this.ctx);
      this.onTime(this.time);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const { el } of this.elements.values()) el.pause();
    this.onState(false);
    this.requestRender();
  }

  toggle() {
    return this.playing ? this.pause() : this.play();
  }

  setMasterVolume(v) {
    const audio = this.ensureAudio();
    if (audio) audio.master.gain.value = v;
  }

  /** Waits until every active element at time t has decoded its frame. */
  async waitReady(t, timeout = 4000) {
    const project = this.getProject();
    const active = project.clips.filter((c) => t >= c.start && t < c.start + c.duration && this.elements.has(c.id));
    await Promise.race([
      Promise.all(
        active.map(
          ({ id }) =>
            new Promise((resolve) => {
              const { el } = this.elements.get(id);
              if (el.readyState >= 2 && !el.seeking) return resolve();
              el.addEventListener('seeked', resolve, { once: true });
              el.addEventListener('canplay', resolve, { once: true });
            }),
        ),
      ),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ]);
  }

  destroy() {
    this.pause();
    for (const id of [...this.elements.keys()]) this.dropElement(id);
    this.audio?.ctx.close().catch(() => {});
  }
}
