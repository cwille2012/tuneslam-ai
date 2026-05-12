import mongoose from 'mongoose';
import { Session, SessionDoc } from '../models/Session';
import { QueueItem, QueueItemDoc, voterKey } from '../models/QueueItem';
import { PlayedSong } from '../models/PlayedSong';
import { BlacklistedTrack } from '../models/BlacklistedTrack';
import { SessionParticipant } from '../models/SessionParticipant';
import type { SpotifyTrackSnapshot, QueueItemDTO } from '@tuneslam/shared';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors';

export interface AddSongInput {
  session: SessionDoc;
  track: SpotifyTrackSnapshot;
  addedBy: {
    kind: 'admin' | 'user' | 'recommended';
    id: string | null;
    label: string;
  };
  /** Admin-only override to add a song that would otherwise be rejected (length/popularity/blacklist). */
  forceAdmin?: boolean;
}

export interface AddSongResult {
  item: QueueItemDoc;
  rejected?: never;
}

export class QueueRejection extends Error {
  reason: string;
  blacklisted: boolean;
  constructor(reason: string, blacklisted = false) {
    super(reason);
    this.reason = reason;
    this.blacklisted = blacklisted;
  }
}

/** Throws QueueRejection on rules violations. */
export async function addSongToQueue(input: AddSongInput): Promise<QueueItemDoc> {
  const { session, track, addedBy, forceAdmin } = input;

  if (!session.active && addedBy.kind !== 'admin') {
    throw forbidden('Session is not active');
  }

  // Length check.
  if (
    !forceAdmin &&
    session.settings.maxSongLengthMs > 0 &&
    track.durationMs > session.settings.maxSongLengthMs
  ) {
    throw new QueueRejection('Song is longer than the session maximum.');
  }

  // Popularity check.
  if (
    !forceAdmin &&
    session.settings.popularityThreshold > 0 &&
    (track.popularity ?? 0) < session.settings.popularityThreshold
  ) {
    throw new QueueRejection('Song popularity is below the session threshold.');
  }

  // Blacklist check.
  const blacklisted = await BlacklistedTrack.findOne({
    adminId: session.adminId,
    trackId: track.id,
  });
  if (blacklisted && !forceAdmin) {
    throw new QueueRejection('Song is blacklisted.', true);
  }

  // Already in queue (dedupe).
  const existing = await QueueItem.findOne({ sessionId: session._id, 'track.id': track.id });
  if (existing) {
    throw conflict('Song is already in the queue.');
  }

  // Already played in this session?
  if (!session.settings.allowReadd) {
    const previouslyPlayed = await PlayedSong.findOne({
      sessionId: session._id,
      'track.id': track.id,
    });
    if (previouslyPlayed) throw conflict('Song was already played in this session.');
  }

  // Per-user-per-hour rate limit.
  if (
    addedBy.kind === 'user' &&
    addedBy.id &&
    session.settings.maxSongsPerUserPerHour > 0
  ) {
    const participant = await SessionParticipant.findOne({
      sessionId: session._id,
      userId: addedBy.id,
    });
    if (participant) {
      const hourMs = 60 * 60 * 1000;
      const now = new Date();
      if (now.getTime() - participant.recentAdds.hourStart.getTime() > hourMs) {
        participant.recentAdds = { hourStart: now, count: 0 };
      }
      if (participant.recentAdds.count >= session.settings.maxSongsPerUserPerHour) {
        throw new QueueRejection('You have hit the hourly add limit for this session.');
      }
      participant.recentAdds.count += 1;
      participant.lastSeenAt = new Date();
      await participant.save();
    }
  }

  const item = await QueueItem.create({
    sessionId: session._id,
    track,
    addedBy: {
      kind: addedBy.kind,
      id: addedBy.id ? new mongoose.Types.ObjectId(addedBy.id) : null,
      label: addedBy.label,
    },
    votes: new Map(),
    netVotes: 0,
    upvotes: 0,
    downvotes: 0,
    locked: false,
  });

  return item;
}

export interface VoteInput {
  session: SessionDoc;
  itemId: string;
  voter: { kind: 'admin' | 'user'; id: string };
  /** +1 means upvote pressed, -1 means downvote pressed. The toggle/cancel logic handles existing state. */
  pressed: 1 | -1;
}

export interface VoteOutcome {
  item: QueueItemDoc | null;
  removed: boolean;
  /** The voter's effective vote on this song after the press. */
  myVote: -1 | 0 | 1;
  /** The previous effective vote (used by stats handler). */
  previousVote: -1 | 0 | 1;
}

export async function castVote(input: VoteInput): Promise<VoteOutcome> {
  const { session, itemId, voter, pressed } = input;
  const item = await QueueItem.findOne({ _id: itemId, sessionId: session._id });
  if (!item) throw notFound('Queue item not found');
  if (item.addedBy.id && item.addedBy.id.toString() === voter.id && item.addedBy.kind === voter.kind) {
    throw forbidden('You cannot vote on your own song.');
  }

  const key = voterKey(voter.kind, voter.id);
  const previous = (item.votes.get(key) ?? 0) as -1 | 0 | 1;
  let next: -1 | 0 | 1;

  if (previous === pressed) {
    // Pressing the same direction again removes the vote.
    next = 0;
  } else {
    next = pressed;
  }

  if (next === 0) {
    item.votes.delete(key);
  } else {
    item.votes.set(key, next);
  }

  // Recompute aggregates from scratch (cheap; map is small).
  let up = 0;
  let down = 0;
  for (const v of item.votes.values()) {
    if (v > 0) up += 1;
    else if (v < 0) down += 1;
  }
  item.upvotes = up;
  item.downvotes = down;
  item.netVotes = up - down;

  // Threshold removal: songs with downvotes >= threshold are removed.
  // (Per spec: "If a song goes below the admin set threshold votes (default is -3) it is removed".)
  // We interpret this as `netVotes <= -threshold`.
  const removeAt = session.settings.downvoteThreshold;
  if (removeAt > 0 && item.netVotes <= -removeAt && !item.locked) {
    await item.deleteOne();
    return { item: null, removed: true, myVote: 0, previousVote: previous };
  }
  await item.save();
  return { item, removed: false, myVote: next, previousVote: previous };
}

/** Returns the queue ordered as it should play. */
export async function getOrderedQueue(sessionId: mongoose.Types.ObjectId): Promise<QueueItemDoc[]> {
  // Locked first (only one expected), then by netVotes desc, then by addedAt asc.
  const items = await QueueItem.find({ sessionId }).sort({
    locked: -1,
    netVotes: -1,
    addedAt: 1,
  });
  return items;
}

export interface SerialiseOpts {
  voter?: { kind: 'admin' | 'user'; id: string } | null;
}

export function serializeItem(item: QueueItemDoc, opts: SerialiseOpts = {}): QueueItemDTO {
  let myVote: -1 | 0 | 1 = 0;
  if (opts.voter) {
    const v = item.votes.get(voterKey(opts.voter.kind, opts.voter.id));
    if (v === 1 || v === -1) myVote = v;
  }
  return {
    id: item._id.toString(),
    track: item.track,
    addedBy: {
      kind: item.addedBy.kind,
      id: item.addedBy.id ? item.addedBy.id.toString() : null,
      label: item.addedBy.label,
    },
    netVotes: item.netVotes,
    upvotes: item.upvotes,
    downvotes: item.downvotes,
    myVote,
    locked: item.locked,
    addedAt: item.addedAt.toISOString(),
  };
}

export async function serializeQueue(
  sessionId: mongoose.Types.ObjectId,
  opts: SerialiseOpts = {},
): Promise<QueueItemDTO[]> {
  const items = await getOrderedQueue(sessionId);
  return items.map((i) => serializeItem(i, opts));
}

/** Removes the song. Used by admin "remove from queue". */
export async function removeQueueItem(
  sessionId: mongoose.Types.ObjectId,
  itemId: string,
): Promise<void> {
  const res = await QueueItem.deleteOne({ _id: itemId, sessionId });
  if (res.deletedCount === 0) throw notFound('Queue item not found');
}

/**
 * Result of {@link advanceQueue}. `played` carries the just-finished
 * track's metadata (track snapshot + addedBy credit) so callers can
 * apply karma/leaderboard adjustments. We deliberately don't return
 * the full Mongoose `QueueItemDoc` for the played item anymore — the
 * underlying QueueItem doc is deleted at promotion time, so we work
 * off the snapshot we keep on `session.nowPlaying`. See `advanceQueue`
 * for the full reasoning.
 */
export interface AdvanceQueueResult {
  /** Snapshot of the song that just finished, if any was archived. */
  played?: {
    track: SpotifyTrackSnapshot;
    addedBy: {
      kind: 'admin' | 'user' | 'recommended';
      id: mongoose.Types.ObjectId | null;
      label: string;
    };
  };
  /** The newly-promoted track's queue item, if there was one. */
  nowPlaying?: QueueItemDoc;
}

/**
 * Advance to the next track.
 *
 * Two things happen here:
 *   1. If the *previous* now-playing track was marked played
 *      (`session.nowPlaying.markedPlayed === true`), archive it to
 *      `PlayedSong` for the History page.
 *   2. Promote the next queue item (locked-next if one exists,
 *      otherwise the top of the ordered queue) into the session's
 *      `nowPlaying`. Delete its QueueItem doc so it doesn't reappear
 *      in the queue list — the session is now its source of truth.
 *
 * **Why we archive from `session.nowPlaying`, not from the QueueItem.**
 * The instinctive thing is to look up the source QueueItem via
 * `session.nowPlaying.sourceQueueItemId` and read `track`/`addedBy`
 * off that doc. That doesn't work: the QueueItem is deleted on the
 * *previous* call to `advanceQueue` (see the `await nextItem.deleteOne()`
 * below), so by the time the track ends the doc is gone, the lookup
 * returns `null`, and nothing ever gets written to `PlayedSong`.
 * That was the long-standing "History page is always empty" bug. We
 * now keep a snapshot of `addedBy` directly on `session.nowPlaying`
 * (see Session.ts) and archive from that.
 */
export async function advanceQueue(session: SessionDoc): Promise<AdvanceQueueResult> {
  // Identify the locked-next item if present, otherwise the natural top.
  let nextItem: QueueItemDoc | null = null;
  if (session.lockedNextQueueItemId) {
    nextItem = await QueueItem.findById(session.lockedNextQueueItemId);
  }
  if (!nextItem) {
    const ordered = await getOrderedQueue(session._id);
    nextItem = ordered[0] ?? null;
  }

  // Archive the *previous* now-playing if it was credited as played.
  // We work off the snapshot stored on the session — the underlying
  // QueueItem doc was deleted when this track was promoted.
  let played: AdvanceQueueResult['played'];
  if (session.nowPlaying.markedPlayed && session.nowPlaying.track) {
    const addedBy = session.nowPlaying.addedBy ?? {
      // Legacy / pre-migration sessions: no snapshot was captured at
      // promotion time. Credit it to the system rather than failing
      // the write outright.
      kind: 'recommended' as const,
      id: null,
      label: 'Auto-fill',
    };
    await PlayedSong.create({
      sessionId: session._id,
      track: session.nowPlaying.track,
      addedBy,
      playedAt: new Date(),
    });
    played = { track: session.nowPlaying.track, addedBy };
  }

  if (!nextItem) {
    session.nowPlaying = {
      track: null,
      isPaused: true,
      progressMs: 0,
      markedPlayed: false,
      sourceQueueItemId: undefined,
      startedAt: undefined,
      addedBy: undefined,
    };
    session.lockedNextQueueItemId = null;
    await session.save();
    return { played };
  }

  // Promote the next item. Snapshot its `addedBy` onto the session so
  // we can credit it to History when *this* track ends. After the
  // delete below, the QueueItem doc is gone — `nowPlaying.addedBy` is
  // the only place that information survives.
  session.nowPlaying = {
    track: nextItem.track,
    startedAt: new Date(),
    isPaused: false,
    progressMs: 0,
    markedPlayed: false,
    sourceQueueItemId: nextItem._id,
    addedBy: {
      kind: nextItem.addedBy.kind,
      id: nextItem.addedBy.id ?? null,
      label: nextItem.addedBy.label,
    },
  };
  await nextItem.deleteOne();
  session.lockedNextQueueItemId = null;
  await session.save();
  return { played, nowPlaying: nextItem };
}


/**
 * If the current track has less than `lockAheadSec` seconds remaining, lock the next item.
 * Returns the locked item (or null).
 */
export async function lockNextIfNeeded(session: SessionDoc): Promise<QueueItemDoc | null> {
  if (!session.nowPlaying.track || session.nowPlaying.isPaused) return null;
  const remainingMs = session.nowPlaying.track.durationMs - session.nowPlaying.progressMs;
  const lockAheadMs = session.settings.lockAheadSec * 1000;
  if (remainingMs > lockAheadMs) return null;
  if (session.lockedNextQueueItemId) {
    return QueueItem.findById(session.lockedNextQueueItemId);
  }
  const ordered = await getOrderedQueue(session._id);
  const next = ordered[0];
  if (!next) return null;
  next.locked = true;
  await next.save();
  session.lockedNextQueueItemId = next._id;
  await session.save();
  return next;
}

/** Mark the current now-playing as played (>=50%). */
export async function markCurrentPlayedIfPastHalf(session: SessionDoc): Promise<boolean> {
  if (!session.nowPlaying.track || session.nowPlaying.markedPlayed) return false;
  if (session.nowPlaying.progressMs * 2 >= session.nowPlaying.track.durationMs) {
    session.nowPlaying.markedPlayed = true;
    await session.save();
    return true;
  }
  return false;
}

/** Wipe queue and history – admin reset. */
export async function resetQueue(session: SessionDoc): Promise<void> {
  await QueueItem.deleteMany({ sessionId: session._id });
  await PlayedSong.deleteMany({ sessionId: session._id });
  session.nowPlaying = {
    track: null,
    isPaused: true,
    progressMs: 0,
    markedPlayed: false,
    sourceQueueItemId: undefined,
    startedAt: undefined,
    addedBy: undefined,
  };
  session.lockedNextQueueItemId = null;
  await session.save();
}

