/**
 * Runtime environment. The static build (public link without the Node server)
 * sets window.SOLVEX_STATIC = true: routing then uses the URL hash and every
 * server-only feature is shown as unavailable instead of failing.
 */
export const isStatic = () => window.SOLVEX_STATIC === true;

/**
 * Static build shown inside the claude.ai sharing frame (no own URL, no
 * service worker, downloads through the platform). The public website build
 * (Netlify…) is static too but owns its address: window.SOLVEX_SITE = true.
 */
export const isEmbedded = () => isStatic() && window.SOLVEX_SITE !== true;

export const APP_VERSION = '2.3.0';
