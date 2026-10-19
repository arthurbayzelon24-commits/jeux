import { ASPECTS, RESOLUTIONS, QUALITY_TIERS } from '../../public/js/shared/imageSizes.js';
import { STYLES } from '../../public/js/shared/styles.js';
import { MUSIC_CATEGORIES, AUDIO_CATEGORIES, searchCatalog, CATALOG } from '../../public/js/shared/audioCatalog.js';
import { CAMERA_MOVES } from '../lib/prompt.js';

/**
 * The tools SOLVEX AI may use. The model only proposes a call; the server
 * validates every argument against the schema below, then runs real SOLVEX
 * functions. There is no generic « run code » or « read file » tool, no
 * access to keys, and nothing destructive. Changes to a project and saved
 * memories are only proposed: the user confirms them in the page.
 */

export class ToolInputError extends Error {}

/** Minimal JSON-schema check (the subset used below). Unknown properties are dropped. */
export function validate(schema, value, path = 'arguments') {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ToolInputError(`${path} doit être un objet.`);
    const out = {};
    for (const key of schema.required || []) if (value[key] === undefined || value[key] === null || value[key] === '') throw new ToolInputError(`${path}.${key} est obligatoire.`);
    for (const [key, sub] of Object.entries(schema.properties || {})) if (value[key] !== undefined && value[key] !== null) out[key] = validate(sub, value[key], `${path}.${key}`);
    return out;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new ToolInputError(`${path} doit être une liste.`);
    if (schema.maxItems && value.length > schema.maxItems) throw new ToolInputError(`${path} : ${schema.maxItems} éléments au plus.`);
    return value.map((item, i) => validate(schema.items, item, `${path}[${i}]`));
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') throw new ToolInputError(`${path} doit être un texte.`);
    const text = value.trim();
    if (schema.enum && !schema.enum.includes(text)) throw new ToolInputError(`${path} : valeur « ${text.slice(0, 40)} » non autorisée.`);
    if (schema.maxLength && text.length > schema.maxLength) throw new ToolInputError(`${path} : ${schema.maxLength} caractères au plus.`);
    if (schema.pattern && !new RegExp(schema.pattern).test(text)) throw new ToolInputError(`${path} : format invalide.`);
    return text;
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n) || (schema.type === 'integer' && !Number.isInteger(n))) throw new ToolInputError(`${path} doit être un nombre.`);
    if (schema.enum && !schema.enum.includes(n)) throw new ToolInputError(`${path} : valeur non autorisée.`);
    if (schema.minimum !== undefined && n < schema.minimum) throw new ToolInputError(`${path} : minimum ${schema.minimum}.`);
    if (schema.maximum !== undefined && n > schema.maximum) throw new ToolInputError(`${path} : maximum ${schema.maximum}.`);
    return n;
  }
  if (schema.type === 'boolean') return Boolean(value);
  throw new ToolInputError(`${path} : type inconnu.`);
}

const ID = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' };
const summarize = (c) => ({
  id: c.id,
  type: c.type,
  status: c.status,
  operation: c.operationLabel,
  prompt: c.autoPrompt ? null : c.prompt?.slice(0, 300),
  model: c.model,
  params: { aspect: c.params?.aspect, resolution: c.params?.resolution, quality: c.params?.quality, duration: c.params?.duration },
  outputs: (c.outputs || []).map((o) => ({ width: o.width, height: o.height, mime: o.mime })),
  error: c.error || undefined,
  createdAt: c.createdAt,
});

/**
 * Builds the toolbox for one request. `deps` gives access to the real SOLVEX
 * functions (job submission, creation store, provider registry).
 */
export function createToolbox({ registry, store, submitImage, submitVideo, submitEdit, publicCreation, clientIp, project }) {
  const image = registry.resolve('image');
  const video = registry.resolve('video');
  const editor = registry.all().find((p) => p.kind === 'image' && p.isConfigured() && p.capabilities.edit) || null;

  const tools = [
    {
      name: 'generate_image',
      description: 'Lance une vraie génération d’image (tâche asynchrone). Uniquement si l’utilisateur veut obtenir une image.',
      available: Boolean(image),
      unavailable: 'Aucun service de génération d’images n’est configuré.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', maxLength: 4000, description: 'Description détaillée : sujet, cadrage, lumière, couleurs, ambiance.' },
          aspect: { type: 'string', enum: ASPECTS.map((a) => a.id), description: 'Format (9:16 réseaux verticaux, 16:9 YouTube…).' },
          resolution: { type: 'string', enum: RESOLUTIONS.map((r) => r.id), description: 'Côté long : 512 px à 3840 px (4K). 1080p par défaut.' },
          quality: { type: 'string', enum: QUALITY_TIERS.map((q) => q.id) },
          style: { type: 'string', enum: Object.keys(STYLES) },
        },
        required: ['prompt', 'aspect'],
      },
      async run(args) {
        const caps = image.capabilities;
        const aspect = caps.aspects.find((a) => a.id === args.aspect) ? args.aspect : '1:1';
        const sizes = caps.aspects.find((a) => a.id === aspect)?.resolutions || [];
        const resolution = sizes.some((r) => r.id === args.resolution) ? args.resolution : sizes.find((r) => r.id === '1080p')?.id || sizes[0]?.id;
        const quality = caps.qualities.some((q) => q.id === args.quality) ? args.quality : undefined;
        const item = await submitImage({ prompt: args.prompt, aspect, resolution, quality, style: args.style || 'personnalise', provider: image.id }, clientIp);
        return {
          result: { status: 'started', creation_id: item.id, size: `${item.params.requestedWidth}x${item.params.requestedHeight}`, aspect, quality: item.params.quality, model: item.model, note: 'Génération lancée, pas encore terminée.' },
          action: { type: 'creation', creation: publicCreation(item) },
        };
      },
    },
    {
      name: 'generate_video',
      description: 'Lance une vraie génération de courte vidéo (quelques secondes). Uniquement si l’utilisateur veut obtenir une vidéo.',
      available: Boolean(video),
      unavailable: 'Aucun service de génération de vidéos n’est configuré (GEMINI_API_KEY manquante).',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', maxLength: 4000, description: 'Scène, action, mouvement, lumière.' },
          aspect: { type: 'string', enum: ['16:9', '9:16'] },
          duration: { type: 'integer', enum: [4, 6, 8] },
          style: { type: 'string', enum: Object.keys(STYLES) },
          camera: { type: 'string', enum: Object.keys(CAMERA_MOVES) },
        },
        required: ['prompt', 'aspect'],
      },
      async run(args) {
        const vc = video.capabilities;
        const aspect = vc.aspects.some((a) => a.id === args.aspect) ? args.aspect : vc.aspects[0].id;
        const duration = vc.durations.includes(args.duration) ? args.duration : vc.durations.at(-1);
        const resolution = vc.resolutions.find((r) => !r.requiresDuration || r.requiresDuration === duration)?.id;
        const item = await submitVideo({ prompt: args.prompt, aspect, duration, resolution, style: args.style || 'personnalise', camera: args.camera, provider: video.id }, clientIp);
        return {
          result: { status: 'started', creation_id: item.id, aspect, duration, resolution, model: item.model, note: 'Génération lancée ; une vidéo prend souvent plusieurs minutes.' },
          action: { type: 'creation', creation: publicCreation(item) },
        };
      },
    },
    {
      name: 'edit_image',
      description: 'Modifie une image déjà générée (plus lumineuse, autre arrière-plan, variante…) avec le service de retouche IA. Crée une nouvelle image, l’originale est conservée.',
      available: Boolean(editor),
      unavailable: 'Aucun service de retouche d’image par IA n’est configuré (OPENAI_API_KEY nécessaire ; Pollinations ne fait pas de retouche).',
      parameters: {
        type: 'object',
        properties: {
          creation_id: { ...ID, description: 'Identifiant de l’image (voir « Créations récentes »).' },
          instruction: { type: 'string', maxLength: 2000, description: 'Ce qu’il faut changer.' },
          mode: { type: 'string', enum: ['edit', 'relight', 'background', 'variation'], description: 'edit = instruction libre ; relight = lumière/couleurs ; background = arrière-plan ; variation.' },
        },
        required: ['creation_id', 'mode'],
      },
      async run(args) {
        const item = await submitEdit({ operation: args.mode, prompt: args.instruction, source: { creationId: args.creation_id, index: 0 }, provider: editor.id }, clientIp);
        return {
          result: { status: 'started', creation_id: item.id, source_id: args.creation_id, operation: item.operationLabel, note: 'Retouche lancée, pas encore terminée.' },
          action: { type: 'creation', creation: publicCreation(item) },
        };
      },
    },
    {
      name: 'get_creation',
      description: 'Consulte l’état réel d’une création (en attente, en cours, terminée, échouée) et ses dimensions.',
      available: true,
      parameters: { type: 'object', properties: { creation_id: ID }, required: ['creation_id'] },
      async run(args) {
        const item = store.get(args.creation_id);
        if (!item) throw new ToolInputError('Création introuvable.');
        return { result: summarize(item) };
      },
    },
    {
      name: 'list_creations',
      description: 'Liste les dernières créations (images, vidéos) avec leur identifiant et leur description.',
      available: true,
      parameters: { type: 'object', properties: { type: { type: 'string', enum: ['image', 'video'] }, limit: { type: 'integer', minimum: 1, maximum: 10 } } },
      async run(args) {
        const list = store.list({ type: args.type }).slice(0, args.limit || 5);
        return { result: list.map(summarize) };
      },
    },
    {
      name: 'search_music',
      description: 'Cherche des musiques ou des sons dans la bibliothèque SOLVEX (créations originales libres de droits).',
      available: true,
      parameters: { type: 'object', properties: { query: { type: 'string', maxLength: 120 }, category: { type: 'string', enum: AUDIO_CATEGORIES } }, required: ['query'] },
      async run(args) {
        const items = searchCatalog({ query: args.query, category: args.category }, 6);
        return {
          result: items.length ? items.map(({ id, title, category, tags, duration }) => ({ id, title, category, tags, duration })) : { found: 0, categories: MUSIC_CATEGORIES },
          action: items.length ? { type: 'music', items: items.map(({ id, title, category, duration }) => ({ id, title, category, duration })) } : null,
        };
      },
    },
    {
      name: 'get_project',
      description: 'Lit le projet que l’utilisateur a joint à la conversation (montage vidéo ou photo) : clips, textes, durée, format.',
      available: Boolean(project),
      unavailable: 'Aucun projet n’est joint à la conversation : l’utilisateur peut en choisir un en haut de la discussion.',
      parameters: { type: 'object', properties: {} },
      async run() {
        return { result: project };
      },
    },
    {
      name: 'propose_project_edit',
      description:
        'Propose des modifications du projet joint (titres, musique, transitions, nom). Rien n’est appliqué tant que l’utilisateur n’a pas confirmé dans la page.',
      available: Boolean(project),
      unavailable: 'Aucun projet n’est joint à la conversation.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', maxLength: 300, description: 'Résumé de la proposition, en une phrase.' },
          operations: {
            type: 'array',
            maxItems: 12,
            items: {
              type: 'object',
              properties: {
                op: { type: 'string', enum: ['add_title', 'add_music', 'set_transitions', 'rename_project'] },
                text: { type: 'string', maxLength: 200, description: 'add_title : texte affiché.' },
                start: { type: 'number', minimum: 0, maximum: 3600, description: 'add_title : début en secondes.' },
                duration: { type: 'number', minimum: 0.5, maximum: 60, description: 'add_title : durée en secondes.' },
                style_id: { type: 'string', pattern: '^[a-z0-9-]{1,40}$', description: 'add_title : modèle de texte stylisé (ex. cine-epopee, neon-cyan, sub-boite, badge-nouveau, grad-aurore).' },
                catalog_id: { type: 'string', pattern: '^(music|ambience|sfx):[a-z0-9-]{1,40}$', description: 'add_music : identifiant trouvé avec search_music.' },
                transition: { type: 'string', enum: ['fade', 'crossfade', 'fade-black', 'dissolve', 'slide', 'wipe', 'zoom-in', 'zoom-out', 'blur', 'flash', 'glitch'], description: 'set_transitions : transition d’entrée pour tous les clips.' },
                name: { type: 'string', maxLength: 80, description: 'rename_project : nouveau nom.' },
              },
              required: ['op'],
            },
          },
        },
        required: ['summary', 'operations'],
      },
      async run(args) {
        for (const o of args.operations) {
          if (o.op === 'add_title' && !o.text) throw new ToolInputError('add_title demande un texte.');
          if (o.op === 'add_music' && !CATALOG.some((c) => c.id === o.catalog_id)) throw new ToolInputError(`Musique ${o.catalog_id || '?'} introuvable : utilisez search_music.`);
          if (o.op === 'set_transitions' && !o.transition) throw new ToolInputError('set_transitions demande une transition.');
          if (o.op === 'rename_project' && !o.name) throw new ToolInputError('rename_project demande un nom.');
        }
        return {
          result: { status: 'awaiting_user_confirmation', note: 'Proposition affichée ; elle ne sera appliquée que si l’utilisateur la confirme.' },
          action: { type: 'project_proposal', projectId: project.id, projectName: project.name, summary: args.summary, operations: args.operations },
        };
      },
    },
    {
      name: 'open_in_editor',
      description: 'Propose d’ouvrir une création terminée dans l’éditeur photo ou vidéo (l’utilisateur clique pour confirmer).',
      available: true,
      parameters: { type: 'object', properties: { creation_id: ID, editor: { type: 'string', enum: ['photo', 'video'] } }, required: ['creation_id'] },
      async run(args) {
        const item = store.get(args.creation_id);
        if (!item) throw new ToolInputError('Création introuvable.');
        if (item.status !== 'succeeded') throw new ToolInputError(`Cette création n’est pas terminée (statut : ${item.status}).`);
        return { result: { status: 'awaiting_user_confirmation' }, action: { type: 'open_in_editor', creation: publicCreation(item), editor: args.editor || (item.type === 'video' ? 'video' : 'photo') } };
      },
    },
    {
      name: 'remember_preference',
      description:
        'Propose d’enregistrer une préférence durable que l’utilisateur a exprimée (style, formats, ton…). Jamais d’information personnelle sensible. L’utilisateur confirme ou refuse.',
      available: true,
      parameters: { type: 'object', properties: { text: { type: 'string', maxLength: 200 } }, required: ['text'] },
      async run(args) {
        return { result: { status: 'awaiting_user_confirmation' }, action: { type: 'memory_proposal', text: args.text } };
      },
    },
  ];

  return {
    /** Definitions sent to the model: only the tools that can work right now. */
    definitions: () => tools.filter((t) => t.available).map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
    availability: () => tools.map((t) => ({ name: t.name, available: t.available, reason: t.available ? null : t.unavailable })),
    async run(name, rawArgs) {
      const tool = tools.find((t) => t.name === name);
      if (!tool) throw new ToolInputError(`Outil « ${String(name).slice(0, 40)} » inexistant ou non autorisé.`);
      if (!tool.available) throw new ToolInputError(tool.unavailable);
      let parsed;
      try {
        parsed = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs || {};
      } catch {
        throw new ToolInputError('Arguments illisibles (JSON invalide).');
      }
      return tool.run(validate(tool.parameters, parsed));
    },
  };
}
