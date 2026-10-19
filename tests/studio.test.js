import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  createProject,
  createClip,
  addClip,
  splitAt,
  rippleDelete,
  duplicateClips,
  pasteClips,
  snapTime,
  projectDuration,
  groupClips,
  expandGroups,
  projectFromTemplate,
  TEMPLATES,
  changeAspect,
  validateProject,
} from '../public/js/studio/project.js';
import { History } from '../public/js/studio/history.js';
import { valueAt, setKeyframe, removeKeyframe, resolveClip, MOTION_PRESETS } from '../public/js/studio/engine/keyframes.js';
import { parseSubtitles, toSrt, toVtt, lintSubtitles, cuesFromSegments } from '../public/js/studio/subtitles.js';
import { transitionState, TRANSITIONS } from '../public/js/studio/engine/transitions.js';
import { parseCube, toneLut, evalCurve } from '../public/js/studio/photo/engine.js';
import { queryStickers, stickerCount } from '../public/js/studio/stickers.js';
import { transcribe } from '../server/lib/transcribe.js';
import { loadConfig } from '../server/config.js';

function videoProject() {
  let p = createProject({ name: 'Test' });
  const track = p.tracks.find((t) => t.kind === 'video' && t.name === 'Vidéo');
  p = addClip(p, createClip('video', { trackId: track.id, start: 0, duration: 10, in: 2, mediaId: 'm1' }));
  p = addClip(p, createClip('video', { trackId: track.id, start: 10, duration: 5, mediaId: 'm2' }));
  return { p, track };
}

test('splitAt divise un clip et décale correctement la source', () => {
  const { p } = videoProject();
  const first = p.clips[0];
  const { project, created } = splitAt(p, [first.id], 4);
  assert.equal(created.length, 1);
  const left = project.clips.find((c) => c.id === first.id);
  const right = project.clips.find((c) => c.id === created[0]);
  assert.equal(left.duration, 4);
  assert.equal(right.start, 4);
  assert.equal(right.duration, 6);
  assert.equal(right.in, 6, 'in = 2 + 4 s de source');
  assert.equal(splitAt(p, [first.id], 0.05).created.length, 0, 'pas de division au ras du bord');
});

test('splitAt respecte la vitesse et répartit les images clés', () => {
  let { p } = videoProject();
  p = {
    ...p,
    clips: p.clips.map((c, i) =>
      i === 0 ? setKeyframe(setKeyframe({ ...c, speed: 2 }, 'transform.scale', 1, 1), 'transform.scale', 8, 2) : c,
    ),
  };
  const { project, created } = splitAt(p, [p.clips[0].id], 5);
  const right = project.clips.find((c) => c.id === created[0]);
  assert.equal(right.in, 2 + 5 * 2);
  assert.deepEqual(
    right.keyframes['transform.scale'].map((k) => k.t),
    [3],
  );
});

test('rippleDelete retire une portion et resserre la piste', () => {
  const { p, track } = videoProject();
  const next = rippleDelete(p, 3, 5, [track.id]);
  assert.equal(projectDuration(next), 13);
  const starts = next.clips.map((c) => [c.start, c.duration]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(starts, [
    [0, 3],
    [3, 5],
    [8, 5],
  ]);
});

test('dupliquer, coller, aimanter, grouper', () => {
  const { p } = videoProject();
  const { project, created } = duplicateClips(p, [p.clips[1].id]);
  assert.equal(project.clips.find((c) => c.id === created[0]).start, 15);
  const pasted = pasteClips(p, [p.clips[0], p.clips[1]], 20);
  assert.deepEqual(
    pasted.project.clips.slice(-2).map((c) => c.start),
    [20, 30],
  );
  assert.equal(snapTime(p, 9.95, { threshold: 0.1 }), 10);
  assert.equal(snapTime(p, 9.5, { threshold: 0.1 }), 9.5);
  const grouped = groupClips(p, [p.clips[0].id, p.clips[1].id]);
  assert.equal(expandGroups(grouped, [p.clips[0].id]).length, 2);
});

test('modèles, format et validation de projet', () => {
  const tpl = projectFromTemplate(TEMPLATES.find((t) => t.id === 'short'));
  assert.equal(tpl.settings.aspect, '9:16');
  assert.equal(tpl.clips.filter((c) => c.kind === 'placeholder').length, 4);
  assert.equal(changeAspect(tpl, '1:1').settings.width, 1080);
  assert.throws(() => validateProject({ type: 'video' }), /incomplet/);
  assert.ok(validateProject(createProject({ type: 'photo' })));
});

test('History : annuler / rétablir / revenir en arrière', () => {
  const h = new History();
  let state = { v: 0 };
  for (let i = 1; i <= 3; i += 1) state = h.commit(`v${i}`, state, { v: i });
  assert.equal(h.undo(state).state.v, 2);
  const back = h.revertTo(0, { v: 2 });
  assert.equal(back.v, 1);
  assert.equal(h.redo({ v: 1 }).state.v, 2);
});

test('images clés : interpolation, maintien et préréglages', () => {
  let clip = createClip('video', { duration: 4 });
  clip = setKeyframe(clip, 'transform.x', 0, 0, 'linear');
  clip = setKeyframe(clip, 'transform.x', 2, 1, 'linear');
  assert.equal(valueAt(clip, 'transform.x', 1), 0.5);
  assert.equal(valueAt(clip, 'transform.x', 3), 1);
  clip = setKeyframe(clip, 'transform.x', 0, 0, 'hold');
  assert.equal(valueAt(clip, 'transform.x', 1.9), 0);
  assert.equal(resolveClip(clip, 2).transform.x, 1);
  clip = removeKeyframe(clip, 'transform.x', 2);
  assert.equal(clip.keyframes['transform.x'].length, 1);
  const ken = MOTION_PRESETS['ken-burns'].build(4);
  assert.equal(ken['transform.scale'].at(-1).v, 1.15);
});

test('transitions : progression, sortie inversée et cumul', () => {
  const clip = createClip('video', {
    duration: 4,
    transitionIn: { type: 'fade', duration: 1 },
    transitionOut: { type: 'slide', duration: 1, direction: 'left', intensity: 1 },
  });
  assert.equal(transitionState(clip, 0.5).alpha, 0.5);
  assert.equal(transitionState(clip, 2), null);
  const out = transitionState(clip, 3.5);
  assert.ok(out.dx > 0, 'la sortie part dans le sens opposé');
  assert.ok(TRANSITIONS.length >= 14);
});

test('sous-titres : SRT et VTT aller-retour, contrôle de lisibilité', () => {
  const srt =
    '1\n00:00:01,000 --> 00:00:03,500\nBonjour\n\n2\n00:00:03,400 --> 00:00:03,900\nUn texte beaucoup trop long pour être lu en si peu de temps\n';
  const cues = parseSubtitles(srt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].end, 3.5);
  assert.deepEqual(
    parseSubtitles(toVtt(cues)).map((c) => c.text),
    cues.map((c) => c.text),
  );
  assert.match(toSrt(cues), /00:00:01,000 --> 00:00:03,500/);
  const issues = lintSubtitles(cues)
    .map((i) => i.message)
    .join(' ');
  assert.match(issues, /Chevauche/);
  assert.match(issues, /court|rapide/);
  assert.equal(cuesFromSegments([{ start: 0, end: 4, text: 'a '.repeat(40) }], 20).length, 4);
});

test('photo : LUT .cube, courbe et tonalité', () => {
  const cube = `TITLE "test"\nLUT_3D_SIZE 2\n${['0 0 0', '1 0 0', '0 1 0', '1 1 0', '0 0 1', '1 0 1', '0 1 1', '1 1 1'].join('\n')}\n`;
  assert.equal(parseCube(cube).size, 2);
  assert.throws(() => parseCube('LUT_3D_SIZE 3\n0 0 0\n'), /invalide/);
  assert.equal(
    evalCurve(
      [
        [0, 0],
        [0.5, 0.8],
        [1, 1],
      ],
      0.25,
    ),
    0.4,
  );
  const neutral = toneLut({});
  assert.equal(Math.round(neutral[128]), 128);
  assert.ok(toneLut({ exposure: 50 })[128] > 200);
});

test('stickers : pagination et recherche', () => {
  assert.ok(stickerCount() > 300);
  const page = queryStickers({ page: 0, pageSize: 50 });
  assert.equal(page.items.length, 50);
  assert.ok(page.hasMore);
  assert.ok(queryStickers({ search: 'jeu' }).items.every((i) => i.category === 'gaming'));
});

test('transcription : segments minutés (Whisper) ou texte seul', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const body =
      init.body.get('response_format') === 'verbose_json'
        ? {
            text: 'Bonjour à tous',
            segments: [
              { start: 0, end: 1.2, text: ' Bonjour' },
              { start: 1.2, end: 2, text: ' à tous' },
            ],
          }
        : { text: 'Bonjour à tous' };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const base = { openai: { apiKey: 'k', baseUrl: 'https://api.openai.test/v1', imageModel: 'gpt-image-2', textModel: '' } };
  const whisper = await transcribe(
    loadConfig({ openai: { ...base.openai, transcribeModel: 'whisper-1' } }),
    { buffer: Buffer.from('x'), mime: 'audio/wav' },
    { fetchImpl },
  );
  assert.equal(whisper.timed, true);
  assert.equal(whisper.segments.length, 2);
  assert.equal(calls[0].url, 'https://api.openai.test/v1/audio/transcriptions');
  assert.equal(calls[0].init.body.get('timestamp_granularities[]'), 'segment');
  const other = await transcribe(
    loadConfig({ openai: { ...base.openai, transcribeModel: 'autre-modele' } }),
    { buffer: Buffer.from('x'), mime: 'audio/wav' },
    { fetchImpl },
  );
  assert.equal(other.timed, false);
  assert.equal(other.segments[0].end, null);
});

test('build : la version de l’application correspond au dossier des mises à jour', () => {
  const output = execFileSync(process.execPath, ['scripts/build.js'], { encoding: 'utf8' });
  const appVersion = /APP_VERSION = '([^']+)'/.exec(readFileSync('public/js/lib/env.js', 'utf8'))[1];
  assert.match(output, new RegExp(`version ${appVersion.replaceAll('.', '\\.')}`));
  assert.equal(JSON.parse(readFileSync('package.json', 'utf8')).version, appVersion);
  const manifest = JSON.parse(readFileSync('public/asset-manifest.json', 'utf8'));
  assert.ok(manifest.assets.includes('/js/studio/pages/videoEditor.js'));
  assert.match(readFileSync('public/sw.js', 'utf8'), new RegExp(`VERSION = '${manifest.version}'`));
});
