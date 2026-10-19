import { createClip, changeAspect, rippleDelete, splitAt, clipEnd, addClip } from './project.js';
import { detectSilences, loudestMoments, normalizationGain, detectScenes } from './engine/analysis.js';
import { uid } from './db.js';

/**
 * SOLVEX editing assistant (local, rule-based). It turns a French request into
 * a *plan*: a list of concrete edits shown to the user, applied only after
 * they accept, as one undoable step. It never claims an edit it did not make.
 */
export const ASSISTANT_EXAMPLES = [
  'Coupe les silences de cette vidéo',
  'Rends la vidéo plus lumineuse',
  'Mets la musique moins fort pendant que je parle',
  'Ajoute un titre « Bienvenue » au début',
  'Transforme ce montage en format vertical',
  'Propose des transitions plus douces',
  'Trouve les meilleurs moments',
  'Crée une version courte',
  'Découpe aux changements de scène',
  'Normalise le son',
  'Accélère le clip sélectionné',
  'Annule la dernière modification de l’assistant',
];

const has = (text, ...words) => words.some((w) => text.includes(w));

function targetClips(ctx, kinds) {
  const selected = ctx.project.clips.filter((c) => ctx.selection.includes(c.id) && kinds.includes(c.kind));
  return selected.length ? selected : ctx.project.clips.filter((c) => kinds.includes(c.kind));
}

function mediaClips(ctx) {
  return targetClips(ctx, ['video', 'audio']).filter((c) => c.mediaId);
}

/** Converts a source-time range of a clip to timeline time (clamped to the clip). */
function toTimeline(clip, [a, b]) {
  const from = clip.start + (a - clip.in) / clip.speed;
  const to = clip.start + (b - clip.in) / clip.speed;
  return [Math.max(clip.start, from), Math.min(clipEnd(clip), to)];
}

export async function planRequest(input, ctx) {
  const text = input.toLowerCase().normalize('NFC');
  const quoted = /[«"“]\s*([^»"”]+?)\s*[»"”]/.exec(input)?.[1];

  if (has(text, 'annule', 'supprime l’effet', "supprime l'effet", 'défais')) {
    return { kind: 'undo', summary: 'Annuler la dernière modification appliquée par l’assistant.', actions: ['Retour à l’état précédent'] };
  }

  if (has(text, 'silence', 'blancs', 'temps mort')) {
    const clips = mediaClips(ctx);
    if (!clips.length) return { message: 'Aucun clip audio ou vidéo dans le projet : il n’y a rien à analyser.' };
    let ranges = [];
    for (const clip of clips) {
      try {
        const silences = await detectSilences(clip.mediaId);
        ranges.push(...silences.map((r) => toTimeline(clip, r)).filter(([a, b]) => b - a > 0.15));
      } catch (error) {
        return { message: `Analyse impossible : ${error.message}` };
      }
    }
    ranges = ranges.sort((a, b) => b[0] - a[0]);
    if (!ranges.length) return { message: 'Je n’ai détecté aucun silence de plus de 0,6 s (seuil −40 dB).' };
    const total = ranges.reduce((sum, [a, b]) => sum + (b - a), 0);
    const trackIds = ctx.project.tracks.filter((t) => !t.locked).map((t) => t.id);
    return {
      summary: `${ranges.length} silence(s) détecté(s), ${total.toFixed(1)} s au total. Ils seront retirés et le montage resserré sur les pistes non verrouillées.`,
      actions: ranges
        .slice(0, 12)
        .map(([a, b]) => `Retirer ${a.toFixed(2)} s → ${b.toFixed(2)} s`)
        .concat(ranges.length > 12 ? [`… et ${ranges.length - 12} autre(s)`] : []),
      apply: (project) => ranges.reduce((p, [a, b]) => rippleDelete(p, a, b, trackIds), project),
    };
  }

  const colorChange = has(text, 'lumineu', 'éclair', 'plus clair')
    ? { exposure: 20 }
    : has(text, 'sombre', 'assombri')
      ? { exposure: -20 }
      : has(text, 'contraste')
        ? { contrast: 20 }
        : has(text, 'vives', 'saturé', 'sature')
          ? { saturation: 25 }
          : has(text, 'chaud')
            ? { temperature: 25 }
            : has(text, 'froid')
              ? { temperature: -25 }
              : null;
  if (colorChange) {
    const clips = targetClips(ctx, ['video', 'image']);
    if (!clips.length) return { message: 'Aucun clip vidéo ou image à corriger.' };
    const [key, delta] = Object.entries(colorChange)[0];
    const labels = { exposure: 'Exposition', contrast: 'Contraste', saturation: 'Saturation', temperature: 'Température' };
    return {
      summary: `${labels[key]} ${delta > 0 ? '+' : ''}${delta} sur ${clips.length} clip(s)${ctx.selection.length ? ' sélectionné(s)' : ''}.`,
      actions: clips.map((c) => `${c.name || 'Clip'} : ${labels[key]} ${(c.color[key] || 0) + delta}`),
      apply: (project) => ({
        ...project,
        clips: project.clips.map((c) =>
          clips.some((x) => x.id === c.id)
            ? { ...c, color: { ...c.color, [key]: Math.max(-100, Math.min(100, (c.color[key] || 0) + delta)) } }
            : c,
        ),
      }),
    };
  }

  if (has(text, 'noir et blanc', 'noir & blanc')) {
    const clips = targetClips(ctx, ['video', 'image']);
    return {
      summary: `Effet noir et blanc sur ${clips.length} clip(s).`,
      actions: clips.map((c) => `${c.name || 'Clip'} : + Noir et blanc`),
      apply: (project) => ({
        ...project,
        clips: project.clips.map((c) =>
          clips.some((x) => x.id === c.id)
            ? { ...c, effects: [...c.effects, { id: uid('e'), type: 'noir', params: { contrast: 1.2 } }] }
            : c,
        ),
      }),
    };
  }

  if (has(text, 'musique') && has(text, 'parle', 'voix', 'dialogue')) {
    const voice = ctx.project.tracks.filter((t) => t.role === 'voice').map((t) => t.name);
    const music = ctx.project.tracks.filter((t) => t.role === 'music').map((t) => t.name);
    if (!voice.length || !music.length)
      return { message: 'Il faut une piste marquée « Voix » et une piste marquée « Musique » (rôle réglable dans l’en-tête de piste).' };
    return {
      summary: `Atténuation automatique : la musique (${music.join(', ')}) descend à 25 % quand un clip est présent sur ${voice.join(', ')}.`,
      actions: ['Activer l’atténuation automatique (ducking)', 'Niveau de la musique pendant la voix : 25 %'],
      apply: (project) => ({ ...project, ducking: { enabled: true, amount: 0.25 } }),
    };
  }

  if (has(text, 'musique') && has(text, 'moins fort', 'baisse', 'plus bas')) {
    return {
      summary: 'Volume des pistes musique divisé par deux.',
      actions: ctx.project.tracks.filter((t) => t.role === 'music').map((t) => `${t.name} : ${Math.round(t.volume * 50)} %`),
      apply: (project) => ({ ...project, tracks: project.tracks.map((t) => (t.role === 'music' ? { ...t, volume: t.volume * 0.5 } : t)) }),
    };
  }

  if (has(text, 'titre')) {
    const textTrack = ctx.project.tracks.find((t) => t.kind === 'text');
    if (!textTrack) return { message: 'Ajoutez d’abord une piste de texte.' };
    const content = quoted || 'Votre titre';
    const atStart = !has(text, 'fin');
    const end = Math.max(3, ...ctx.project.clips.map(clipEnd));
    const start = atStart ? 0 : Math.max(0, end - 3);
    return {
      summary: `Titre « ${content} » ajouté ${atStart ? 'au début' : 'à la fin'} (3 s, apparition en fondu).`,
      actions: [`Piste ${textTrack.name} : texte de ${start.toFixed(1)} s à ${(start + 3).toFixed(1)} s`],
      apply: (project) => addClip(project, createClip('text', { trackId: textTrack.id, start, duration: 3, text: { content } })),
    };
  }

  const aspect = has(text, 'vertical', '9:16', 'tiktok', 'short', 'reel')
    ? '9:16'
    : has(text, 'carré', '1:1')
      ? '1:1'
      : has(text, 'paysage', 'horizontal', '16:9')
        ? '16:9'
        : null;
  if (aspect && has(text, 'format', 'transforme', 'vertical', 'carré', 'paysage', 'horizontal')) {
    return {
      summary: `Format du projet → ${aspect}. Les clips vidéo et image passent en remplissage (recadrage centré).`,
      actions: [`Format ${aspect}`, 'Clips vidéo/image : remplissage du cadre'],
      apply: (project) => {
        const next = changeAspect(project, aspect);
        return { ...next, clips: next.clips.map((c) => (c.kind === 'video' || c.kind === 'image' ? { ...c, fit: 'cover' } : c)) };
      },
    };
  }

  if (has(text, 'transition')) {
    const soft = !has(text, 'dynamique', 'rapide', 'énergique');
    const changes = [];
    for (const track of ctx.project.tracks.filter((t) => t.kind === 'video')) {
      const clips = ctx.project.clips.filter((c) => c.trackId === track.id).sort((a, b) => a.start - b.start);
      clips.forEach((clip, i) => {
        if (i > 0 && Math.abs(clips[i - 1].start + clips[i - 1].duration - clip.start) < 0.05) changes.push(clip.id);
      });
    }
    if (!changes.length) return { message: 'Aucun enchaînement de clips bout à bout trouvé sur les pistes vidéo.' };
    const transition = soft
      ? { type: 'crossfade', duration: 0.8, direction: 'left', intensity: 1 }
      : { type: 'slide', duration: 0.35, direction: 'left', intensity: 1 };
    return {
      summary: `${soft ? 'Fondus enchaînés de 0,8 s' : 'Glissements de 0,35 s'} sur ${changes.length} raccord(s).`,
      actions: changes.map((id) => `Raccord avant « ${ctx.project.clips.find((c) => c.id === id).name || 'clip'} »`),
      apply: (project) => ({
        ...project,
        clips: project.clips.map((c) => (changes.includes(c.id) ? { ...c, transitionIn: transition } : c)),
      }),
    };
  }

  if (has(text, 'meilleurs moments', 'moments forts', 'temps forts') || has(text, 'version courte', 'résumé', 'raccourci')) {
    const clip = mediaClips(ctx)[0];
    if (!clip) return { message: 'Il faut au moins un clip audio ou vidéo.' };
    let moments;
    try {
      moments = (await loudestMoments(clip.mediaId, { length: 5, count: 3 }))
        .map((m) => ({ ...m, range: toTimeline(clip, [m.start, m.end]) }))
        .filter((m) => m.range[1] > m.range[0]);
    } catch (error) {
      return { message: `Analyse impossible : ${error.message}` };
    }
    if (!moments.length) return { message: 'Aucun passage exploitable trouvé.' };
    const method = 'Méthode : passages de 5 s où le niveau sonore moyen est le plus élevé (indicateur simple, à vérifier).';
    if (has(text, 'version courte', 'résumé', 'raccourci')) {
      const keep = moments.map((m) => m.range).sort((a, b) => a[0] - b[0]);
      const end = Math.max(...ctx.project.clips.map(clipEnd));
      const cuts = [];
      let cursor = 0;
      for (const [a, b] of keep) {
        if (a > cursor) cuts.push([cursor, a]);
        cursor = b;
      }
      if (cursor < end) cuts.push([cursor, end]);
      const trackIds = ctx.project.tracks.filter((t) => !t.locked).map((t) => t.id);
      return {
        summary: `Version courte de ${keep.reduce((s, [a, b]) => s + b - a, 0).toFixed(1)} s composée des ${keep.length} passages les plus intenses. ${method}`,
        actions: keep.map(([a, b]) => `Garder ${a.toFixed(1)} s → ${b.toFixed(1)} s`),
        apply: (project) => [...cuts].reverse().reduce((p, [a, b]) => rippleDelete(p, a, b, trackIds), project),
      };
    }
    return {
      summary: `${moments.length} moment(s) fort(s) repéré(s) par des marqueurs (rien n’est coupé). ${method}`,
      actions: moments.map((m) => `Marqueur à ${m.range[0].toFixed(1)} s`),
      apply: (project) => ({
        ...project,
        markers: [
          ...project.markers,
          ...moments.map((m, i) => ({ id: uid('k'), t: m.range[0], label: `Moment fort ${i + 1}`, color: '#45E5F5' })),
        ],
      }),
    };
  }

  if (has(text, 'scène', 'scene', 'plan')) {
    const clip = targetClips(ctx, ['video'])[0];
    if (!clip) return { message: 'Il faut un clip vidéo.' };
    const cuts = (await detectScenes(clip.mediaId))
      .map((t) => clip.start + (t - clip.in) / clip.speed)
      .filter((t) => t > clip.start + 0.2 && t < clipEnd(clip) - 0.2);
    if (!cuts.length) return { message: 'Aucun changement de scène net détecté dans ce clip.' };
    return {
      summary: `${cuts.length} changement(s) de scène détecté(s) par comparaison d’images : le clip sera divisé à ces endroits.`,
      actions: cuts.map((t) => `Diviser à ${t.toFixed(2)} s`),
      apply: (project) =>
        cuts.reduce(
          (p, t) =>
            splitAt(
              p,
              p.clips.filter((c) => c.mediaId === clip.mediaId && c.trackId === clip.trackId).map((c) => c.id),
              t,
            ).project,
          project,
        ),
    };
  }

  if (has(text, 'normalis')) {
    const clips = mediaClips(ctx);
    const gains = [];
    for (const clip of clips) {
      try {
        gains.push([clip.id, await normalizationGain(clip.mediaId)]);
      } catch {
        /* clips without audio are skipped */
      }
    }
    if (!gains.length) return { message: 'Aucune piste audio exploitable à normaliser.' };
    return {
      summary: `Volume ajusté pour amener le pic de chaque clip à −1 dBFS (${gains.length} clip(s)).`,
      actions: gains.map(([id, g]) => `${ctx.project.clips.find((c) => c.id === id).name || 'Clip'} : volume × ${g.toFixed(2)}`),
      apply: (project) => ({
        ...project,
        clips: project.clips.map((c) => {
          const g = gains.find(([id]) => id === c.id);
          return g ? { ...c, audio: { ...c.audio, volume: Math.min(4, g[1]) } } : c;
        }),
      }),
    };
  }

  const speed = has(text, 'accélère', 'plus vite', 'accelere') ? 2 : has(text, 'ralenti', 'ralentis', 'moins vite') ? 0.5 : null;
  if (speed) {
    const clips = ctx.project.clips.filter((c) => ctx.selection.includes(c.id) && (c.kind === 'video' || c.kind === 'audio'));
    if (!clips.length) return { message: 'Sélectionnez d’abord un clip vidéo ou audio dans la timeline.' };
    return {
      summary: `Vitesse × ${speed} sur ${clips.length} clip(s) ; leur durée est ajustée.`,
      actions: clips.map(
        (c) => `${c.name || 'Clip'} : ${c.duration.toFixed(1)} s → ${((c.duration * c.speed) / (c.speed * speed)).toFixed(1)} s`,
      ),
      apply: (project) => ({
        ...project,
        clips: project.clips.map((c) =>
          clips.some((x) => x.id === c.id) ? { ...c, speed: c.speed * speed, duration: c.duration / speed } : c,
        ),
      }),
    };
  }

  if (has(text, 'sous-titre', 'sous titre', 'transcri')) {
    if (ctx.transcription) {
      return {
        kind: 'transcribe',
        summary: 'Transcrire l’audio du premier clip et créer des sous-titres à vérifier.',
        actions: ['Envoyer l’audio au service de transcription configuré', 'Créer les sous-titres (modifiables)'],
      };
    }
    return {
      message:
        'La transcription automatique n’est pas configurée sur ce serveur (variable OPENAI_TRANSCRIBE_MODEL). Vous pouvez créer des sous-titres manuellement dans l’onglet Sous-titres, ou importer un fichier .srt / .vtt.',
    };
  }

  return { message: `Je ne sais pas encore faire cela. Exemples de demandes comprises :\n• ${ASSISTANT_EXAMPLES.join('\n• ')}` };
}
