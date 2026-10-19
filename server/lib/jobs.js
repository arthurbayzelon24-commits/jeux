import { readFile } from 'node:fs/promises';
import { imageDimensions, IMAGE_TYPES, VIDEO_TYPES } from './files.js';
import { applyCamera, applyStyle } from './prompt.js';

export const STATUS = { pending: 'pending', running: 'running', succeeded: 'succeeded', failed: 'failed' };

const MAX_POLL_FAILURES = 3;

/**
 * Runs generation jobs in the background and records their real state on the
 * creation itself, so the gallery and the job endpoint share one source of truth.
 */
export class JobManager {
  constructor({ store, registry, config, sleep = defaultSleep }) {
    this.store = store;
    this.registry = registry;
    this.config = config;
    this.sleep = sleep;
    this.queue = [];
    this.running = new Map(); // creationId -> AbortController
    this.stopping = false;
  }

  /** Re-attaches to work interrupted by a restart. */
  async resume() {
    for (const item of this.store.list()) {
      if (item.status !== STATUS.pending && item.status !== STATUS.running) continue;
      if (item.type === 'video' && item.providerOperation) {
        this.enqueue(item.id);
      } else {
        await this.store.update(item.id, {
          status: STATUS.failed,
          error: 'La génération a été interrompue par un redémarrage du serveur.',
          retryable: true,
          statusText: null,
        });
      }
    }
  }

  async submit(fields) {
    const item = await this.store.create({ ...fields, status: STATUS.pending, statusText: 'En attente d’un créneau de génération' });
    this.enqueue(item.id);
    return item;
  }

  async retry(id) {
    const item = this.store.get(id);
    if (!item || item.status !== STATUS.failed || !item.retryable) return null;
    await this.store.update(id, {
      status: STATUS.pending,
      error: null,
      progress: null,
      providerOperation: null,
      statusText: 'En attente d’un créneau de génération',
    });
    this.enqueue(id);
    return this.store.get(id);
  }

  cancel(id) {
    this.queue = this.queue.filter((queued) => queued !== id);
    this.running.get(id)?.abort();
  }

  stop() {
    this.stopping = true;
    for (const controller of this.running.values()) controller.abort();
  }

  enqueue(id) {
    if (!this.queue.includes(id) && !this.running.has(id)) this.queue.push(id);
    this.pump();
  }

  pump() {
    while (!this.stopping && this.running.size < this.config.maxConcurrentJobs && this.queue.length > 0) {
      const id = this.queue.shift();
      const controller = new AbortController();
      this.running.set(id, controller);
      this.execute(id, controller)
        .catch((error) => console.error('[solvex] tâche', id, error))
        .finally(() => {
          this.running.delete(id);
          this.pump();
        });
    }
  }

  async execute(id, controller) {
    const item = this.store.get(id);
    if (!item) return;
    const provider = this.registry.resolve(item.type, item.providerId);
    if (!provider) {
      await this.fail(id, 'Le fournisseur utilisé pour cette création n’est plus configuré sur le serveur.', false);
      return;
    }
    const timeout = this.config.jobTimeoutMs[item.type];
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)]);
    try {
      if (item.type === 'image') await this.runImage(item, provider, signal);
      else await this.runVideo(item, provider, signal);
    } catch (error) {
      if (this.stopping) return; // leave the record as-is; resume() handles it on next start
      const timedOut = signal.aborted && !controller.signal.aborted;
      const message = timedOut
        ? `Délai maximal dépassé (${Math.round(timeout / 1000)} s). Le fournisseur n’a pas terminé à temps.`
        : controller.signal.aborted
          ? 'Génération annulée.'
          : error.message || 'La génération a échoué.';
      await this.fail(id, message, timedOut || error.retryable !== false);
    }
  }

  async loadInputs(item) {
    const missing = 'Une image importée a expiré ou a été supprimée. Importez-la de nouveau.';
    const images = [];
    for (const uploadId of item.inputs?.uploadIds || []) {
      const upload = await this.store.readUpload(uploadId);
      if (!upload) throw Object.assign(new Error(missing), { retryable: false });
      images.push(upload);
    }
    if (item.inputs?.source) {
      const { creationId, index } = item.inputs.source;
      const source = this.store.get(creationId);
      const output = source?.outputs?.[index];
      const file = output && this.store.mediaPath(output.file);
      if (!file) throw Object.assign(new Error('L’image source n’existe plus dans la galerie.'), { retryable: false });
      images.unshift({ buffer: await readFile(file), mime: output.mime, ext: IMAGE_TYPES[output.mime] });
    }
    let mask = null;
    if (item.inputs?.maskUploadId) {
      mask = await this.store.readUpload(item.inputs.maskUploadId);
      if (!mask) throw Object.assign(new Error(missing), { retryable: false });
    }
    return { images, mask };
  }

  async runImage(item, provider, signal) {
    await this.store.update(item.id, {
      status: STATUS.running,
      statusText: `Génération en cours chez ${provider.vendor}`,
      startedAt: new Date().toISOString(),
    });
    const { images, mask } = await this.loadInputs(item);
    const { aspect, resolution, quality, count, style } = item.params;
    const prompt = applyStyle(item.prompt, style);
    const results =
      item.operation === 'generate'
        ? await provider.generate({ prompt, aspect, resolution, quality, count, references: images, signal })
        : await provider.edit({ prompt, images, mask, aspect, resolution, quality, count, signal });
    signal.throwIfAborted(); // the creation may have been deleted meanwhile
    const outputs = [];
    for (const [index, result] of results.entries()) {
      const ext = IMAGE_TYPES[result.mime] || 'png';
      const file = await this.store.saveMedia(item.id, index, result.buffer, ext);
      outputs.push({ file, mime: result.mime, ...(imageDimensions(result.buffer, result.mime) || {}), bytes: result.buffer.length });
    }
    await this.succeed(item, outputs);
  }

  async runVideo(item, provider, signal) {
    let operation = item.providerOperation;
    if (!operation) {
      const { images } = await this.loadInputs(item);
      const { aspect, duration, resolution, negativePrompt } = item.params;
      ({ operation } = await provider.start({ prompt: applyCamera(applyStyle(item.prompt, item.params.style), item.params.camera), negativePrompt, aspect, duration, resolution, startImage: images[0], signal }));
      await this.store.update(item.id, {
        status: STATUS.running,
        providerOperation: operation,
        startedAt: new Date().toISOString(),
        statusText: 'Tâche acceptée par le fournisseur',
      });
    }
    let failures = 0;
    for (;;) {
      await this.sleep(this.config.videoPollIntervalMs, signal);
      let state;
      try {
        state = await provider.poll(operation, { signal });
        failures = 0;
      } catch (error) {
        if (signal.aborted || !error.retryable || ++failures >= MAX_POLL_FAILURES) throw error;
        continue;
      }
      // Never write a stale state once this run has been cancelled or superseded.
      signal.throwIfAborted();
      if (state.state === 'running') {
        await this.store.update(item.id, {
          status: STATUS.running,
          progress: state.progress,
          statusText: 'Rendu en cours chez le fournisseur',
        });
        continue;
      }
      if (state.state === 'failed') {
        await this.fail(item.id, state.error, true);
        return;
      }
      await this.store.update(item.id, { statusText: 'Récupération du fichier vidéo' });
      const video = await provider.download(state.result, { signal });
      signal.throwIfAborted();
      const file = await this.store.saveMedia(item.id, 0, video.buffer, VIDEO_TYPES[video.mime] || 'mp4');
      await this.succeed(item, [{ file, mime: video.mime, bytes: video.buffer.length }]);
      return;
    }
  }

  async succeed(item, outputs) {
    await this.store.update(item.id, {
      status: STATUS.succeeded,
      outputs,
      progress: null,
      error: null,
      statusText: null,
      completedAt: new Date().toISOString(),
    });
    // Uploaded inputs are only needed while the job can still run: drop them now.
    for (const uploadId of [...(item.inputs?.uploadIds || []), item.inputs?.maskUploadId].filter(Boolean)) {
      await this.store.deleteUpload(uploadId);
    }
  }

  async fail(id, message, retryable) {
    await this.store.update(id, { status: STATUS.failed, error: message, retryable, progress: null, statusText: null });
  }
}

function defaultSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
