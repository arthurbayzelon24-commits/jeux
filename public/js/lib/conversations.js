/**
 * Assistant conversations kept in this browser (localStorage): several
 * conversations, each with a title, dates and its messages. Nothing is sent
 * to the server except the messages of the turn being answered.
 * Pure logic with an injectable storage, so it is tested in Node.
 */
const KEY = 'solvex:chats';
const LEGACY_KEY = 'solvex:chat';
export const DEFAULT_TITLE = 'Nouvelle conversation';

const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage blocked: the list lives for this page only
  }
};

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Title from the first user message: first line, at most 60 characters. */
export function autoTitle(messages) {
  const first = messages.find((m) => m.role === 'user' && m.content?.trim());
  if (!first) return DEFAULT_TITLE;
  const line = first.content.trim().split('\n')[0].replace(/\s+/g, ' ');
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}

export function createConversationStore({ storage = browserStorage(), maxConversations = 50, maxMessages = 80, now = () => new Date().toISOString() } = {}) {
  let state = load();

  function load() {
    try {
      const saved = JSON.parse(storage?.getItem(KEY) ?? 'null');
      if (saved && Array.isArray(saved.conversations)) return { conversations: saved.conversations.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages)), activeId: saved.activeId ?? null };
      // Before 2.4 there was a single conversation: keep it as the first one.
      const legacy = JSON.parse(storage?.getItem(LEGACY_KEY) ?? 'null');
      if (Array.isArray(legacy) && legacy.length) {
        const at = now();
        const c = { id: newId(), title: autoTitle(legacy), auto: true, createdAt: at, updatedAt: at, messages: legacy };
        return { conversations: [c], activeId: c.id };
      }
    } catch {
      // Unreadable data: start empty rather than fail.
    }
    return { conversations: [], activeId: null };
  }

  /** Saves; when storage is full, drops the oldest conversations (never the active one). Returns false if nothing could be saved. */
  function persist() {
    if (!storage) return false;
    for (;;) {
      try {
        storage.setItem(KEY, JSON.stringify(state));
        storage.removeItem(LEGACY_KEY);
        return true;
      } catch {
        const victims = list().filter((c) => c.id !== state.activeId);
        if (!victims.length) return false;
        remove(victims.at(-1).id, { save: false });
      }
    }
  }

  function list() {
    return [...state.conversations].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  const get = (id) => state.conversations.find((c) => c.id === id) || null;

  function create() {
    const at = now();
    const c = { id: newId(), title: DEFAULT_TITLE, auto: true, createdAt: at, updatedAt: at, messages: [] };
    state.conversations.push(c);
    state.activeId = c.id;
    while (state.conversations.length > maxConversations) remove(list().at(-1).id, { save: false });
    persist();
    return c;
  }

  function rename(id, title) {
    const c = get(id);
    const clean = String(title ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!c || !clean) return false;
    c.title = clean;
    c.auto = false;
    persist();
    return true;
  }

  function remove(id, { save = true } = {}) {
    state.conversations = state.conversations.filter((c) => c.id !== id);
    if (state.activeId === id) state.activeId = list()[0]?.id ?? null;
    if (save) persist();
  }

  /** Stores the messages of a conversation; the title follows the first message until the user renames it. */
  function save(id, messages) {
    const c = get(id);
    if (!c) return false;
    c.messages = messages.slice(-maxMessages);
    if (c.auto) c.title = autoTitle(c.messages);
    c.updatedAt = now();
    return persist();
  }

  function setActive(id) {
    if (!get(id)) return false;
    state.activeId = id;
    persist();
    return true;
  }

  /** The active conversation, created if there is none. */
  function active() {
    return get(state.activeId) || list()[0] || create();
  }

  return { list, get, create, rename, remove, save, setActive, active };
}
