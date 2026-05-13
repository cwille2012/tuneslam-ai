import { Router } from 'express';
import { z } from 'zod';
import { Session } from '../models/Session';
import { Admin } from '../models/Admin';
import { User } from '../models/User';
import { QueueItem } from '../models/QueueItem';
import { PlayedSong } from '../models/PlayedSong';
import { AuthedRequest, requirePlayer } from '../middleware/auth';

import { validate } from '../middleware/validate';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { advanceQueue, lockNextIfNeeded, markCurrentPlayedIfPastHalf } from '../services/queue';
import { autofillIfNeeded } from '../services/autofill';
import {
  broadcastNowPlaying,
  broadcastQueue,
  broadcastPlayerClaim,
  broadcastAutofillAdded,
} from '../services/realtime';
import { nowPlayingDTO, sessionDTO } from '../services/serializers';
import { getAdminAccessToken } from '../services/spotify';
import { applySongPlayedStats } from '../services/stats';
import { randomToken } from '../utils/crypto';

const router = Router();

router.use(requirePlayer);

/** Each player tab generates an instance id and claims the player. Older players are kicked. */
const claimSchema = z.object({ instanceId: z.string().min(8).max(64) });

router.post('/claim', validate(claimSchema), async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const slug = req.playerSession!;
    const session = await Session.findOne({ slug, adminId: admin._id });
    if (!session) throw notFound('Session not found');
    admin.activePlayerId = req.body.instanceId;
    admin.activePlayerSince = new Date();
    await admin.save();
    broadcastPlayerClaim(slug, { adminId: admin._id.toString(), ts: Date.now() });
    res.json({ ok: true, instanceId: admin.activePlayerId });
  } catch (e) {
    next(e);
  }
});

/** Heartbeat: confirms this is still the active player. If not, server tells the client to disconnect. */
const heartbeatSchema = z.object({ instanceId: z.string().min(1) });

router.post('/heartbeat', validate(heartbeatSchema), async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    if (admin.activePlayerId !== req.body.instanceId) {
      return res.status(409).json({ error: 'Replaced by another player', stop: true });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** Spotify access token (encrypted on disk, decrypted in-memory each call). */
router.get('/spotify-token', async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const token = await getAdminAccessToken(admin);
    res.json({ accessToken: token });
  } catch (e) {
    next(e);
  }
});

/**
 * Karma leaderboard for the session this player is bound to.
 *
 * Per-session karma isn't stored on User (those counters are global),
 * so we derive it on demand from QueueItem (currently queued) and
 * PlayedSong (already played). Scope is enforced by the player JWT —
 * `req.playerSession` is the slug the token was minted for, so the
 * client can't spoof another session.
 *
 * Karma formula (mirrors GET /api/user/sessions/:slug/me-stats so the
 * numbers users see in their personal popup match the wall display):
 *   sessionKarma = sum(netVotes on user's queued items)
 *                + 1 per played song the user added
 *
 * Returns top 10 by karma, with cached display name + avatar from
 * the user's linked Facebook/Spotify profile (Facebook preferred,
 * Spotify second, falling back to username + null avatar).
 */
router.get('/leaderboard', async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const slug = req.playerSession!;
    const session = await Session.findOne({ slug, adminId: admin._id });
    if (!session) throw notFound('Session not found');

    const [queueRows, playedRows] = await Promise.all([
      QueueItem.find({ sessionId: session._id, 'addedBy.kind': 'user' })
        .select('addedBy.id netVotes')
        .lean(),
      PlayedSong.find({ sessionId: session._id, 'addedBy.kind': 'user' })
        .select('addedBy.id')
        .lean(),
    ]);

    type Row = { userId: string; songsAdded: number; songsPlayed: number; sessionKarma: number };
    const byUser = new Map<string, Row>();
    const ensure = (id: string): Row => {
      let r = byUser.get(id);
      if (!r) {
        r = { userId: id, songsAdded: 0, songsPlayed: 0, sessionKarma: 0 };
        byUser.set(id, r);
      }
      return r;
    };
    for (const q of queueRows) {
      const id = q.addedBy?.id ? String(q.addedBy.id) : null;
      if (!id) continue;
      const r = ensure(id);
      r.songsAdded += 1;
      r.sessionKarma += Number(q.netVotes || 0);
    }
    for (const p of playedRows) {
      const id = p.addedBy?.id ? String(p.addedBy.id) : null;
      if (!id) continue;
      const r = ensure(id);
      r.songsAdded += 1;
      r.songsPlayed += 1;
      r.sessionKarma += 1;
    }

    // Top 10 only — we never display more than that on the wall.
    const sorted = Array.from(byUser.values())
      .sort((a, b) => {
        if (b.sessionKarma !== a.sessionKarma) return b.sessionKarma - a.sessionKarma;
        if (b.songsPlayed !== a.songsPlayed) return b.songsPlayed - a.songsPlayed;
        if (b.songsAdded !== a.songsAdded) return b.songsAdded - a.songsAdded;
        return a.userId.localeCompare(b.userId);
      })
      .slice(0, 10);

    // Resolve user metadata in one batched query. We pull `username`
    // plus the cached `facebookProfile` and `spotifyProfile` blobs so
    // we can show display names and avatars without re-hitting the
    // upstream OAuth providers on every wall refresh.
    const userIds = sorted.map((r) => r.userId);
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select('username facebookProfile spotifyProfile')
          .lean()
      : [];
    const metaById = new Map<string, { username: string; picture: string | null }>();
    for (const u of users) {
      // Picture preference: Facebook > Spotify > null. Mirrors the
      // actor-resolution rule used in services/activity.ts so the
      // avatar a user sees in the activity ticker matches the one
      // shown on the leaderboard.
      const picture =
        (u as any).facebookProfile?.pictureUrl ||
        (u as any).spotifyProfile?.pictureUrl ||
        null;
      metaById.set(String(u._id), {
        username: (u as any).username || 'user',
        picture,
      });
    }

    res.json({
      leaderboard: sorted.map((r, i) => {
        const m = metaById.get(r.userId);
        return {
          rank: i + 1,
          username: m?.username || 'user',
          picture: m?.picture || null,
          sessionKarma: r.sessionKarma,
          songsPlayed: r.songsPlayed,
          songsAdded: r.songsAdded,
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});


router.get('/state', async (req: AuthedRequest, res, next) => {

  try {
    const admin = req.admin!;
    const slug = req.playerSession!;
    const session = await Session.findOne({ slug, adminId: admin._id });
    if (!session) throw notFound('Session not found');
    res.json({
      session: sessionDTO(session, admin),
      nowPlaying: nowPlayingDTO(session),
      lockedNextQueueItemId: session.lockedNextQueueItemId?.toString() ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/** Push progress (and pause state) from the player to the server. */
const progressSchema = z.object({
  progressMs: z.number().int().min(0),
  isPaused: z.boolean(),
  durationMs: z.number().int().min(0).optional(),
});

router.post('/progress', validate(progressSchema), async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const slug = req.playerSession!;
    const session = await Session.findOne({ slug, adminId: admin._id });
    if (!session) throw notFound('Session not found');
    if (!session.nowPlaying.track) {
      return res.json({ ok: true });
    }
    // A change in pause state must propagate to clients *immediately* —
    // the admin/user UIs render their Play/Pause button off this flag,
    // and waiting for the next 5 s scheduled broadcast was the cause of
    // "I clicked Pause but the button still says Play; clicking again
    // works." Detect the change before mutating the doc.
    const pauseChanged = session.nowPlaying.isPaused !== req.body.isPaused;
    session.nowPlaying.progressMs = req.body.progressMs;
    session.nowPlaying.isPaused = req.body.isPaused;
    await session.save();
    const justMarkedPlayed = await markCurrentPlayedIfPastHalf(session);
    const lockedNext = await lockNextIfNeeded(session);
    if (justMarkedPlayed || lockedNext) {
      // Reload to capture any updates.
      const fresh = await Session.findById(session._id);
      if (fresh) broadcastNowPlaying(fresh, nowPlayingDTO(fresh));
      // When we just locked the next item we also need to push a fresh
      // queue snapshot so admin/user/player UIs see `locked: true` on the
      // top item — otherwise the lock state only flips client-side after
      // the next add/vote/skip event.
      if (lockedNext) await broadcastQueue(fresh ?? session);
    } else if (pauseChanged) {
      // Always broadcast on a pause↔play transition so UIs flip their
      // button instantly. (Don't fold this into the throttled branch
      // below — that intentionally drops most progress posts.)
      broadcastNowPlaying(session, nowPlayingDTO(session));
    } else {
      // Throttle: only broadcast progress occasionally - we still send so user UIs stay in sync.
      // Simple coarse-grained: every ~5s based on progressMs % 5000.
      if (req.body.progressMs % 5000 < 250) {
        broadcastNowPlaying(session, nowPlayingDTO(session));
      }
    }

    res.json({ ok: true, lockedNextItemId: session.lockedNextQueueItemId?.toString() ?? null });
  } catch (e) {
    next(e);
  }
});

/** Track ended: advance queue. */
router.post('/ended', async (req: AuthedRequest, res, next) => {
  try {
    const admin = req.admin!;
    const slug = req.playerSession!;
    const session = await Session.findOne({ slug, adminId: admin._id });
    if (!session) throw notFound('Session not found');
    // The player includes the trackId that ended. If it doesn't match the
    // session's current nowPlaying track, this is a stale/duplicate event
    // (e.g. SDK fired multiple paused+pos=0 events around a transition,
    // or two player tabs raced). Ignore so we don't double-advance and
    // run autofill repeatedly.
    const endedTrackId =
      typeof req.body?.trackId === 'string' ? req.body.trackId : null;
    if (endedTrackId && endedTrackId !== session.nowPlaying.track?.id) {
      return res.json({ ok: true, ignored: true });
    }
    if (!session.nowPlaying.track) {
      return res.json({ ok: true, ignored: true });
    }
    // A natural end-of-track always counts as "played" — `/ended` is only
    // fired by the player when Spotify's SDK signals the track completed
    // (skips go through `/admin/session/player/skip`, which explicitly
    // clears `markedPlayed`). Force the flag here so very-short tracks
    // and edge cases where `/progress` didn't tick past 50% still get
    // saved into history.
    if (!session.nowPlaying.markedPlayed) {
      session.nowPlaying.markedPlayed = true;
      await session.save();
    }
    const result = await advanceQueue(session);
    if (result.played) {
      await applySongPlayedStats(
        result.played.addedBy.kind,
        result.played.addedBy.id?.toString() ?? null,
      );
    }
    const added = await autofillIfNeeded(session);
    if (added.length > 0) broadcastAutofillAdded(slug, added.length);
    await broadcastQueue(session);
    broadcastNowPlaying(session, nowPlayingDTO(session));
    res.json({
      ok: true,
      nowPlaying: nowPlayingDTO(session),
      autofilled: added.length,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
