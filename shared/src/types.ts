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

export interface PublicUser {
  id: string;
  username: string;
  email?: string;
  facebookLinked: boolean;
  spotifyLinked: boolean;
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
