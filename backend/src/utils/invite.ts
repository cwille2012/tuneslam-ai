// =============================================================================
// INVITE-ONLY GATE
// =============================================================================
//
// While the app is in private beta we only let accounts be created from a
// specific email domain. The allowed domain comes from the AUTHORIZED_DOMAIN
// env var (see backend/.env / backend/.env.production). Removing the gate
// later is trivial:
//
//   1. Delete this file.
//   2. `grep -rn "assertInviteAllowed\|utils/invite" backend/src`
//      and delete the import + the call from each route file it finds.
//   3. Optionally remove AUTHORIZED_DOMAIN from your env files.
//
// Facebook login is NOT gated here because access to the FB OAuth app is
// already restricted via the Meta developer dashboard's user allow-list.
//
// Fail-closed: if AUTHORIZED_DOMAIN is missing or empty, every registration
// is rejected. That's safer than silently letting anyone in if the env var
// gets dropped in a deploy.
//
// Strict-match (no subdomain wildcard) so an attacker can't register with
// e.g. `foo@evil-somedomain.com`.
// =============================================================================

import { forbidden } from './errors';

const ALLOWED_DOMAIN = (process.env.AUTHORIZED_DOMAIN || '').trim().toLowerCase();

export function assertInviteAllowed(email: string | undefined): void {
  const domain = (email || '').toLowerCase().split('@')[1] || '';
  if (!ALLOWED_DOMAIN || domain !== ALLOWED_DOMAIN) {
    throw forbidden('This app is currently invite only. Check back later!');
  }
}
