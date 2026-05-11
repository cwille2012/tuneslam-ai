import mongoose from 'mongoose';
import { User } from '../models/User';
import { Admin } from '../models/Admin';
import { QueueItem } from '../models/QueueItem';
import { PlayedSong } from '../models/PlayedSong';

/** Apply stats deltas after a vote: updates voter counters AND song-author karma. */
export async function applyVoteStats(params: {
  voterKind: 'admin' | 'user';
  voterId: string;
  authorKind: 'admin' | 'user' | 'recommended';
  authorId: string | null;
  previousVote: -1 | 0 | 1;
  newVote: -1 | 0 | 1;
}): Promise<void> {
  const { voterKind, voterId, authorKind, authorId, previousVote, newVote } = params;
  if (previousVote === newVote) return;

  // Voter counters: increment songsUpvoted/songsDownvoted on transition into +1/-1.
  if (voterKind === 'user') {
    const inc: Record<string, number> = {};
    if (previousVote === 1) inc['stats.songsUpvoted'] = -1;
    if (newVote === 1) inc['stats.songsUpvoted'] = (inc['stats.songsUpvoted'] ?? 0) + 1;
    if (previousVote === -1) inc['stats.songsDownvoted'] = -1;
    if (newVote === -1) inc['stats.songsDownvoted'] = (inc['stats.songsDownvoted'] ?? 0) + 1;
    if (Object.keys(inc).length) {
      await User.updateOne({ _id: voterId }, { $inc: inc });
    }
  }
  // Admin doesn't track stats per spec.

  // Author karma: net delta = newVote - previousVote (e.g., -1 -> +1 = +2 karma).
  if (authorKind === 'user' && authorId) {
    const delta = newVote - previousVote;
    if (delta !== 0) {
      await User.updateOne({ _id: authorId }, { $inc: { 'stats.karma': delta } });
    }
  }
}

/** When a user adds a song. */
export async function applySongAddedStats(authorKind: 'admin' | 'user', authorId: string): Promise<void> {
  if (authorKind === 'user') {
    await User.updateOne({ _id: authorId }, { $inc: { 'stats.songsAdded': 1 } });
  }
}

/** When a song the user added is actually played (>=50%). +1 karma, +1 songsPlayed. */
export async function applySongPlayedStats(authorKind: 'admin' | 'user' | 'recommended', authorId: string | null): Promise<void> {
  if (authorKind !== 'user' || !authorId) return;
  await User.updateOne(
    { _id: authorId },
    { $inc: { 'stats.songsPlayed': 1, 'stats.karma': 1 } },
  );
}
