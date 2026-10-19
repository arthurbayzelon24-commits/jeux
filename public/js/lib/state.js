import { api } from './api.js';

let capabilities = null;
let pending = null;

/** Server capabilities (providers, styles, limits), fetched once and cached. */
export function loadCapabilities({ force = false } = {}) {
  if (capabilities && !force) return Promise.resolve(capabilities);
  if (pending && !force) return pending;
  pending = api
    .capabilities()
    .then((data) => {
      capabilities = data;
      window.dispatchEvent(new CustomEvent('solvex:capabilities', { detail: data }));
      return data;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function getCapabilities() {
  return capabilities;
}

/** The provider used by default for a kind: first configured one, else the first known. */
export function providerFor(kind) {
  const list = capabilities?.providers?.filter((provider) => provider.kind === kind) || [];
  return list.find((provider) => provider.configured) || list[0] || null;
}
