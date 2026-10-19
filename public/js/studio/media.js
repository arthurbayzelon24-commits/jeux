import { db, uid } from './db.js';

export const ACCEPT = {
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'],
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'],
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/mp4',
    'audio/x-m4a',
    'audio/flac',
  ],
};
export const ACCEPT_ATTR = [...ACCEPT.video, ...ACCEPT.image, ...ACCEPT.audio, '.mov', '.mkv', '.m4a'].join(',');
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go per file

export function kindOf(file) {
  const type = file.type || '';
  if (type.startsWith('video/') || /\.(mov|mkv)$/i.test(file.name)) return 'video';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/') || /\.m4a$/i.test(file.name)) return 'audio';
  return null;
}

// Object URLs are cached per media id and revoked only when the media is deleted.
const urlCache = new Map();
const pending = new Map();

export async function mediaUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  if (pending.has(id)) return pending.get(id);
  const promise = db.getBlob(id).then((blob) => {
    pending.delete(id);
    if (!blob) throw new Error('Fichier média introuvable dans le stockage local.');
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  });
  pending.set(id, promise);
  return promise;
}

export function releaseMedia(id) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

function waitEvent(target, ok, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Le fichier met trop de temps à se charger.')), timeout);
    target.addEventListener(ok, () => (clearTimeout(timer), resolve()), { once: true });
    target.addEventListener('error', () => (clearTimeout(timer), reject(new Error('Format non lisible par ce navigateur.'))), {
      once: true,
    });
  });
}

async function probeVideo(url) {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.src = url;
  await waitEvent(video, 'loadeddata');
  let duration = video.duration;
  // MediaRecorder WebM files report Infinity until the end is reached.
  if (!Number.isFinite(duration)) {
    video.currentTime = 1e9;
    await waitEvent(video, 'seeked').catch(() => {});
    duration = video.duration;
    video.currentTime = 0;
  }
  const time = Math.min(1, (duration || 0) / 3);
  video.currentTime = time;
  await waitEvent(video, 'seeked').catch(() => {});
  const thumb = snapshot(video, video.videoWidth, video.videoHeight);
  const result = { duration: Number.isFinite(duration) ? duration : 0, width: video.videoWidth, height: video.videoHeight, thumb };
  video.removeAttribute('src');
  video.load();
  return result;
}

async function probeImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight, thumb: snapshot(img, img.naturalWidth, img.naturalHeight), duration: 0 };
}

async function probeAudio(url) {
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.src = url;
  await waitEvent(audio, 'loadedmetadata');
  return { duration: Number.isFinite(audio.duration) ? audio.duration : 0, thumb: null };
}

export function snapshot(source, width, height, max = 320) {
  if (!width || !height) return null;
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch {
    return null;
  }
}

/** Imports one File/Blob into the local library and returns its metadata. */
export async function importFile(file, { name, origin = 'import', extra = {} } = {}) {
  const kind = kindOf(file);
  if (!kind) throw new Error(`« ${file.name || name} » : type de fichier non pris en charge.`);
  if (file.size > MAX_IMPORT_BYTES) throw new Error(`« ${file.name} » dépasse 2 Go.`);
  const id = uid('m');
  const url = URL.createObjectURL(file);
  try {
    const info = kind === 'video' ? await probeVideo(url) : kind === 'image' ? await probeImage(url) : await probeAudio(url);
    const meta = {
      id,
      name: name || file.name || `${kind}-${id}`,
      kind,
      mime: file.type || '',
      size: file.size,
      createdAt: new Date().toISOString(),
      favorite: false,
      origin,
      ...info,
      ...extra,
    };
    await db.putMedia(meta, file);
    urlCache.set(id, url);
    return meta;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new Error(`« ${file.name || name} » : ${error.message}`);
  }
}

export async function importFiles(files, onProgress) {
  const results = [];
  const errors = [];
  let index = 0;
  for (const file of files) {
    index += 1;
    onProgress?.(index, files.length, file.name);
    try {
      results.push(await importFile(file));
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { results, errors };
}

export async function deleteMedia(id) {
  releaseMedia(id);
  await db.deleteMedia(id);
}

/** Loads an HTMLImageElement for an image media (cached). */
const imageCache = new Map();
export function loadImageMedia(id) {
  if (imageCache.has(id)) return imageCache.get(id);
  const promise = mediaUrl(id).then(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  });
  imageCache.set(id, promise);
  promise.catch(() => imageCache.delete(id));
  return promise;
}

export function formatTime(seconds, fps = 30, withFrames = false) {
  const safe = Math.max(0, seconds || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (!withFrames) return base;
  const f = Math.floor((safe % 1) * fps);
  return `${base}:${String(f).padStart(2, '0')}`;
}
