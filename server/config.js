import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env when present (Node >= 20.12 / 21.7). Existing env vars win.
const envFile = path.join(ROOT_DIR, '.env');
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) throw new Error(`Variable ${name} invalide : « ${raw} »`);
  return value;
}

function str(name, fallback = '') {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

export function loadConfig(overrides = {}) {
  const config = {
    port: int('PORT', 3000),
    host: str('HOST', '127.0.0.1'),
    dataDir: path.resolve(ROOT_DIR, str('SOLVEX_DATA_DIR', 'data')),
    publicDir: path.join(ROOT_DIR, 'public'),
    // Optional shared access code. When set, every API call needs a session cookie.
    accessCode: str('SOLVEX_ACCESS_CODE'),
    sessionSecret: str('SOLVEX_SESSION_SECRET'),
    secureCookies: str('SOLVEX_SECURE_COOKIES', 'false') === 'true',
    trustProxy: str('SOLVEX_TRUST_PROXY', 'false') === 'true',
    maxUploadBytes: int('SOLVEX_MAX_UPLOAD_MB', 20) * 1024 * 1024,
    maxTranscribeBytes: 25 * 1024 * 1024,
    uploadTtlMs: int('SOLVEX_UPLOAD_TTL_MIN', 60) * 60 * 1000,
    rateLimit: {
      generatePerMinute: int('SOLVEX_RATE_GENERATE_PER_MIN', 6),
      uploadPerMinute: int('SOLVEX_RATE_UPLOAD_PER_MIN', 30),
      enhancePerMinute: int('SOLVEX_RATE_ENHANCE_PER_MIN', 20),
      chatPerMinute: int('SOLVEX_RATE_CHAT_PER_MIN', 20),
    },
    maxConcurrentJobs: int('SOLVEX_MAX_CONCURRENT_JOBS', 3),
    jobTimeoutMs: {
      image: int('SOLVEX_IMAGE_TIMEOUT_S', 300) * 1000,
      video: int('SOLVEX_VIDEO_TIMEOUT_S', 900) * 1000,
    },
    videoPollIntervalMs: int('SOLVEX_VIDEO_POLL_S', 10) * 1000,
    openai: {
      apiKey: str('OPENAI_API_KEY'),
      baseUrl: str('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
      imageModel: str('OPENAI_IMAGE_MODEL', 'gpt-image-2'),
      // No default: prompt enhancement by LLM is only enabled when a model is named explicitly.
      textModel: str('OPENAI_TEXT_MODEL'),
      // Model used by the SOLVEX AI conversation; falls back to OPENAI_TEXT_MODEL. No default: never guessed.
      chatModel: str('OPENAI_CHAT_MODEL'),
      // No default either: transcription is enabled only with an explicitly named model.
      transcribeModel: str('OPENAI_TRANSCRIBE_MODEL'),
    },
    pollinations: {
      enabled: str('POLLINATIONS_ENABLED', 'true') === 'true',
      baseUrl: str('POLLINATIONS_BASE_URL', 'https://image.pollinations.ai'),
      model: str('POLLINATIONS_MODEL'),
    },
    google: {
      apiKey: str('GEMINI_API_KEY'),
      baseUrl: str('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
      videoModel: str('GEMINI_VIDEO_MODEL', 'veo-3.1-generate-preview'),
    },
  };
  return deepMerge(config, overrides);
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object') {
      target[key] = deepMerge({ ...target[key] }, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}
