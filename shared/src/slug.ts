import { isReservedSlug } from './reserved';

/** Allowed: 3-40 chars, lowercase letters, digits, single hyphens (no leading/trailing/double). */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export interface SlugValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateSlug(raw: string): SlugValidationResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'Slug must be a string.' };
  const slug = raw.trim().toLowerCase();
  if (slug.length < 3) return { ok: false, reason: 'Slug must be at least 3 characters.' };
  if (slug.length > 40) return { ok: false, reason: 'Slug must be at most 40 characters.' };
  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      reason: 'Slug may only contain lowercase letters, numbers, and hyphens (no leading or trailing hyphen).',
    };
  }
  if (slug.includes('--')) return { ok: false, reason: 'Slug may not contain consecutive hyphens.' };
  if (isReservedSlug(slug)) return { ok: false, reason: 'That session name is reserved. Please pick another.' };
  return { ok: true };
}

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}
