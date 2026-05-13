/**
 * How downvotes behave in a session. Per-session — two admins can run
 * concurrent sessions with different behaviors and they don't affect
 * each other.
 *
 *   - `standard`        Downvotes count toward `netVotes`, affect
 *                       queue order, and contribute to the
 *                       downvote-threshold removal. (default)
 *   - `disabled`        Users/admin cannot downvote at all. The
 *                       button is hidden client-side and the backend
 *                       rejects `pressed: -1` with 403 (defense in
 *                       depth against a stale or malicious client).
 *   - `noEffectOnOrder` Downvotes are accepted (so the threshold
 *                       removal still works), but the queue display +
 *                       sort use upvotes only. The internal
 *                       `downvotes` count is still maintained server-
 *                       side; just hidden from clients and ignored
 *                       when ordering.
 */
export const DOWNVOTE_BEHAVIORS = ['standard', 'disabled', 'noEffectOnOrder'] as const;
export type DownvoteBehavior = (typeof DOWNVOTE_BEHAVIORS)[number];

/** Default values for session settings. */
export const DEFAULT_SESSION_SETTINGS = {
  popularityThreshold: 0,
  maxSongLengthMs: 10 * 60 * 1000,
  lockAheadSec: 30,
  autofillMode: 'off' as 'off' | 'playlist' | 'related' | 'genre',
  autofillPlaylistId: '' as string,
  autofillGenre: '' as string,
  autofillMin: 3,
  maxSongsPerUserPerHour: 0,
  downvoteThreshold: 3,
  downvoteBehavior: 'standard' as DownvoteBehavior,
  allowReadd: false,
};

export type SessionSettings = typeof DEFAULT_SESSION_SETTINGS;


export const SOCKET_EVENTS = {
  joinSession: 'session:join',
  leaveSession: 'session:leave',
  queueUpdate: 'queue:update',
  nowPlayingUpdate: 'nowplaying:update',
  sessionActive: 'session:active',
  userBlocked: 'user:blocked',
  playerCommand: 'player:command',
  playerClaim: 'player:claim',
  playerProgress: 'player:progress',
  autofillAdded: 'autofill:added',
  /**
   * Player activity ticker stream. Server emits one
   * `ActivityEventDTO` per user-visible action (song added, vote, join,
   * etc.). The player tab's <ActivityTicker> is the primary consumer;
   * other surfaces are free to ignore.
   */
  activityEvent: 'activity:event',
} as const;


export const RECOMMENDED_USER_ID = 'recommended';
