/**
 * Runtime environment. The static build (public link without the Node server)
 * sets window.SOLVEX_STATIC = true: routing then uses the URL hash and every
 * server-only feature is shown as unavailable instead of failing.
 */
export const isStatic = () => window.SOLVEX_STATIC === true;

export const APP_VERSION = '2.0.0';
