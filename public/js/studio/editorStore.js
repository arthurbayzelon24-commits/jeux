import { db } from './db.js';
import { History } from './history.js';
import { getPrefs } from '../lib/prefs.js';

/**
 * Single source of truth for an open project. Views subscribe to changes;
 * every user action goes through `commit` (undoable + autosaved), while
 * continuous gestures (drag, sliders) use `preview` and commit once at the end.
 */
export class EditorStore {
  constructor(project) {
    this.project = project;
    this.selection = [];
    this.time = 0;
    this.listeners = new Set();
    this.history = new History({ onChange: () => this.emit('history') });
    this.saveTimer = null;
    this.saving = false;
    this.lastError = null;
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason) {
    for (const fn of this.listeners) fn(reason, this);
  }

  /** Records an undoable change. */
  commit(label, next, { select } = {}) {
    if (!next || next === this.project) return;
    const stamped = { ...next, updatedAt: new Date().toISOString(), saved: false };
    this.project = this.history.commit(label, this.project, stamped);
    if (select) this.selection = select;
    this.selection = this.selection.filter((id) => this.project.clips?.some((c) => c.id === id) ?? true);
    this.journal();
    this.scheduleSave();
    this.emit('project');
  }

  /** Transient change (no history entry); call commit afterwards with the original as base. */
  preview(next) {
    this.project = next;
    this.emit('preview');
  }

  /** Ends a gesture started from `before`: one history entry for the whole gesture. */
  finishGesture(label, before) {
    const after = this.project;
    this.project = before;
    this.commit(label, after);
  }

  undo() {
    const step = this.history.undo(this.project);
    if (!step) return null;
    this.project = { ...step.state, saved: false };
    this.journal();
    this.scheduleSave();
    this.emit('project');
    return step.label;
  }

  redo() {
    const step = this.history.redo(this.project);
    if (!step) return null;
    this.project = { ...step.state, saved: false };
    this.journal();
    this.scheduleSave();
    this.emit('project');
    return step.label;
  }

  select(ids) {
    this.selection = ids;
    this.emit('selection');
  }

  setTime(t) {
    this.time = t;
  }

  // ---------------------------------------------------------------- persistence
  journal() {
    // Crash recovery: the latest state is written immediately, the project record on autosave.
    db.set(`recovery:${this.project.id}`, this.project).catch(() => {});
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    if (!getPrefs().autosave) return;
    this.saveTimer = setTimeout(() => this.save(), getPrefs().autosaveDelay * 1000);
  }

  async save(thumbnail) {
    clearTimeout(this.saveTimer);
    this.saving = true;
    this.emit('saving');
    try {
      const record = { ...this.project, saved: true, thumbnail: thumbnail || this.thumbnailProvider?.() || this.project.thumbnail };
      await db.putProject(record);
      await db.set(`recovery:${record.id}`, undefined);
      this.project = { ...this.project, saved: true, thumbnail: record.thumbnail };
      this.lastError = null;
    } catch (error) {
      this.lastError = error.message || 'Échec de la sauvegarde';
    } finally {
      this.saving = false;
      this.emit('saved');
    }
  }
}

/** Loads a project and, if a newer unsaved journal exists, returns it as `recovery`. */
export async function openProject(id) {
  const project = await db.getProject(id);
  if (!project) return null;
  const recovery = await db.get(`recovery:${id}`).catch(() => null);
  return { project, recovery: recovery && recovery.updatedAt > project.updatedAt ? recovery : null };
}
