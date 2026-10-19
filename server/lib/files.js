export const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const VIDEO_TYPES = {
  'video/mp4': 'mp4',
};

const EXTENSION_TYPES = Object.fromEntries(
  [...Object.entries(IMAGE_TYPES), ...Object.entries(VIDEO_TYPES)].map(([mime, ext]) => [ext, mime]),
);

export function mimeFromExtension(ext) {
  return EXTENSION_TYPES[ext.toLowerCase()] || null;
}

/** Detects the real type from magic bytes; never trusts the declared Content-Type. */
export function sniffMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
  return null;
}

export function imageDimensions(buffer, mime) {
  try {
    if (mime === 'image/png') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') return jpegDimensions(buffer);
    if (mime === 'image/webp') return webpDimensions(buffer);
  } catch {
    // Fall through: a truncated header simply yields unknown dimensions.
  }
  return null;
}

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(buffer) {
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  return null;
}

/** Validates an uploaded image buffer and returns its real metadata. */
export function inspectImage(buffer, { maxPixels = 40_000_000 } = {}) {
  const mime = sniffMime(buffer);
  if (!mime || !IMAGE_TYPES[mime]) return { ok: false, reason: 'Format non pris en charge. Utilisez PNG, JPEG ou WebP.' };
  const dims = imageDimensions(buffer, mime);
  if (dims && (dims.width < 16 || dims.height < 16)) return { ok: false, reason: 'Image trop petite (16 px minimum).' };
  if (dims && dims.width * dims.height > maxPixels) return { ok: false, reason: 'Image trop grande en pixels.' };
  return { ok: true, mime, ext: IMAGE_TYPES[mime], width: dims?.width ?? null, height: dims?.height ?? null };
}
