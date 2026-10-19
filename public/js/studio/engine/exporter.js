/**
 * Real export through MediaRecorder: the timeline is played in real time onto
 * an offscreen canvas at the chosen resolution, mixed with the Web Audio bus.
 * Only containers/codecs the browser reports as supported are offered.
 */
const CANDIDATES = [
  { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', label: 'MP4 (H.264 + AAC)', ext: 'mp4' },
  { mime: 'video/mp4;codecs=avc1,opus', label: 'MP4 (H.264 + Opus)', ext: 'mp4' },
  { mime: 'video/mp4', label: 'MP4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9,opus', label: 'WebM (VP9 + Opus)', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8,opus', label: 'WebM (VP8 + Opus)', ext: 'webm' },
  { mime: 'video/webm', label: 'WebM', ext: 'webm' },
];

export function supportedFormats() {
  if (typeof MediaRecorder === 'undefined') return [];
  const seen = new Set();
  return CANDIDATES.filter((c) => {
    if (!MediaRecorder.isTypeSupported(c.mime)) return false;
    // keep one entry per container+codec family
    const key = c.label;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const EXPORT_PRESETS = [
  { id: 'project', label: 'Taille du projet', width: null, height: null },
  { id: '2160', label: '4K (2160p)', short: 2160 },
  { id: '1080', label: 'Full HD (1080p)', short: 1080 },
  { id: '720', label: 'HD (720p)', short: 720 },
  { id: '480', label: 'SD (480p)', short: 480 },
];

export const SOCIAL_PRESETS = [
  { id: 'youtube', label: 'YouTube', aspect: '16:9', preset: '1080', fps: 30, bitrate: 12 },
  { id: 'shorts', label: 'YouTube Shorts / TikTok / Reels', aspect: '9:16', preset: '1080', fps: 30, bitrate: 10 },
  { id: 'instagram', label: 'Publication Instagram', aspect: '4:5', preset: '1080', fps: 30, bitrate: 8 },
  { id: 'whatsapp', label: 'WhatsApp (léger)', aspect: null, preset: '720', fps: 30, bitrate: 3 },
];

export function exportSize(project, presetId) {
  const { width, height } = project.settings;
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId);
  if (!preset?.short) return { width, height };
  const scale = preset.short / Math.min(width, height);
  // Even dimensions are required by most encoders.
  return { width: Math.round((width * scale) / 2) * 2, height: Math.round((height * scale) / 2) * 2 };
}

export function estimateBytes(seconds, videoMbps, audioKbps = 192) {
  return Math.round(((videoMbps * 1e6 + audioKbps * 1e3) / 8) * seconds);
}

/**
 * Exports [from, to] of the project. Resolves with { blob, mime, ext }.
 * Rejects with an AbortError when `signal` is aborted.
 */
export async function exportVideo(player, { width, height, fps, mbps, format, from, to, monitor = false, onProgress, signal }) {
  if (typeof MediaRecorder === 'undefined') throw new Error('Ce navigateur ne permet pas l’export vidéo (MediaRecorder absent).');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  player.pause();
  await player.prepare();

  const stream = canvas.captureStream(fps);
  const audio = player.createAudioStream();
  audio?.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mime,
    videoBitsPerSecond: Math.round(mbps * 1e6),
    audioBitsPerSecond: 192000,
  });
  const chunks = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);

  const previousOnTime = player.onTime;
  const previousLoop = player.loop;
  const cleanup = () => {
    player.exportTarget = null;
    player.exportEnd = null;
    player.onTime = previousOnTime;
    player.onEnded = null;
    player.loop = previousLoop;
    player.setMonitor(true);
    audio?.disconnect();
    stream.getTracks().forEach((track) => track.stop());
  };

  try {
    player.loop = false;
    player.exportTarget = ctx;
    player.exportEnd = to;
    player.setMonitor(monitor);
    await player.seek(from);
    await player.waitReady(from);
    player.draw(ctx);

    const finished = new Promise((resolve, reject) => {
      player.onEnded = resolve;
      signal?.addEventListener('abort', () => reject(new DOMException('Export annulé', 'AbortError')), { once: true });
      document.addEventListener(
        'visibilitychange',
        () =>
          document.hidden &&
          reject(new Error('Export interrompu : l’onglet a été masqué. Gardez SOLVEX au premier plan pendant l’export.')),
        { once: true },
      );
    });
    player.onTime = (t) => {
      previousOnTime(t);
      onProgress?.(Math.min(1, (t - from) / Math.max(0.001, to - from)));
    };
    recorder.start(500);
    await player.play();
    await finished;
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });
    onProgress?.(1);
    const mime = format.mime.split(';')[0];
    return { blob: new Blob(chunks, { type: mime }), mime, ext: format.ext };
  } catch (error) {
    player.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    throw error;
  } finally {
    cleanup();
  }
}
