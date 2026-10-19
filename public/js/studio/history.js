/**
 * Undo/redo for immutable project snapshots. Each entry stores the project
 * state *before* an action and a human label shown in the history panel.
 */
export class History {
  constructor({ limit = 120, onChange } = {}) {
    this.limit = limit;
    this.past = [];
    this.future = [];
    this.onChange = onChange || (() => {});
  }

  /** Records `before` and returns `after`, so callers can write: project = history.commit(label, project, next). */
  commit(label, before, after) {
    if (before === after) return after;
    this.past.push({ label, state: before, at: Date.now() });
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    this.onChange();
    return after;
  }

  undo(current) {
    const entry = this.past.pop();
    if (!entry) return null;
    this.future.push({ label: entry.label, state: current, at: Date.now() });
    this.onChange();
    return { state: entry.state, label: entry.label };
  }

  redo(current) {
    const entry = this.future.pop();
    if (!entry) return null;
    this.past.push({ label: entry.label, state: current, at: Date.now() });
    this.onChange();
    return { state: entry.state, label: entry.label };
  }

  /** Jump back to the state before the n-th most recent action (0 = last). */
  revertTo(index, current) {
    let state = current;
    for (let i = 0; i <= index; i += 1) {
      const step = this.undo(state);
      if (!step) break;
      state = step.state;
    }
    return state;
  }

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  get entries() {
    return [...this.past].reverse();
  }
}
