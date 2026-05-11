import { Router } from 'express';
import { z } from 'zod';
import { Session } from '../models/Session';
import { Admin } from '../models/Admin';
import { User } from '../models/User';
import { QueueItem } from '../models/QueueItem';
import { PlayedSong } from '../models/PlayedSong';
import { BlacklistedTrack } from '../models/BlacklistedTrack';
import { SessionParticipant } from '../models/SessionParticipant';
import { AuthedRequest, requireAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';
import { validateSlug, normalizeSlug, DEFAULT_SESSION_SETTINGS } from '@tuneslam/shared';
import {
  addSongToQueue,
  castVote,
  removeQueueItem,
  resetQueue,
  serializeQueue,
  serializeItem,
  QueueRejection,
  advanceQueue,
} from '../services/queue';
import {
  getAdminAccessToken,
  searchTracks,
  getMyPlaylists,
  getMySavedTracks,
  getAvailableGenreSeeds,
  getTrack,
} from '../services/spotify';
import { sessionDTO, nowPlayingDTO } from '../services/serializers';
import { signJwt } from '../utils/jwt';
import { env } from '../config/env';
import {
  broadcastQueue,
  broadcastNowPlaying,
  broadcastSessionActive,
  broadcastUserBlocked,
  broadcastPlayerCommand,
} from '../services/realtime';
import { autofillIfNeeded } from '../services/autofill';
import { applyVoteStats, applySongPlayedStats } from '../services/stats';

const router = Router();
router.use(requireAdmin);

// =============================================================================
// Sessions (one per admin)
// =============================================================================

const createSessionSchema = z.object({ slug: z.string().min(3).max(40) });

router.post('/sessions', validate(createSessionSchema), async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const existing = await Session.findOne({ adminId: admin._id });
    if (existing) throw conflict('You already have a session.');
    const slug = normalizeSlug(req.body.slug);
    const v = validateSlug(slug);
    if (!v.ok) throw badRequest(v.reason!);
    const taken = await Session.findOne({ slug });
    if (taken) throw conflict('That session name is already taken.');
    const session = await Session.create({
      slug,
      adminId: admin._id,
      active: false,
      settings: DEFAULT_SESSION_SETTINGS,
      nowPlaying: { track: null, isPaused: true, progressMs: 0, markedPlayed: false },
    });
    res.json({ session: sessionDTO(session, admin) });
  } catch (e) {
    next(e);
  }
});

router.get('/session', async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const session = await Session.findOne({ adminId: admin._id });
    if (!session) return res.json({ session: null });
    res.json({
      session: sessionDTO(session, admin),
      nowPlaying: nowPlayingDTO(session),
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/session', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    await QueueItem.deleteMany({ sessionId: session._id });
    await PlayedSong.deleteMany({ sessionId: session._id });
    await SessionParticipant.deleteMany({ sessionId: session._id });
    await session.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const settingsSchema = z.object({
  popularityThreshold: z.number().int().min(0).max(100).optional(),
  maxSongLengthMs: z.number().int().min(0).optional(),
  lockAheadSec: z.number().int().min(5).max(120).optional(),
  autofillMode: z.enum(['off', 'playlist', 'related', 'genre']).optional(),
  autofillPlaylistId: z.string().optional(),
  autofillGenre: z.string().optional(),
  autofillMin: z.number().int().min(0).max(20).optional(),
  maxSongsPerUserPerHour: z.number().int().min(0).optional(),
  downvoteThreshold: z.number().int().min(0).optional(),
  allowReadd: z.boolean().optional(),
});

router.patch('/session/settings', validate(settingsSchema), async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    Object.assign(session.settings, req.body);
    await session.save();
    res.json({ session: sessionDTO(session, req.admin!) });
  } catch (e) {
    next(e);
  }
});

const activeSchema = z.object({ active: z.boolean() });
router.patch('/session/active', validate(activeSchema), async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const session = await Session.findOne({ adminId: admin._id });
    if (!session) throw notFound('Session not found');
    if (req.body.active && !admin.spotify?.accessToken) {
      throw badRequest('Link Spotify before activating the session.');
    }
    session.active = req.body.active;
    await session.save();
    broadcastSessionActive(session);
    res.json({ session: sessionDTO(session, admin) });
  } catch (e) {
    next(e);
  }
});

// =============================================================================
// Queue
// =============================================================================

router.get('/session/queue', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    const items = await serializeQueue(session._id, {
      voter: { kind: 'admin', id: req.admin!._id.toString() },
    });
    res.json({ items, nowPlaying: nowPlayingDTO(session) });
  } catch (e) {
    next(e);
  }
});

const addByTrackIdSchema = z.object({ trackId: z.string().min(1), force: z.boolean().optional() });
router.post('/session/queue', validate(addByTrackIdSchema), async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const session = await Session.findOne({ adminId: admin._id });
    if (!session) throw notFound('Session not found');
    const token = await getAdminAccessToken(admin);
    const track = await getTrack(token, req.body.trackId);
    try {
      const item = await addSongToQueue({
        session,
        track,
        addedBy: { kind: 'admin', id: admin._id.toString(), label: admin.businessName || admin.name || 'Admin' },
        forceAdmin: req.body.force === true,
      });
      await broadcastQueue(session);
      res.json({ item: serializeItem(item, { voter: { kind: 'admin', id: admin._id.toString() } }) });
    } catch (e: any) {
      if (e instanceof QueueRejection) {
        return res.status(409).json({ error: e.reason, blacklisted: e.blacklisted, canForce: true });
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

const voteSchema = z.object({ pressed: z.union([z.literal(1), z.literal(-1)]) });
router.post(
  '/session/queue/:itemId/vote',
  validate(voteSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const admin = req.admin!;
      const session = await Session.findOne({ adminId: admin._id });
      if (!session) throw notFound('Session not found');
      const outcome = await castVote({
        session,
        itemId: req.params.itemId,
        voter: { kind: 'admin', id: admin._id.toString() },
        pressed: req.body.pressed,
      });
      // Stats: only update author karma; admin doesn't have voter stats.
      if (outcome.item) {
        await applyVoteStats({
          voterKind: 'admin',
          voterId: admin._id.toString(),
          authorKind: outcome.item.addedBy.kind,
          authorId: outcome.item.addedBy.id?.toString() ?? null,
          previousVote: outcome.previousVote,
          newVote: outcome.myVote,
        });
      }
      await broadcastQueue(session);
      res.json({ removed: outcome.removed, myVote: outcome.myVote });
    } catch (e) {
      next(e);
    }
  },
);

router.delete('/session/queue/:itemId', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    await removeQueueItem(session._id, req.params.itemId);
    await broadcastQueue(session);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/session/reset', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    await resetQueue(session);
    await broadcastQueue(session);
    broadcastNowPlaying(session, nowPlayingDTO(session));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/session/history', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    const items = await PlayedSong.find({ sessionId: session._id })
      .sort({ playedAt: -1 })
      .limit(200);
    res.json({
      items: items.map((p) => ({
        id: p._id.toString(),
        track: p.track,
        playedAt: p.playedAt.toISOString(),
        addedBy: {
          id: p.addedBy.id?.toString() ?? null,
          label: p.addedBy.label,
        },
      })),
    });
  } catch (e) {
    next(e);
  }
});

// =============================================================================
// Blacklist
// =============================================================================

router.get('/blacklist', async (req: AuthedRequest, res, next) => {
  try {
    const items = await BlacklistedTrack.find({ adminId: req.admin!._id }).sort({ createdAt: -1 });
    res.json({
      items: items.map((b) => ({
        id: b._id.toString(),
        trackId: b.trackId,
        trackName: b.trackName,
        artistsJoined: b.artistsJoined,
        albumArt: b.albumArt,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

const blacklistAddSchema = z.object({ trackId: z.string().min(1) });
router.post('/blacklist', validate(blacklistAddSchema), async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const token = await getAdminAccessToken(admin);
    const track = await getTrack(token, req.body.trackId);
    const exists = await BlacklistedTrack.findOne({ adminId: admin._id, trackId: track.id });
    if (exists) throw conflict('Track is already blacklisted.');
    const created = await BlacklistedTrack.create({
      adminId: admin._id,
      trackId: track.id,
      trackName: track.name,
      artistsJoined: track.artists.map((a) => a.name).join(', '),
      albumArt: track.albumArt,
    });
    res.json({ item: { ...track, blacklistId: created._id.toString() } });
  } catch (e) {
    next(e);
  }
});

router.delete('/blacklist/:id', async (req: AuthedRequest, res, next) => {
  try {
    const r = await BlacklistedTrack.deleteOne({ _id: req.params.id, adminId: req.admin!._id });
    if (r.deletedCount === 0) throw notFound('Blacklist entry not found');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// =============================================================================
// Participants (block / unblock)
// =============================================================================

router.get('/session/participants', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    const participants = await SessionParticipant.find({ sessionId: session._id }).sort({
      lastSeenAt: -1,
    });
    const userIds = participants.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));
    const out = participants.map((p) => {
      const u = userMap.get(p.userId.toString());
      return {
        id: p.userId.toString(),
        username: u?.username ?? '(unknown)',
        joinedAt: p.joinedAt.toISOString(),
        lastSeen: p.lastSeenAt.toISOString(),
        blocked: p.blocked,
        online: Date.now() - p.lastSeenAt.getTime() < 5 * 60 * 1000,
      };
    });
    res.json({ participants: out });
  } catch (e) {
    next(e);
  }
});

const blockSchema = z.object({ blocked: z.boolean() });
router.post(
  '/session/participants/:userId/block',
  validate(blockSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const session = await Session.findOne({ adminId: req.admin!._id });
      if (!session) throw notFound('Session not found');
      const p = await SessionParticipant.findOne({
        sessionId: session._id,
        userId: req.params.userId,
      });
      if (!p) throw notFound('Participant not found');
      p.blocked = req.body.blocked;
      await p.save();
      broadcastUserBlocked(session.slug, p.userId.toString(), p.blocked);
      res.json({ ok: true, blocked: p.blocked });
    } catch (e) {
      next(e);
    }
  },
);

// =============================================================================
// Spotify proxies (admin-side)
// =============================================================================

router.get('/spotify/search', async (req: AuthedRequest, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ items: [] });
    const token = await getAdminAccessToken(req.admin!);
    const items = await searchTracks(token, q, 20);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/spotify/playlists', async (req: AuthedRequest, res, next) => {
  try {
    const token = await getAdminAccessToken(req.admin!);
    const items = await getMyPlaylists(token, 50);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/spotify/library', async (req: AuthedRequest, res, next) => {
  try {
    const token = await getAdminAccessToken(req.admin!);
    const items = await getMySavedTracks(token, 50);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/spotify/genres', async (req: AuthedRequest, res, next) => {
  try {
    const token = await getAdminAccessToken(req.admin!);
    const genres = await getAvailableGenreSeeds(token);
    res.json({ genres });
  } catch (e) {
    next(e);
  }
});

// =============================================================================
// Player controls
// =============================================================================

router.post('/session/player/play', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    if (!session.nowPlaying.track) {
      // Nothing is currently loaded — pull the next item off the queue and
      // make it the current track. The Spotify player will pick it up via
      // the broadcast nowPlayingUpdate handler and start playback.
      const result = await advanceQueue(session);
      if (!result.nowPlaying) {
        // Queue is empty; nothing to do.
        broadcastNowPlaying(session, nowPlayingDTO(session));
        return res.json({ ok: true, queueEmpty: true });
      }
      await broadcastQueue(session);
    } else {
      session.nowPlaying.isPaused = false;
      await session.save();
    }
    broadcastPlayerCommand(session.slug, 'play');
    broadcastNowPlaying(session, nowPlayingDTO(session));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/session/player/pause', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    session.nowPlaying.isPaused = true;
    await session.save();
    broadcastPlayerCommand(session.slug, 'pause');
    broadcastNowPlaying(session, nowPlayingDTO(session));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/session/player/skip', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    // If the song hadn't yet been marked played, the spec says it shouldn't return to queue;
    // it just gets skipped. So clear markedPlayed before advancing.
    session.nowPlaying.markedPlayed = false;
    const result = await advanceQueue(session);
    if (result.played) {
      await applySongPlayedStats(result.played.addedBy.kind, result.played.addedBy.id?.toString() ?? null);
    }
    // Try autofill if needed
    const added = await autofillIfNeeded(session);
    await broadcastQueue(session);
    broadcastNowPlaying(session, nowPlayingDTO(session));
    broadcastPlayerCommand(session.slug, 'skip');
    res.json({ ok: true, autofilled: added.length });
  } catch (e) {
    next(e);
  }
});

// =============================================================================
// Player launch token (used by the dashboard "Open Player" button)
// =============================================================================

router.post('/session/player/launch-token', async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ adminId: req.admin!._id });
    if (!session) throw notFound('Session not found');
    const token = signJwt({ sub: req.admin!._id.toString(), aud: 'player', session: session.slug });
    res.json({ token, playerUrl: `${env.PLAYER_URL}/${session.slug}?token=${encodeURIComponent(token)}` });
  } catch (e) {
    next(e);
  }
});

export default router;
