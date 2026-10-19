import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;
const FILE_PATTERN = /^[a-zA-Z0-9-]{8,64}(?:-\d+)?\.(png|jpg|webp|mp4)$/;

export const isValidId = (id) => typeof id === 'string' && ID_PATTERN.test(id);
export const isValidMediaName = (name) => typeof name === 'string' && FILE_PATTERN.test(name);

/**
 * Creations are kept in a single JSON document on disk (data/creations.json)
 * and their media files in data/media. Writes are serialized and atomic.
 */
export class CreationStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.mediaDir = path.join(dataDir, 'media');
    this.uploadDir = path.join(dataDir, 'uploads');
    this.file = path.join(dataDir, 'creations.json');
    this.items = new Map();
    this.writeChain = Promise.resolve();
  }

  async init() {
    await mkdir(this.mediaDir, { recursive: true });
    await mkdir(this.uploadDir, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      for (const item of parsed.creations || []) this.items.set(item.id, item);
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Impossible de lire ${this.file} : ${error.message}`);
    }
  }

  list({ type, sort = 'desc' } = {}) {
    let list = [...this.items.values()];
    if (type) list = list.filter((item) => item.type === type);
    list.sort((a, b) => (sort === 'asc' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
    return list;
  }

  get(id) {
    return this.items.get(id) || null;
  }

  async create(fields) {
    const now = new Date().toISOString();
    const item = {
      id: randomUUID(),
      status: 'pending',
      outputs: [],
      progress: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      ...fields,
    };
    this.items.set(item.id, item);
    await this.persist();
    return item;
  }

  async update(id, patch) {
    const item = this.items.get(id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return item;
  }

  async remove(id) {
    const item = this.items.get(id);
    if (!item) return false;
    this.items.delete(id);
    await this.persist();
    await Promise.all(item.outputs.map((output) => rm(path.join(this.mediaDir, output.file), { force: true })));
    return true;
  }

  async saveMedia(creationId, index, buffer, ext) {
    const file = `${creationId}-${index}.${ext}`;
    await writeFile(path.join(this.mediaDir, file), buffer);
    return file;
  }

  mediaPath(file) {
    if (!isValidMediaName(file)) return null;
    return path.join(this.mediaDir, file);
  }

  // --- temporary uploads (reference images, masks, start frames) ---

  async saveUpload(buffer, meta) {
    const id = randomUUID();
    await writeFile(path.join(this.uploadDir, `${id}.${meta.ext}`), buffer);
    await writeFile(path.join(this.uploadDir, `${id}.json`), JSON.stringify({ ...meta, id, createdAt: Date.now() }));
    return id;
  }

  async readUpload(id) {
    if (!isValidId(id)) return null;
    try {
      const meta = JSON.parse(await readFile(path.join(this.uploadDir, `${id}.json`), 'utf8'));
      const buffer = await readFile(path.join(this.uploadDir, `${id}.${meta.ext}`));
      return { ...meta, buffer };
    } catch {
      return null;
    }
  }

  async deleteUpload(id) {
    if (!isValidId(id)) return;
    const entries = await readdir(this.uploadDir).catch(() => []);
    await Promise.all(
      entries.filter((name) => name.startsWith(`${id}.`)).map((name) => rm(path.join(this.uploadDir, name), { force: true })),
    );
  }

  async pruneUploads(ttlMs) {
    const entries = await readdir(this.uploadDir).catch(() => []);
    const now = Date.now();
    await Promise.all(
      entries.map(async (name) => {
        const full = path.join(this.uploadDir, name);
        const info = await stat(full).catch(() => null);
        if (info && now - info.mtimeMs > ttlMs) await rm(full, { force: true });
      }),
    );
  }

  persist() {
    const snapshot = JSON.stringify({ version: 1, creations: [...this.items.values()] }, null, 2);
    this.writeChain = this.writeChain
      .catch(() => {})
      .then(async () => {
        const tmp = `${this.file}.${process.pid}.tmp`;
        await writeFile(tmp, snapshot);
        await rename(tmp, this.file);
      });
    return this.writeChain;
  }
}
