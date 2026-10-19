/** Visual styles: the hint is appended to the description sent to the model. Shared by server and browser. */
export const STYLES = {
  realiste: { label: 'Réaliste', hint: 'photorealistic, natural lighting, true-to-life textures and proportions' },
  cinematique: {
    label: 'Cinématique',
    hint: 'cinematic film still, dramatic lighting, anamorphic lens, shallow depth of field, color graded',
  },
  anime: { label: 'Anime', hint: 'anime style, clean line art, cel shading, vibrant colors' },
  illustration: { label: 'Illustration', hint: 'detailed digital illustration, rich colors, crisp shapes' },
  '3d': { label: '3D', hint: '3D render, physically based materials, global illumination, soft shadows' },
  fantaisie: { label: 'Fantaisie', hint: 'epic fantasy art, magical atmosphere, intricate details' },
  cyberpunk: { label: 'Cyberpunk', hint: 'cyberpunk aesthetic, neon lights, rainy night city, high contrast' },
  artistique: { label: 'Artistique', hint: 'fine art painting, expressive brushwork, textured canvas' },
  photographie: { label: 'Photographie', hint: 'professional photography, 50mm lens, sharp focus, balanced exposure' },
  publicite: { label: 'Publicité', hint: 'premium advertising visual, studio lighting, clean composition, product hero shot' },
  personnalise: { label: 'Personnalisé', hint: '' },
};

/** Appends the selected style's descriptors to the user's prompt. */
export function applyStyle(prompt, styleId) {
  const style = STYLES[styleId];
  if (!style || !style.hint) return prompt;
  return `${prompt}\n\nStyle: ${style.hint}.`;
}
