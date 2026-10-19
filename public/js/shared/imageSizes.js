/**
 * Image formats, resolution tiers and quality tiers shared by the image
 * providers. A resolution tier fixes the long edge (4K = 3840 px, so 16:9 gives
 * 3840 × 2160 and 1:1 gives 3840 × 3840); each provider then says which
 * combinations it can produce natively, and why the others are unavailable.
 */

export const ASPECTS = [
  { id: '1:1', label: 'Carré', w: 1, h: 1 },
  { id: '2:3', label: 'Portrait', w: 2, h: 3 },
  { id: '3:4', label: 'Portrait réseaux sociaux', w: 3, h: 4 },
  { id: '4:5', label: 'Publication Instagram', w: 4, h: 5 },
  { id: '9:16', label: 'Vertical (Stories, Reels)', w: 9, h: 16 },
  { id: '3:2', label: 'Paysage', w: 3, h: 2 },
  { id: '4:3', label: 'Paysage 4:3', w: 4, h: 3 },
  { id: '16:9', label: 'Paysage large', w: 16, h: 9 },
  { id: '21:9', label: 'Panoramique', w: 21, h: 9 },
];

export const RESOLUTIONS = [
  { id: '512', label: '512 px', long: 512 },
  { id: '720p', label: '720p', long: 1280 },
  { id: '1080p', label: '1080p Full HD', long: 1920 },
  { id: '1440p', label: '1440p QHD', long: 2560 },
  { id: '2160p', label: '2160p 4K', long: 3840 },
];

export const QUALITY_TIERS = [
  { id: 'standard', label: 'Standard', detail: 'Plus rapide' },
  { id: 'high', label: 'Élevée', detail: 'Plus de détails' },
  { id: 'veryhigh', label: 'Très élevée', detail: 'Niveau de qualité maximal du modèle' },
  { id: 'ultra', label: 'Ultra / 4K', detail: 'Qualité maximale et plus grande taille native possible' },
];

const round = (value, multiple) => Math.max(multiple, Math.round(value / multiple) * multiple);

/** Width × height for a format and resolution tier, both edges rounded to `multiple`. */
export function dimensionsFor(aspectId, resolutionId, multiple = 16) {
  const aspect = ASPECTS.find((a) => a.id === aspectId);
  const tier = RESOLUTIONS.find((r) => r.id === resolutionId);
  if (!aspect || !tier) return null;
  const landscape = aspect.w >= aspect.h;
  const long = tier.long;
  const short = (long * Math.min(aspect.w, aspect.h)) / Math.max(aspect.w, aspect.h);
  const width = round(landscape ? long : short, multiple);
  const height = round(landscape ? short : long, multiple);
  return { width, height };
}

/**
 * Builds the `aspects` capability list: for each format, the tiers the
 * provider produces natively and, for the others, the reason.
 * `check({ width, height, aspect })` returns null when supported, else a reason.
 */
export function buildAspects(aspectIds, check, multiple = 16) {
  return ASPECTS.filter((a) => aspectIds.includes(a.id)).map((aspect) => {
    const resolutions = [];
    const unavailable = [];
    for (const tier of RESOLUTIONS) {
      const dims = dimensionsFor(aspect.id, tier.id, multiple);
      const reason = check({ ...dims, aspect });
      if (reason) unavailable.push({ id: tier.id, reason });
      else resolutions.push({ id: tier.id, ...dims });
    }
    return { id: aspect.id, label: aspect.label, resolutions, unavailable };
  });
}

/** The largest tier a format supports natively (used by « Ultra / 4K »). */
export function largestResolution(aspects, aspectId) {
  return aspects.find((a) => a.id === aspectId)?.resolutions.at(-1)?.id || null;
}

export const formatPixels = (n) => `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mpx`;
