import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { HttpError, readBody, readJson, sendJson } from '../lib/http.js';
import { inspectImage, mimeFromExtension } from '../lib/files.js';
import { isValidId } from '../lib/store.js';
import { canEnhanceWithModel, enhanceLocally, enhanceWithModel, STYLES } from '../lib/prompt.js';
import { transcribe } from '../lib/transcribe.js';
import * as v from '../lib/validate.js';

const VARIATION_INSTRUCTION =
  'Crée une variation de cette image : conserve le sujet, la composition générale et le style, avec des différences de détails naturelles.';

const EDIT_OPERATIONS = {
  edit: { label: 'Modification par instruction', needsPrompt: true, build: (p) => p },
  objects: { label: 'Ajout ou suppression d’objets', needsPrompt: true, build: (p) => `${p}\nNe modifie rien d’autre dans l’image.` },
  background: {
    label: 'Remplacement de l’arrière-plan',
    needsPrompt: true,
    build: (p) =>
      `Remplace uniquement l’arrière-plan par : ${p}. Conserve le sujet principal, sa forme, ses couleurs et son éclairage intacts.`,
  },
  relight: {
    label: 'Correction lumière et couleurs (IA)',
    needsPrompt: false,
    build: (p) =>
      p || 'Corrige l’exposition, la balance des blancs et les couleurs pour un rendu naturel et équilibré, sans modifier le contenu.',
  },
  variation: { label: 'Variation', needsPrompt: false, build: (p) => p || VARIATION_INSTRUCTION },
};

export function publicCreation(item) {
  const { inputs, providerOperation, ...rest } = item;
  return {
    ...rest,
    hasReference: Boolean(inputs?.uploadIds?.length || inputs?.source),
    outputs: item.outputs.map((output) => ({ ...output, url: `/api/media/${output.file}` })),
  };
}

export function createApiRoutes({ config, store, registry, jobs, limiter, auth, ip }) {
  const routes = [];
  const add = (method, pattern, handler, { open = false } = {}) => routes.push({ method, pattern, handler, open });

  function requireProvider(kind, id) {
    const provider = registry.resolve(kind, id || undefined);
    if (!provider) {
      const label = kind === 'image' ? 'génération d’images' : 'génération de vidéos';
      throw new HttpError(503, `Aucun fournisseur de ${label} n’est configuré sur le serveur.`, { code: 'provider_not_configured' });
    }
    return provider;
  }

  async function ensureUploads(ids) {
    for (const id of ids) {
      if (!(await store.readUpload(id)))
        throw new HttpError(400, 'Une image importée a expiré. Importez-la de nouveau.', { code: 'upload_expired' });
    }
  }

  function parseSource(body) {
    if (body.source) {
      const { creationId, index = 0 } = body.source;
      if (!isValidId(creationId)) throw new HttpError(400, 'Image source invalide.', { code: 'invalid_request' });
      const item = store.get(creationId);
      const output = item?.outputs?.[index];
      if (!output || item.type !== 'image') throw new HttpError(404, 'Image source introuvable.', { code: 'not_found' });
      return { source: { creationId, index: Number(index) }, uploadIds: [] };
    }
    const uploadId = v.optionalId(body.uploadId, 'uploadId');
    if (!uploadId) throw new HttpError(400, 'Choisissez une image à modifier.', { code: 'invalid_request' });
    return { source: null, uploadIds: [uploadId] };
  }

  add('GET', /^\/api\/health$/, (req, res) => sendJson(res, 200, { ok: true }), { open: true });

  add(
    'GET',
    /^\/api\/session$/,
    (req, res) => sendJson(res, 200, { authRequired: auth.enabled, authenticated: auth.isAuthenticated(req) }),
    { open: true },
  );

  add(
    'POST',
    /^\/api\/session$/,
    async (req, res) => {
      limiter.check(`login:${ip(req)}`, 10);
      const body = await readJson(req);
      if (!auth.enabled) return sendJson(res, 200, { authenticated: true });
      if (!auth.checkCode(body.code)) throw new HttpError(401, 'Code d’accès incorrect.', { code: 'invalid_code' });
      sendJson(res, 200, { authenticated: true }, { 'Set-Cookie': auth.cookieHeader() });
    },
    { open: true },
  );

  add(
    'DELETE',
    /^\/api\/session$/,
    (req, res) => sendJson(res, 200, { authenticated: false }, { 'Set-Cookie': auth.clearCookieHeader() }),
    {
      open: true,
    },
  );

  add('GET', /^\/api\/capabilities$/, (req, res) => {
    sendJson(res, 200, {
      providers: registry.describe(),
      styles: Object.entries(STYLES).map(([id, style]) => ({ id, label: style.label })),
      promptEnhancement: canEnhanceWithModel(config) ? { method: 'model', model: config.openai.textModel } : { method: 'local' },
      limits: { maxUploadBytes: config.maxUploadBytes, maxPromptLength: v.MAX_PROMPT_LENGTH },
      editOperations: Object.entries(EDIT_OPERATIONS).map(([id, op]) => ({ id, label: op.label, needsPrompt: op.needsPrompt })),
      transcription:
        config.openai.apiKey && config.openai.transcribeModel
          ? { model: config.openai.transcribeModel, maxBytes: config.maxTranscribeBytes }
          : null,
    });
  });

  add('POST', /^\/api\/uploads$/, async (req, res) => {
    limiter.check(`upload:${ip(req)}`, config.rateLimit.uploadPerMinute);
    const buffer = await readBody(req, config.maxUploadBytes);
    const info = inspectImage(buffer);
    if (!info.ok) throw new HttpError(415, info.reason, { code: 'invalid_file' });
    const { ok, ...meta } = info;
    const id = await store.saveUpload(buffer, meta);
    sendJson(res, 201, { id, ...meta, bytes: buffer.length });
  });

  add('POST', /^\/api\/transcribe$/, async (req, res) => {
    if (!config.openai.apiKey || !config.openai.transcribeModel) {
      throw new HttpError(503, 'La transcription n’est pas configurée (OPENAI_TRANSCRIBE_MODEL).', { code: 'provider_not_configured' });
    }
    const type = String(req.headers['content-type'] || '').split(';')[0];
    if (!/^(audio|video)\//.test(type)) throw new HttpError(415, 'Envoyez un fichier audio ou vidéo.', { code: 'invalid_file' });
    limiter.check(`generate:${ip(req)}`, config.rateLimit.generatePerMinute);
    const buffer = await readBody(req, config.maxTranscribeBytes);
    const result = await transcribe(config, { buffer, mime: type }, { signal: AbortSignal.timeout(280_000) });
    sendJson(res, 200, result);
  });

  add('POST', /^\/api\/prompt\/enhance$/, async (req, res) => {
    limiter.check(`enhance:${ip(req)}`, config.rateLimit.enhancePerMinute);
    const body = await readJson(req);
    const prompt = v.requiredPrompt(body.prompt, 'Écrivez d’abord une description à améliorer.');
    const kind = body.kind === 'video' ? 'video' : 'image';
    const style = v.styleId(body.style);
    if (canEnhanceWithModel(config)) {
      const text = await enhanceWithModel(config, { prompt, kind, style }, { signal: AbortSignal.timeout(30_000) });
      return sendJson(res, 200, { prompt: text, method: 'model', model: config.openai.textModel });
    }
    sendJson(res, 200, { prompt: enhanceLocally(prompt, { kind, style }), method: 'local' });
  });

  add('POST', /^\/api\/images\/generate$/, async (req, res) => {
    const body = await readJson(req);
    const provider = requireProvider('image', body.provider);
    const caps = provider.capabilities;
    const referenceUploadIds = v.uploadIdList(body.referenceUploadIds, caps.maxReferenceImages);
    let prompt = v.optionalPrompt(body.prompt);
    let autoPrompt = false;
    if (!prompt && referenceUploadIds.length > 0 && !caps.imageOnly) {
      prompt = VARIATION_INSTRUCTION;
      autoPrompt = true;
    }
    if (!prompt) v.requiredPrompt(prompt);
    const params = {
      style: v.styleId(body.style),
      aspect: v.oneOf(
        body.aspect,
        caps.aspects.map((a) => a.id),
        'aspect',
        'Format',
      ),
      resolution: v.oneOf(
        body.resolution || 'standard',
        caps.resolutions.map((r) => r.id),
        'resolution',
        'Résolution',
      ),
      quality: v.oneOf(
        body.quality || 'auto',
        caps.qualities.map((q) => q.id),
        'quality',
        'Qualité',
      ),
      count: v.intInRange(body.count ?? 1, 1, caps.maxImages, 'count', 'Le nombre d’images'),
    };
    provider.sizeFor(params.aspect, params.resolution);
    await ensureUploads(referenceUploadIds);
    limiter.check(`generate:${ip(req)}`, config.rateLimit.generatePerMinute);
    const item = await jobs.submit({
      type: 'image',
      operation: 'generate',
      operationLabel: referenceUploadIds.length ? 'Image vers image' : 'Texte vers image',
      prompt,
      autoPrompt,
      params,
      providerId: provider.id,
      model: provider.model,
      inputs: { uploadIds: referenceUploadIds },
    });
    sendJson(res, 202, { creation: publicCreation(item) });
  });

  add('POST', /^\/api\/images\/edit$/, async (req, res) => {
    const body = await readJson(req);
    const provider = requireProvider('image', body.provider);
    const op = EDIT_OPERATIONS[body.operation];
    if (!op) throw new HttpError(400, 'Opération de retouche inconnue.', { code: 'invalid_request' });
    const userPrompt = op.needsPrompt
      ? v.requiredPrompt(body.prompt, 'Décrivez la modification souhaitée.')
      : v.optionalPrompt(body.prompt);
    const { source, uploadIds } = parseSource(body);
    const maskUploadId = v.optionalId(body.maskUploadId, 'maskUploadId');
    if (maskUploadId && !provider.capabilities.mask)
      throw new HttpError(400, 'Ce modèle ne prend pas en charge les masques.', { code: 'unsupported_option' });
    await ensureUploads([...uploadIds, ...(maskUploadId ? [maskUploadId] : [])]);
    if (maskUploadId) {
      const mask = await store.readUpload(maskUploadId);
      if (mask.mime !== 'image/png') throw new HttpError(400, 'Le masque doit être une image PNG.', { code: 'invalid_file' });
    }
    limiter.check(`generate:${ip(req)}`, config.rateLimit.generatePerMinute);
    const item = await jobs.submit({
      type: 'image',
      operation: body.operation,
      operationLabel: op.label,
      prompt: op.build(userPrompt),
      autoPrompt: !userPrompt,
      params: { quality: 'auto', count: 1, style: 'personnalise', aspect: null, resolution: null, masked: Boolean(maskUploadId) },
      providerId: provider.id,
      model: provider.model,
      inputs: { uploadIds, source, maskUploadId },
      parentId: source?.creationId || null,
    });
    sendJson(res, 202, { creation: publicCreation(item) });
  });

  add('POST', /^\/api\/videos\/generate$/, async (req, res) => {
    const body = await readJson(req);
    const provider = requireProvider('video', body.provider);
    const prompt = v.requiredPrompt(body.prompt, 'Décrivez la scène à générer.');
    const startUploadId = v.optionalId(body.startUploadId, 'startUploadId');
    const params = {
      aspect: String(body.aspect || ''),
      duration: Number(body.duration),
      resolution: String(body.resolution || ''),
    };
    const startImage = startUploadId ? await store.readUpload(startUploadId) : null;
    if (startUploadId && !startImage)
      throw new HttpError(400, 'L’image de départ a expiré. Importez-la de nouveau.', { code: 'upload_expired' });
    const problem = provider.validate({ ...params, startImage });
    if (problem) throw new HttpError(400, problem, { code: 'unsupported_option' });
    limiter.check(`generate:${ip(req)}`, config.rateLimit.generatePerMinute);
    const item = await jobs.submit({
      type: 'video',
      operation: 'generate',
      operationLabel: startUploadId ? 'Image vers vidéo' : 'Texte vers vidéo',
      prompt,
      params,
      providerId: provider.id,
      model: provider.model,
      inputs: { uploadIds: startUploadId ? [startUploadId] : [] },
    });
    sendJson(res, 202, { creation: publicCreation(item) });
  });

  add('GET', /^\/api\/creations$/, (req, res, match, url) => {
    const type = url.searchParams.get('type');
    const sort = url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc';
    const list = store.list({ type: type === 'image' || type === 'video' ? type : undefined, sort });
    sendJson(res, 200, { creations: list.map(publicCreation) });
  });

  add('POST', /^\/api\/creations\/local$/, async (req, res) => {
    const body = await readJson(req);
    const uploadId = v.optionalId(body.uploadId, 'uploadId');
    const upload = uploadId && (await store.readUpload(uploadId));
    if (!upload) throw new HttpError(400, 'Résultat introuvable. Relancez le traitement.', { code: 'upload_expired' });
    const operationLabel = typeof body.operationLabel === 'string' ? body.operationLabel.slice(0, 80) : 'Retouche locale';
    const parentId = v.optionalId(body.parentId, 'parentId');
    const now = new Date().toISOString();
    const item = await store.create({
      type: 'image',
      operation: 'local',
      operationLabel,
      prompt: '',
      params: {},
      providerId: 'local',
      model: 'Traitement local dans le navigateur (sans IA)',
      inputs: {},
      parentId,
      status: 'succeeded',
      completedAt: now,
    });
    const file = await store.saveMedia(item.id, 0, upload.buffer, upload.ext);
    await store.update(item.id, {
      outputs: [{ file, mime: upload.mime, width: upload.width, height: upload.height, bytes: upload.buffer.length }],
    });
    await store.deleteUpload(uploadId);
    sendJson(res, 201, { creation: publicCreation(store.get(item.id)) });
  });

  add('GET', /^\/api\/creations\/([\w-]+)$/, (req, res, match) => {
    const item = isValidId(match[1]) && store.get(match[1]);
    if (!item) throw new HttpError(404, 'Création introuvable.', { code: 'not_found' });
    sendJson(res, 200, { creation: publicCreation(item) });
  });

  add('POST', /^\/api\/creations\/([\w-]+)\/retry$/, async (req, res, match) => {
    if (!isValidId(match[1]) || !store.get(match[1])) throw new HttpError(404, 'Création introuvable.', { code: 'not_found' });
    limiter.check(`generate:${ip(req)}`, config.rateLimit.generatePerMinute);
    const item = await jobs.retry(match[1]);
    if (!item) throw new HttpError(409, 'Cette création ne peut pas être relancée.', { code: 'not_retryable' });
    sendJson(res, 202, { creation: publicCreation(item) });
  });

  add('DELETE', /^\/api\/creations\/([\w-]+)$/, async (req, res, match) => {
    const item = isValidId(match[1]) && store.get(match[1]);
    if (!item) throw new HttpError(404, 'Création introuvable.', { code: 'not_found' });
    jobs.cancel(item.id);
    await store.remove(item.id);
    for (const uploadId of [...(item.inputs?.uploadIds || []), item.inputs?.maskUploadId].filter(Boolean)) {
      await store.deleteUpload(uploadId);
    }
    sendJson(res, 200, { deleted: true });
  });

  add('GET', /^\/api\/media\/([\w.-]+)$/, async (req, res, match, url) => {
    const file = store.mediaPath(match[1]);
    const info = file && (await stat(file).catch(() => null));
    if (!info) throw new HttpError(404, 'Fichier introuvable.', { code: 'not_found' });
    const mime = mimeFromExtension(match[1].split('.').pop());
    const headers = {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=3600',
      'Accept-Ranges': 'bytes',
      'X-Content-Type-Options': 'nosniff',
    };
    if (url.searchParams.get('download') === '1') {
      headers['Content-Disposition'] = `attachment; filename="solvex-${match[1]}"`;
    }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : info.size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : info.size - 1;
      start = Math.max(0, start);
      end = Math.min(end, info.size - 1);
      if (start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    createReadStream(file).pipe(res);
  });

  return routes;
}
