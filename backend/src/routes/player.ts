import { Router } from 'express';
import { z } from 'zod';
import { Session } from '../models/Session';
import { Admin } from '../models/Admin';
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
