import { isEmbedded } from './env.js';

/**
 * Saves a generated file. On the SOLVEX server a normal browser download is
 * used; in the public static version (claude.ai artifact) direct downloads are
 * blocked, so the file goes through the viewer's `downloads` capability, which
 * asks the viewer to confirm. Resolves to true when the file was handed over.
 */
const ALLOWED_STATIC = ['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov', 'txt', 'json', 'md', 'csv', 'svg', 'zip'];

export function staticFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return ALLOWED_STATIC.includes(ext) ? filename : `${filename}.txt`;
}

export async function saveFile(blob, filename) {
  if (isEmbedded()) {
    const downloads = await window.claude?.use?.('downloads');
    if (!downloads) throw new Error('Le téléchargement n’est pas disponible dans cette vue.');
    try {
      await downloads.save({ filename: staticFilename(filename), data: blob });
      return true;
    } catch (error) {
      if (error?.code === 'declined') return false;
      throw new Error(error?.message || 'Téléchargement refusé.');
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}
