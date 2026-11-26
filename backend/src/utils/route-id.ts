import { badRequest } from './http-error';

/** Accepte un entier strictement positif, sous forme de nombre ou de chaîne décimale. */
export function parseId(value: unknown): number {
  const id = typeof value === 'number' ? value : typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id < 1) throw badRequest('Identifiant invalide');
  return id;
}

/** Même contrôle pour un identifiant optionnel (paramètre de filtre). */
export function parseOptionalId(value: unknown): number | undefined {
  return value === undefined || value === '' ? undefined : parseId(value);
}
