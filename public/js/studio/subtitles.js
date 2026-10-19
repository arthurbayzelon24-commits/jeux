import { uid } from './db.js';

const pad = (n, size = 2) => String(n).padStart(size, '0');

function stamp(seconds, sep) {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

function parseStamp(text) {
  const match = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(text.trim());
  if (!match) return null;
  const [, h = '0', m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

/** Parses SRT or WebVTT text into [{ id, start, end, text }]. */
export function parseSubtitles(text) {
  const blocks = text
    .replace(/\r/g, '')
    .replace(/^WEBVTT[^\n]*\n/, '')
    .split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim() !== '');
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex === -1) continue;
    const [a, b] = lines[timeIndex].split('-->');
    const start = parseStamp(a);
    const end = parseStamp(b.split(' ').filter(Boolean)[0] || '');
    if (start === null || end === null || end <= start) continue;
    cues.push({
      id: uid('s'),
      start,
      end,
      text: lines
        .slice(timeIndex + 1)
        .join('\n')
        .replace(/<[^>]+>/g, ''),
    });
  }
  return cues.sort((x, y) => x.start - y.start);
}

export function toSrt(cues) {
  return cues.map((cue, i) => `${i + 1}\n${stamp(cue.start, ',')} --> ${stamp(cue.end, ',')}\n${cue.text}\n`).join('\n');
}

export function toVtt(cues) {
  return `WEBVTT\n\n${cues.map((cue) => `${stamp(cue.start, '.')} --> ${stamp(cue.end, '.')}\n${cue.text}\n`).join('\n')}`;
}

/** Problems a user should check: overlaps, too short, too fast to read. */
export function lintSubtitles(cues) {
  const issues = [];
  cues.forEach((cue, i) => {
    const duration = cue.end - cue.start;
    if (duration < 0.7) issues.push({ id: cue.id, message: 'Affichage très court (< 0,7 s).' });
    const cps = cue.text.replace(/\s/g, '').length / Math.max(0.1, duration);
    if (cps > 20) issues.push({ id: cue.id, message: `Lecture rapide : ${Math.round(cps)} caractères/s (17 recommandé).` });
    const next = cues[i + 1];
    if (next && next.start < cue.end - 0.01) issues.push({ id: cue.id, message: 'Chevauche le sous-titre suivant.' });
  });
  return issues;
}

/** Builds cues from timed transcription segments ({ start, end, text }). */
export function cuesFromSegments(segments, maxChars = 42) {
  const cues = [];
  for (const segment of segments) {
    const words = segment.text.trim().split(/\s+/);
    const chunks = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars && current) {
        chunks.push(current);
        current = word;
      } else current = `${current} ${word}`.trim();
    }
    if (current) chunks.push(current);
    const span = (segment.end - segment.start) / Math.max(1, chunks.length);
    chunks.forEach((chunk, i) =>
      cues.push({ id: uid('s'), start: segment.start + i * span, end: segment.start + (i + 1) * span, text: chunk }),
    );
  }
  return cues;
}
