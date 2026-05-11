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
} as const;

export const RECOMMENDED_USER_ID = 'recommended';
