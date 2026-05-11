import { Session, SessionDoc } from '../models/Session';
import { Admin } from '../models/Admin';
import { QueueItem } from '../models/QueueItem';
import { PlayedSong } from '../models/PlayedSong';
import { addSongToQueue } from './queue';
import {
  getAdminAccessToken,
  getMySavedTracks,
  getPlaylistTracks,
  getRecommendations,
} from './spotify';
import { logger } from '../config/logger';
import type { SpotifyTrackSnapshot } from '@tuneslam/shared';
import { RECOMMENDED_USER_ID } from '@tuneslam/shared';

/**
 * Top up the queue from the configured autofill source if it's below the minimum.
 * Returns added queue items (or empty array).
 */
export async function autofillIfNeeded(session: SessionDoc): Promise<SpotifyTrackSnapshot[]> {
  if (session.settings.autofillMode === 'off') return [];
  const min = Math.max(0, session.settings.autofillMin);
  if (min <= 0) return [];

  const queueCount = await QueueItem.countDocuments({ sessionId: session._id });
  const need = min - queueCount;
  if (need <= 0) return [];

  const admin = await Admin.findById(session.adminId);
  if (!admin || !admin.spotify?.accessToken) return [];

  let token: string;
  try {
    token = await getAdminAccessToken(admin);
  } catch (err) {
    logger.warn({ err }, 'Could not refresh admin Spotify token for autofill');
    return [];
  }

  let candidates: SpotifyTrackSnapshot[] = [];
  try {
    if (session.settings.autofillMode === 'playlist' && session.settings.autofillPlaylistId) {
      candidates = await getPlaylistTracks(token, session.settings.autofillPlaylistId, 50);
    } else if (session.settings.autofillMode === 'related') {
      // Seed with the most recently played tracks (up to 5).
      const recent = await PlayedSong.find({ sessionId: session._id })
        .sort({ playedAt: -1 })
        .limit(5);
      const seedTrackIds = recent.map((p) => p.track.id);
      if (seedTrackIds.length === 0) {
        // Fallback: try the admin's saved tracks.
        candidates = await getMySavedTracks(token, 50);
      } else {
        candidates = await getRecommendations(token, { seedTracks: seedTrackIds, limit: 30 });
      }
    } else if (session.settings.autofillMode === 'genre' && session.settings.autofillGenre) {
      candidates = await getRecommendations(token, {
        seedGenres: [session.settings.autofillGenre],
        limit: 30,
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Autofill candidate fetch failed');
    return [];
  }

  // Shuffle candidates so we don't always pick the same first track.
  candidates = candidates.sort(() => Math.random() - 0.5);

  const added: SpotifyTrackSnapshot[] = [];
  for (const track of candidates) {
    if (added.length >= need) break;
    try {
      await addSongToQueue({
        session,
        track,
        addedBy: { kind: 'recommended', id: null, label: 'Recommended' },
        forceAdmin: true, // bypass length/popularity/blacklist for autofill (still respects dedupe)
      });
      added.push(track);
    } catch (err: any) {
      // skip duplicates / already-played / etc.
    }
  }
  if (added.length > 0) logger.info({ added: added.length, slug: session.slug }, 'Autofilled queue');
  return added;
}
