import { ActivityActor, ActivityEventDTO, ActivityKind } from '@tuneslam/shared';
import type { UserDoc } from '../models/User';

/**
 * Build the actor blob attached to every ActivityEvent. Centralized so
 * future event kinds don't each duplicate the user-doc → actor mapping.
 *
 * Display-name precedence: linked Facebook name → linked Spotify name →
 * site username. Avatar precedence: same. We prefer FB pictures because
 * the FB Graph URL is a CDN that's reliable cross-origin; Spotify CDN
 * URLs occasionally 404 or hotlink-block.
 */
export function actorFromUser(user: UserDoc): ActivityActor {
  const name =
    user.facebookProfile?.name?.trim() ||
    user.spotifyProfile?.name?.trim() ||
    user.username;
  const pictureUrl =
    user.facebookProfile?.pictureUrl ||
    user.spotifyProfile?.pictureUrl ||
    null;
  return { id: user._id.toString(), name, pictureUrl };
}

/** Cheap, collision-resistant id for a single ticker event. */
export function makeActivityId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

/**
 * Convenience constructor — keeps the call sites in routes one line and
 * forces them to go through `actorFromUser` (so we never accidentally
 * leak a raw user doc into the socket payload).
 */
export function buildActivityEvent(
  kind: ActivityKind,
  actor: ActivityActor,
  track?: { id: string; title: string; artist: string },
): ActivityEventDTO {
  return { id: makeActivityId(), kind, ts: Date.now(), actor, track };
}
