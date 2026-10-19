/**
 * Real, local image processing on <canvas>. No AI involved: these are classic
 * signal-processing filters and are labelled as such in the interface.
 */

export const MAX_EDGE = 8192;
export const MAX_PIXELS = 40_000_000;

export async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

export function canvasFrom(source, width = source.naturalWidth || source.width, height = source.naturalHeight || source.height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

export function cloneCanvas(canvas) {
  return canvasFrom(canvas, canvas.width, canvas.height);
}

const yieldFrame = () => new Promise((resolve) => setTimeout(resolve, 16));

/** Progressive 2× steps give noticeably cleaner results than one large resize. */
export async function upscale(canvas, factor) {
  const targetW = Math.round(canvas.width * factor);
  const targetH = Math.round(canvas.height * factor);
  if (Math.max(targetW, targetH) > MAX_EDGE || targetW * targetH > MAX_PIXELS) {
    throw new Error(`Résultat trop grand (${targetW} × ${targetH} px). Limite : ${MAX_EDGE} px de côté.`);
  }
  let current = canvas;
  while (current.width * 2 <= targetW) {
    await yieldFrame();
    current = canvasFrom(current, current.width * 2, current.height * 2);
  }
  if (current.width !== targetW) current = canvasFrom(current, targetW, targetH);
  // A light unsharp mask compensates the softness introduced by interpolation.
  return sharpen(current, 0.35);
}

function boxBlur(src, width, height) {
  const out = new Uint8ClampedArray(src.length);
  const tmp = new Float32Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        const i = (y * width + x) * 4 + c;
        const l = x > 0 ? src[i - 4] : src[i];
        const r = x < width - 1 ? src[i + 4] : src[i];
        tmp[i] = (l + src[i] + r) / 3;
      }
    }
  }
  const row = width * 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const base = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const i = base + c;
        const u = y > 0 ? tmp[i - row] : tmp[i];
        const d = y < height - 1 ? tmp[i + row] : tmp[i];
        out[i] = (u + tmp[i] + d) / 3;
      }
      out[base + 3] = src[base + 3];
    }
  }
  return out;
}

export async function sharpen(canvas, amount = 0.6) {
  await yieldFrame();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const blurred = boxBlur(data, width, height);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) data[i + c] = data[i + c] + amount * (data[i + c] - blurred[i + c]);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Edge-preserving denoise: each pixel is pulled toward its 3×3 mean only when
 * the local difference is small (noise), so real edges stay crisp.
 */
export async function denoise(canvas, strength = 0.5) {
  await yieldFrame();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = image;
  const passes = strength > 0.66 ? 2 : 1;
  const threshold = 12 + strength * 36;
  for (let pass = 0; pass < passes; pass += 1) {
    const mean = boxBlur(data, width, height);
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c += 1) {
        const diff = Math.abs(data[i + c] - mean[i + c]);
        if (diff < threshold) {
          const weight = strength * (1 - diff / threshold);
          data[i + c] = data[i + c] + weight * (mean[i + c] - data[i + c]);
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** brightness/contrast/saturation/warmth in [-100, 100]. */
export async function adjust(canvas, { brightness = 0, contrast = 0, saturation = 0, warmth = 0 }) {
  await yieldFrame();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const b = brightness * 1.28;
  const k = (259 * (contrast * 1.28 + 255)) / (255 * (259 - contrast * 1.28));
  const s = 1 + saturation / 100;
  const warm = warmth * 0.3;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] + b + warm;
    let g = data[i + 1] + b;
    let bl = data[i + 2] + b - warm;
    r = k * (r - 128) + 128;
    g = k * (g - 128) + 128;
    bl = k * (bl - 128) + 128;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    data[i] = lum + (r - lum) * s;
    data[i + 1] = lum + (g - lum) * s;
    data[i + 2] = lum + (bl - lum) * s;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Stretches each channel between its 0.5th and 99.5th percentiles. */
export async function autoLevels(canvas) {
  await yieldFrame();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const pixels = data.length / 4;
  for (let c = 0; c < 3; c += 1) {
    const hist = new Uint32Array(256);
    for (let i = c; i < data.length; i += 4) hist[data[i]] += 1;
    let low = 0;
    let high = 255;
    for (let acc = 0; low < 255 && (acc += hist[low]) < pixels * 0.005; low += 1);
    for (let acc = 0; high > 0 && (acc += hist[high]) < pixels * 0.005; high -= 1);
    if (high - low < 10) continue;
    const scale = 255 / (high - low);
    for (let i = c; i < data.length; i += 4) data[i] = (data[i] - low) * scale;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Encodes as PNG, falling back to high-quality WebP when PNG exceeds the upload limit. */
export async function canvasToBlob(canvas, maxBytes) {
  const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (png && (!maxBytes || png.size <= maxBytes)) return png;
  const webp = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.95));
  if (webp && webp.type === 'image/webp' && (!maxBytes || webp.size <= maxBytes)) return webp;
  const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (jpeg && (!maxBytes || jpeg.size <= maxBytes)) return jpeg;
  throw new Error('Image trop lourde pour être enregistrée sur le serveur.');
}

/**
 * Brush-based mask editor drawn over the working image. Exported as a PNG with
 * the same size as the image: painted pixels are transparent (= area to edit),
 * everything else is opaque, which is the convention of the OpenAI edits API.
 */
export function createMaskPainter(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.className = 'mask-layer';
  canvas.setAttribute('aria-label', 'Zone à modifier : peignez avec la souris ou le doigt');
  const ctx = canvas.getContext('2d');
  let brush = Math.round(Math.max(width, height) / 22);
  let drawing = false;
  let last = null;
  let painted = false;

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height };
  }
  function stroke(from, to) {
    ctx.strokeStyle = 'rgba(69, 229, 245, 0.55)';
    ctx.fillStyle = 'rgba(69, 229, 245, 0.55)';
    ctx.lineWidth = brush;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    painted = true;
  }
  canvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    last = point(event);
    stroke(last, last);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drawing) return;
    const next = point(event);
    stroke(last, next);
    last = next;
  });
  for (const type of ['pointerup', 'pointercancel']) {
    canvas.addEventListener(type, () => {
      drawing = false;
    });
  }

  return {
    canvas,
    setBrush: (size) => (brush = size),
    get brush() {
      return brush;
    },
    hasMask: () => painted,
    clear() {
      ctx.clearRect(0, 0, width, height);
      painted = false;
    },
    async toBlob() {
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const octx = out.getContext('2d');
      const painted = ctx.getImageData(0, 0, width, height).data;
      const mask = octx.createImageData(width, height);
      for (let i = 0; i < painted.length; i += 4) {
        // Opaque black everywhere except where the user painted (fully transparent).
        mask.data[i + 3] = painted[i + 3] > 0 ? 0 : 255;
      }
      octx.putImageData(mask, 0, 0);
      return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    },
  };
}
