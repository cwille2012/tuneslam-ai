import { Router } from 'express';
import { z } from 'zod';
import { Session } from '../models/Session';
import { Admin } from '../models/Admin';
import { User } from '../models/User';
import { SessionParticipant } from '../models/SessionParticipant';
import { AuthedRequest, requireUser, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { badRequest, forbidden, notFound } from '../utils/errors';
import {
  addSongToQueue,
  castVote,
  serializeQueue,
  serializeItem,
  QueueRejection,
} from '../services/queue';
import { sessionDTO, nowPlayingDTO, userStats, publicUser } from '../services/serializers';
import {
  getUserAccessToken,
  searchTracks,
  getMyPlaylists,
  getMySavedTracks,
  getPlaylistTracks,
  getTrack,
  getAdminAccessToken,
} from '../services/spotify';
import { broadcastQueue, broadcastActivity } from '../services/realtime';
import { actorFromUser, buildActivityEvent } from '../services/activity';
import { rolloverQuotaIfExpired, quotaResetsAt } from '../services/quota';

import { applySongAddedStats, applyVoteStats } from '../services/stats';


const router = Router();

router.get('/me/stats', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    res.json({ stats: userStats(req.user!) });
  } catch (e) {
    next(e);
  }
});

/**
 * Search Spotify. If the user has linked their own Spotify, use their token
 * so personalised results show up; otherwise fall back to the host admin's
 * token (looked up via the session slug). This means search works even for
 * users who haven't linked Spotify, while linked users see what they're used
 * to.
 */
router.get('/spotify/search', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ items: [] });
    const slug = String(req.query.slug || '').trim().toLowerCase();
    let token: string;
    if (req.user!.spotify?.accessToken) {
      token = await getUserAccessToken(req.user!);
    } else if (slug) {
      const session = await Session.findOne({ slug });
      if (!session) throw notFound('Session not found');
      const admin = await Admin.findById(session.adminId);
      if (!admin?.spotify?.accessToken) {
        throw badRequest('Host has not linked Spotify; cannot search.');
      }
      token = await getAdminAccessToken(admin);
    } else {
      throw badRequest('Link Spotify or pass ?slug to search via the host.');
    }
    const items = await searchTracks(token, q, 20);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/** User's saved tracks — requires user-linked Spotify. */
router.get('/spotify/playlists', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const token = await getUserAccessToken(req.user!);
    const items = await getMyPlaylists(token, 50);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/spotify/library', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const token = await getUserAccessToken(req.user!);
    const items = await getMySavedTracks(token, 50);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/** Tracks of one of the user's playlists — requires user-linked Spotify. */
router.get('/spotify/playlists/:id/tracks', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const token = await getUserAccessToken(req.user!);
    const items = await getPlaylistTracks(token, req.params.id, 100);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/** Join a session (or just look it up). Always available. */
router.get('/sessions/:slug', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ slug: req.params.slug.toLowerCase() });
    if (!session) throw notFound('Session not found');
    const admin = await Admin.findById(session.adminId);
    if (!admin) throw notFound('Session unavailable');
    const dto = sessionDTO(session, admin);
    let blocked = false;
    if (req.user) {
      const p = await SessionParticipant.findOne({
        sessionId: session._id,
        userId: req.user._id,
      });
      if (p?.blocked) blocked = true;
      // Track participant
      await SessionParticipant.updateOne(
        { sessionId: session._id, userId: req.user._id },
        { $set: { lastSeenAt: new Date() }, $setOnInsert: { joinedAt: new Date() } },
        { upsert: true },
      );
    }
    res.json({
      session: dto,
      nowPlaying: nowPlayingDTO(session),
      me: req.user ? { ...publicUser(req.user), blocked } : null,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/sessions/:slug/queue', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ slug: req.params.slug.toLowerCase() });
    if (!session) throw notFound('Session not found');
    const voter = req.user ? { kind: 'user' as const, id: req.user._id.toString() } : null;
    const items = await serializeQueue(session, { voter });

    res.json({ items, nowPlaying: nowPlayingDTO(session) });
  } catch (e) {
    next(e);
  }
});

const addSchema = z.object({ trackId: z.string().min(1) });

router.post(
  '/sessions/:slug/queue',
  requireUser,
  validate(addSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const session = await Session.findOne({ slug: req.params.slug.toLowerCase() });
      if (!session) throw notFound('Session not found');
      const user = req.user!;

      const participant = await SessionParticipant.findOne({
        sessionId: session._id,
        userId: user._id,
      });
      if (participant?.blocked) throw forbidden('You are blocked from adding to this session.');

      // Use admin's token to look up the track (more reliable than user token).
      const admin = await Admin.findById(session.adminId);
      if (!admin) throw notFound('Session unavailable');
      const adminToken = await getAdminAccessToken(admin);
      const track = await getTrack(adminToken, req.body.trackId);
      try {
        const item = await addSongToQueue({
          session,
          track,
          addedBy: { kind: 'user', id: user._id.toString(), label: user.username },
        });
        await applySongAddedStats('user', user._id.toString());
        await broadcastQueue(session);
        // Activity ticker: surface the add to the player tab. Same actor
        // shape used everywhere else (FB > Spotify > username).
        broadcastActivity(
          session.slug,
          buildActivityEvent('songAdded', actorFromUser(user), {
            id: track.id,
            title: track.name,
            artist: track.artists.map((a) => a.name).join(', '),
          }),
        );
        res.json({
          item: serializeItem(item, { voter: { kind: 'user', id: user._id.toString() } }),
        });

      } catch (e: any) {
        if (e instanceof QueueRejection) {
          return res.status(409).json({ error: e.reason, blacklisted: e.blacklisted });
        }
        throw e;
      }
    } catch (e) {
      next(e);
    }
  },
);

const voteSchema = z.object({ pressed: z.union([z.literal(1), z.literal(-1)]) });

router.post(
  '/sessions/:slug/queue/:itemId/vote',
  requireUser,
  validate(voteSchema),
  async (req: AuthedRequest, res, next) => {
    try {
      const session = await Session.findOne({ slug: req.params.slug.toLowerCase() });
      if (!session) throw notFound('Session not found');
      const user = req.user!;
      const participant = await SessionParticipant.findOne({
        sessionId: session._id,
        userId: user._id,
      });
      if (participant?.blocked) throw forbidden('You are blocked from voting in this session.');

      // Per-user-per-hour vote limit. Counts every successful press
      // (new vote, flip, OR cancel) as 1 — matches the song-add
      // counter semantic and prevents toggle-spam from cheating the
      // rate limit. Admins are not limited (no participant doc).
      //
      // We bump the counter *before* `castVote` runs so that if the
      // call below throws (e.g. self-vote) the user isn't charged.
      // The check itself uses `>=` so the very next press above the
      // limit is rejected; the bump only happens after the limit
      // check passes.
      const maxVotes = session.settings.maxVotesPerUserPerHour ?? 0;
      if (maxVotes > 0 && participant) {
        rolloverQuotaIfExpired(participant);
        if (participant.votesUsedThisHour >= maxVotes) {
          throw forbidden('You have hit the hourly vote limit for this session.');
        }
        participant.votesUsedThisHour += 1;
        participant.lastSeenAt = new Date();
        await participant.save();
      }

      const outcome = await castVote({
        session,
        itemId: req.params.itemId,
        voter: { kind: 'user', id: user._id.toString() },
        pressed: req.body.pressed,
      });

      if (outcome.item) {
        await applyVoteStats({
          voterKind: 'user',
          voterId: user._id.toString(),
          authorKind: outcome.item.addedBy.kind,
          authorId: outcome.item.addedBy.id?.toString() ?? null,
          previousVote: outcome.previousVote,
          newVote: outcome.myVote,
        });
      }
      await broadcastQueue(session);
      // Ticker: only surface a *newly applied* vote (myVote === pressed),
      // not toggling-off (which feels like noise on the wall display).
      // outcome.item is null when the vote caused the item to be removed
      // by the downvote threshold; we still surface that downvote since
      // it's a real action.
      if (outcome.myVote !== 0 && outcome.myVote === req.body.pressed) {
        const trackInfo = outcome.item
          ? {
              id: outcome.item.track.id,
              title: outcome.item.track.name,
              artist: outcome.item.track.artists.map((a: any) => a.name).join(', '),
            }
          : undefined;
        broadcastActivity(
          session.slug,
          buildActivityEvent(
            req.body.pressed === 1 ? 'voteUp' : 'voteDown',
            actorFromUser(user),
            trackInfo,
          ),
        );
      }
      res.json({ removed: outcome.removed, myVote: outcome.myVote });

    } catch (e) {
      next(e);
    }
  },
);

/**
 * Quota snapshot for the calling user in a particular session.
 *
 * Returns 0/0 for any limit the admin has disabled (the client uses a
 * positive `maxXxxPerHour` to decide whether to render that line of
 * the popup). `resetsAt` is sent regardless because the client only
 * surfaces the countdown when at least one limit is exhausted, and
 * computing it client-side from `quotaHourStart` would require
 * exposing that field too.
 *
 * Cheap and called on a 30 s timer from the user app — keep it lean.
 */
router.get('/sessions/:slug/quota', requireUser, async (req: AuthedRequest, res, next) => {
  try {
    const session = await Session.findOne({ slug: req.params.slug.toLowerCase() });
    if (!session) throw notFound('Session not found');
    const user = req.user!;
    let participant = await SessionParticipant.findOne({
      sessionId: session._id,
      userId: user._id,
    });
    if (!participant) {
      // First-time call (e.g. user just opened the popup before
      // touching the queue) — create the doc so subsequent calls
      // reuse the same `quotaHourStart`. Mirrors the upsert in
      // GET /sessions/:slug.
      participant = await SessionParticipant.create({
        sessionId: session._id,
        userId: user._id,
      });
    } else {
      // Roll the window over before reporting, so a user who hasn't
      // hit anything for over an hour sees a fresh quota when they
      // open the popup — not stale numbers that "reset" only on the
      // next add/vote.
      if (rolloverQuotaIfExpired(participant)) {
        await participant.save();
      }
    }
    res.json({
      maxSongsPerHour: session.settings.maxSongsPerUserPerHour ?? 0,
      maxVotesPerHour: session.settings.maxVotesPerUserPerHour ?? 0,
      songsUsedThisHour: participant.songsUsedThisHour ?? 0,
      votesUsedThisHour: participant.votesUsedThisHour ?? 0,
      resetsAt: quotaResetsAt(participant).toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

export default router;

