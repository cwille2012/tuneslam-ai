import { SessionSettings } from './constants';

export type AccountKind = 'admin' | 'user';

export interface SpotifyArtistRef {
  id: string;
  name: string;
}

export interface SpotifyTrackSnapshot {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  durationMs: number;
  popularity: number;
  albumArt: string;
}

export interface PublicAdmin {
  id: string;
  email: string;
  name: string;
  businessName?: string;
  spotifyLinked: boolean;
}

/** Captured profile metadata snapshotted from a third-party OAuth provider. */
export interface LinkedProviderProfile {
  name?: string;
  pictureUrl?: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email?: string;
  facebookLinked: boolean;
  spotifyLinked: boolean;
  /** Display name + avatar from FB (only present when linked). */
  facebookProfile?: LinkedProviderProfile;
  /** Display name + avatar from Spotify (only present when linked). */
  spotifyProfile?: LinkedProviderProfile;
  karma: number;
}


export interface UserStats {
  songsAdded: number;
  songsUpvoted: number;
  songsDownvoted: number;
  songsPlayed: number;
  karma: number;
  sessionsJoined: number;
  lastLogin?: string;
}

export interface QueueItemDTO {
  id: string;
  track: SpotifyTrackSnapshot;
  addedBy: {
    kind: 'admin' | 'user' | 'recommended';
    id: string | null;
    label: string; // username, "Admin", or "Recommended"
  };
  netVotes: number;
  upvotes: number;
  downvotes: number;
  myVote: -1 | 0 | 1;
  locked: boolean;
  addedAt: string;
}

export interface NowPlayingDTO {
  track: SpotifyTrackSnapshot | null;
  startedAt?: string;
  isPaused: boolean;
  progressMs: number;
}

export interface SessionDTO {
  id: string;
  slug: string;
  active: boolean;
  spotifyLinked: boolean;
  settings: SessionSettings;
  adminLabel: string;
}

export interface ParticipantDTO {
  id: string;
  username: string;
  joinedAt: string;
  lastSeen: string;
  blocked: boolean;
  online: boolean;
}

export interface PlayedSongDTO {
  id: string;
  track: SpotifyTrackSnapshot;
  playedAt: string;
  addedBy: { id: string | null; label: string };
}

export interface AuthResponse<T> {
  token: string;
  account: T;
}

export type VoteValue = -1 | 0 | 1;

/**
 * Discriminator for the player's activity ticker. Add new values here
 * (and a label in the player's `describe()` switch) to surface a new
 * kind of event. Server-side broadcast goes through
 * `broadcastActivity()` in `backend/src/services/realtime.ts` — that's
 * the only other surface area to touch.
 */
export type ActivityKind =
  | 'songAdded'
  | 'voteUp'
  | 'voteDown'
  | 'userJoined';

export interface ActivityActor {
  /** Stable id (user/admin) so the ticker can hash a fallback color. */
  id: string;
  /** Display name (FB/Spotify profile name if linked, else username). */
  name: string;
  /** Avatar URL — null/undefined means render a colored-circle initial. */
  pictureUrl?: string | null;
}

export interface ActivityEventDTO {
  /** Stable client-side React key. Server-generated, never reused. */
  id: string;
  kind: ActivityKind;
  /** Date.now() at emit time. Used for client-side TTL pruning. */
  ts: number;
  actor: ActivityActor;
  /** Optional context — only some kinds carry track info. */
  track?: { id: string; title: string; artist: string };
}

