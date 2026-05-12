import axios from 'axios';
import { env, spotifyConfigured } from '../config/env';
import { logger } from '../config/logger';
import { encrypt, decrypt, EncryptedBlob } from '../utils/crypto';
import { Admin, AdminDoc } from '../models/Admin';
import { User, UserDoc } from '../models/User';
import { badRequest, serverError, unauthorized } from '../utils/errors';
import type { SpotifyTrackSnapshot } from '@tuneslam/shared';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

const ADMIN_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-top-read',
].join(' ');

const USER_SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-top-read',
].join(' ');

export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
}

export function buildAdminAuthUrl(state: string): string {
  if (!spotifyConfigured()) throw serverError('Spotify is not configured');
  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    scope: ADMIN_SCOPES,
    state,
    show_dialog: 'true',
  });
  return `${SPOTIFY_AUTH_URL}/authorize?${params.toString()}`;
}

export function buildUserAuthUrl(state: string): string {
  if (!spotifyConfigured()) throw serverError('Spotify is not configured');
  const params = new URLSearchParams({
    client_id: env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
    scope: USER_SCOPES,
    state,
    show_dialog: 'true',
  });
  return `${SPOTIFY_AUTH_URL}/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
  if (!spotifyConfigured()) throw serverError('Spotify is not configured');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.SPOTIFY_REDIRECT_URI,
  });
  const basic = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString(
    'base64',
  );
  const res = await axios.post(`${SPOTIFY_AUTH_URL}/api/token`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
  });
  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresIn: res.data.expires_in,
    scope: res.data.scope,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  if (!spotifyConfigured()) throw serverError('Spotify is not configured');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const basic = Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString(
    'base64',
  );
  const res = await axios.post(`${SPOTIFY_AUTH_URL}/api/token`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
  });
  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token, // sometimes absent
    expiresIn: res.data.expires_in,
    scope: res.data.scope,
  };
}

export interface SpotifyProfile {
  id: string;
  email?: string;
  display_name?: string;
  /** Largest available avatar URL (Spotify returns 0..n images). */
  pictureUrl?: string;
}

export async function fetchSpotifyProfile(accessToken: string): Promise<SpotifyProfile> {
  const res = await axios.get(`${SPOTIFY_API_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const raw = res.data as {
    id: string;
    email?: string;
    display_name?: string;
    images?: { url: string; height?: number | null; width?: number | null }[];
  };
  // Pick the largest image; fall back to first; otherwise none.
  const sorted = (raw.images ?? [])
    .slice()
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  return {
    id: raw.id,
    email: raw.email,
    display_name: raw.display_name,
    pictureUrl: sorted[0]?.url || raw.images?.[0]?.url,
  };
}


export async function handleAdminCallback(code: string, admin: AdminDoc): Promise<void> {
  const tokens = await exchangeCodeForTokens(code);
  const profile = await fetchSpotifyProfile(tokens.accessToken);
  admin.spotify = {
    userId: profile.id,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    scope: tokens.scope,
  };
  await admin.save();
}

export async function handleUserCallback(
  code: string,
  user: UserDoc,
  options: { autoLink?: boolean } = {},
): Promise<void> {
  const tokens = await exchangeCodeForTokens(code);
  const profile = await fetchSpotifyProfile(tokens.accessToken);
  user.spotifyUserId = profile.id;
  user.spotify = {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    scope: tokens.scope,
  };
  user.spotifyProfile = {
    name: profile.display_name,
    pictureUrl: profile.pictureUrl,
  };
  await user.save();
  if (!options.autoLink) return;
}


/** Exchange a code into a freshly-created or matched User account (Spotify-as-login flow). */
export async function loginUserWithSpotify(code: string): Promise<UserDoc> {
  const tokens = await exchangeCodeForTokens(code);
  const profile = await fetchSpotifyProfile(tokens.accessToken);
  let user = await User.findOne({ spotifyUserId: profile.id });
  if (!user) {
    // try email
    if (profile.email) user = await User.findOne({ email: profile.email.toLowerCase() });
  }
  if (!user) {
    const baseUsername = (profile.display_name || profile.id).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18) ||
      `tuner${Math.floor(Math.random() * 100000)}`;
    let username = baseUsername;
    let suffix = 0;
    // ensure uniqueness
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await User.findOne({ username });
      if (!exists) break;
      suffix += 1;
      username = `${baseUsername}${suffix}`;
    }
    user = await User.create({
      username,
      email: profile.email?.toLowerCase(),
      spotifyUserId: profile.id,
    });
  }
  user.spotifyUserId = profile.id;
  user.spotify = {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    scope: tokens.scope,
  };
  user.spotifyProfile = {
    name: profile.display_name,
    pictureUrl: profile.pictureUrl,
  };
  user.lastLogin = new Date();
  await user.save();
  return user;
}

/** Returns a valid (refreshed if necessary) access token for an admin. */

export async function getAdminAccessToken(admin: AdminDoc): Promise<string> {
  if (!admin.spotify || !admin.spotify.accessToken) {
    throw badRequest('Admin has not linked Spotify');
  }
  const expires = admin.spotify.accessTokenExpiresAt?.getTime() ?? 0;
  if (expires - 30_000 > Date.now() && admin.spotify.accessToken) {
    return decrypt(admin.spotify.accessToken);
  }
  if (!admin.spotify.refreshToken) {
    throw badRequest('Spotify token expired and no refresh token available; please re-link.');
  }
  const refreshTokenPlain = decrypt(admin.spotify.refreshToken);
  const refreshed = await refreshAccessToken(refreshTokenPlain);
  admin.spotify.accessToken = encrypt(refreshed.accessToken);
  if (refreshed.refreshToken) admin.spotify.refreshToken = encrypt(refreshed.refreshToken);
  admin.spotify.accessTokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  await admin.save();
  return refreshed.accessToken;
}

export async function getUserAccessToken(user: UserDoc): Promise<string> {
  if (!user.spotify || !user.spotify.accessToken) {
    throw badRequest('User has not linked Spotify');
  }
  const expires = user.spotify.accessTokenExpiresAt?.getTime() ?? 0;
  if (expires - 30_000 > Date.now() && user.spotify.accessToken) {
    return decrypt(user.spotify.accessToken);
  }
  if (!user.spotify.refreshToken) {
    throw badRequest('Spotify token expired; please re-link.');
  }
  const refreshTokenPlain = decrypt(user.spotify.refreshToken);
  const refreshed = await refreshAccessToken(refreshTokenPlain);
  user.spotify.accessToken = encrypt(refreshed.accessToken);
  if (refreshed.refreshToken) user.spotify.refreshToken = encrypt(refreshed.refreshToken);
  user.spotify.accessTokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  await user.save();
  return refreshed.accessToken;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { images: { url: string }[] };
  duration_ms: number;
  popularity?: number;
  is_playable?: boolean;
}

export function trackToSnapshot(t: SpotifyTrack): SpotifyTrackSnapshot {
  return {
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
    durationMs: t.duration_ms,
    popularity: t.popularity ?? 0,
    albumArt: t.album?.images?.[0]?.url ?? '',
  };
}

export async function searchTracks(
  accessToken: string,
  query: string,
  limit = 20,
): Promise<SpotifyTrackSnapshot[]> {
  const res = await axios.get(`${SPOTIFY_API_URL}/search`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q: query, type: 'track', limit },
  });
  const items = (res.data.tracks?.items ?? []) as SpotifyTrack[];
  return items.map(trackToSnapshot);
}

export async function getTrack(accessToken: string, trackId: string): Promise<SpotifyTrackSnapshot> {
  const res = await axios.get(`${SPOTIFY_API_URL}/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return trackToSnapshot(res.data as SpotifyTrack);
}

export async function getMyPlaylists(accessToken: string, limit = 50) {
  const res = await axios.get(`${SPOTIFY_API_URL}/me/playlists`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { limit },
  });
  return (res.data.items ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    image: p.images?.[0]?.url ?? '',
    trackCount: p.tracks?.total ?? 0,
  }));
}

export async function getMySavedTracks(accessToken: string, limit = 50) {
  const res = await axios.get(`${SPOTIFY_API_URL}/me/tracks`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { limit },
  });
  const items = (res.data.items ?? []).map((i: any) => i.track) as SpotifyTrack[];
  return items.map(trackToSnapshot);
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string,
  limit = 50,
): Promise<SpotifyTrackSnapshot[]> {
  const res = await axios.get(`${SPOTIFY_API_URL}/playlists/${playlistId}/tracks`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { limit },
  });
  const items = (res.data.items ?? [])
    .map((i: any) => i.track)
    .filter(Boolean) as SpotifyTrack[];
  return items.map(trackToSnapshot);
}

/**
 * NOTE: Spotify deprecated `/recommendations` and
 * `/recommendations/available-genre-seeds` for newly-created apps in late 2024
 * — they now respond with 404/403/410 for any new client ID. We catch those
 * here and return an empty list so the rest of the API stays healthy. Existing
 * apps that still have access will keep working as before.
 */
function isSpotifyDeprecatedEndpointError(e: any): boolean {
  const status = e?.response?.status;
  return status === 404 || status === 403 || status === 410;
}

export async function getRecommendations(
  accessToken: string,
  opts: { seedTracks?: string[]; seedGenres?: string[]; limit?: number },
): Promise<SpotifyTrackSnapshot[]> {
  const params: any = { limit: opts.limit ?? 20 };
  if (opts.seedTracks?.length) params.seed_tracks = opts.seedTracks.slice(0, 5).join(',');
  if (opts.seedGenres?.length) params.seed_genres = opts.seedGenres.slice(0, 5).join(',');
  try {
    const res = await axios.get(`${SPOTIFY_API_URL}/recommendations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
    });
    const items = (res.data.tracks ?? []) as SpotifyTrack[];
    return items.map(trackToSnapshot);
  } catch (e: any) {
    if (isSpotifyDeprecatedEndpointError(e)) return [];
    throw e;
  }
}

export async function getAvailableGenreSeeds(accessToken: string): Promise<string[]> {
  try {
    const res = await axios.get(
      `${SPOTIFY_API_URL}/recommendations/available-genre-seeds`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.data.genres ?? [];
  } catch (e: any) {
    if (isSpotifyDeprecatedEndpointError(e)) return [];
    throw e;
  }
}

/** Player playback control. */
export async function playOnDevice(
  accessToken: string,
  deviceId: string,
  trackUri: string,
  positionMs = 0,
): Promise<void> {
  await axios.put(
    `${SPOTIFY_API_URL}/me/player/play`,
    { uris: [trackUri], position_ms: positionMs },
    { headers: { Authorization: `Bearer ${accessToken}` }, params: { device_id: deviceId } },
  );
}

export async function pausePlayback(accessToken: string, deviceId?: string): Promise<void> {
  await axios.put(
    `${SPOTIFY_API_URL}/me/player/pause`,
    {},
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: deviceId ? { device_id: deviceId } : undefined,
    },
  );
}

export async function resumePlayback(accessToken: string, deviceId?: string): Promise<void> {
  await axios.put(
    `${SPOTIFY_API_URL}/me/player/play`,
    {},
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: deviceId ? { device_id: deviceId } : undefined,
    },
  );
}

export function unauthorizedIfBlank(token?: string | null): asserts token is string {
  if (!token) throw unauthorized('Spotify access token unavailable');
}
