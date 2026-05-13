/**
 * The user app stores the slug-relative path (`/cool-bar`) the user
 * most recently tried to view *while logged out* in localStorage. It
 * gets read by Login / Register / FacebookCallback as a fallback when
 * React-Router state is missing — which happens whenever the user
 * refreshes the login page, or comes back from an OAuth round-trip
 * that didn't preserve the `from` query param.
 *
 * QR-scan flow this fixes:
 *   1. User scans → opens `/cool-bar` (logged out)
 *   2. SessionView writes "/cool-bar" to localStorage
 *   3. User clicks Log in → fills email/password → submits
 *   4. Login.tsx checks loc.state.from first, falls back to this
 *      stored value, ends up on /cool-bar.
 *
 * In-memory React-Router state is preserved correctly along that
 * happy path, but localStorage gives us a refresh-and-OAuth-safe
 * fallback that costs almost nothing.
 */
export const PENDING_SESSION_KEY = 'tuneslam:pendingSession';

export function readPendingSession(): string | null {
  try {
    const v = localStorage.getItem(PENDING_SESSION_KEY);
    if (!v) return null;
    // Defensive: must be a slug-relative path. Anything else is junk
    // (or a path traversal attempt) — discard.
    if (!v.startsWith('/') || v.startsWith('//')) return null;
    return v;
  } catch {
    return null;
  }
}

export function writePendingSession(path: string): void {
  try {
    localStorage.setItem(PENDING_SESSION_KEY, path);
  } catch {
    // Quota / private-mode failures are not fatal. Worst case, the
    // user lands on /account after logging in — same as before this
    // feature existed.
  }
}

export function clearPendingSession(): void {
  try {
    localStorage.removeItem(PENDING_SESSION_KEY);
  } catch {
    /* swallow */
  }
}
