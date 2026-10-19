import { createOpenAIImageProvider } from './openaiImages.js';
import { createVeoProvider } from './googleVeo.js';

export function createRegistry(config, { providers } = {}) {
  const list = providers || [createOpenAIImageProvider(config), createVeoProvider(config)];

  return {
    all: () => list,
    get: (id) => list.find((provider) => provider.id === id) || null,
    /** First configured provider of a kind, or a specific one when `id` is given. */
    resolve(kind, id) {
      const candidates = list.filter((provider) => provider.kind === kind && provider.isConfigured());
      if (id) return candidates.find((provider) => provider.id === id) || null;
      return candidates[0] || null;
    },
    describe() {
      return list.map((provider) => ({
        id: provider.id,
        label: provider.label,
        vendor: provider.vendor,
        kind: provider.kind,
        model: provider.model,
        configured: provider.isConfigured(),
        missing: provider.isConfigured() ? [] : provider.requiredEnv,
        capabilities: provider.capabilities,
      }));
    },
  };
}
