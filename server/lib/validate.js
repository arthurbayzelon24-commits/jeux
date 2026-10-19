import { HttpError } from './http.js';
import { isValidId } from './store.js';
import { STYLES } from './prompt.js';

export const MAX_PROMPT_LENGTH = 4000;

const bad = (message, field) => new HttpError(400, message, { code: 'invalid_request', details: field ? { field } : undefined });

export function optionalPrompt(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw bad('La description doit être un texte.', 'prompt');
  const text = value.trim();
  if (text.length > MAX_PROMPT_LENGTH) throw bad(`La description dépasse ${MAX_PROMPT_LENGTH} caractères.`, 'prompt');
  return text;
}

export function requiredPrompt(value, message = 'Décrivez ce que vous souhaitez créer.') {
  const text = optionalPrompt(value);
  if (!text) throw bad(message, 'prompt');
  return text;
}

export function oneOf(value, allowed, field, label) {
  if (!allowed.includes(value)) throw bad(`${label} non pris en charge : ${String(value)}.`, field);
  return value;
}

export function intInRange(value, min, max, field, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw bad(`${label} doit être compris entre ${min} et ${max}.`, field);
  return number;
}

export function uploadIdList(value, max, field = 'referenceUploadIds') {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max || !value.every(isValidId)) {
    throw bad(`Références d’image invalides (${max} au maximum).`, field);
  }
  return [...new Set(value)];
}

export function optionalId(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (!isValidId(value)) throw bad('Identifiant invalide.', field);
  return value;
}

export function styleId(value) {
  if (value === undefined || value === null || value === '') return 'personnalise';
  return oneOf(value, Object.keys(STYLES), 'style', 'Style');
}
