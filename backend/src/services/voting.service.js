import { getRedisClient } from '../config/redis.js';
import { emitToSession } from '../config/socket.js';
import Session from '../models/Session.js';
import Song from '../models/Song.js';
import Vote from '../models/Vote.js';
import User from '../models/User.js';
import { reorderQueue, checkAndRemoveDownvotedSongs } from './queue.service.js';

export const castVote = async (sessionId, songId, userId, voteType) => {
  const session = await Session.findById(sessionId);
  const song = await Song.findOne({ _id: songId, sessionId });
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (!song) {
    throw new Error('Song not found');
  }
  
  if (song.status !== 'queued') {
    throw new Error('Can only vote on queued songs');
  }
  
  // Check if song is locked (next up with <30s on current song)
  if (song.isLocked) {
    throw new Error('This song is locked and will play next');
  }
  
  // Check if user is trying to vote on their own song (allow voting on system songs)
  if (song.addedBy && song.addedBy.toString() === userId.toString()) {
    throw new Error('You cannot vote on songs you added');
  }
  
  // Check if user is blocked
  if (session.isUserBlocked(userId)) {
    throw new Error('You have been blocked from this session');
  }
  
  // Check if vote already exists
  let vote = await Vote.findOne({ userId, songId });
  
  const user = await User.findById(userId);
  const songOwner = await User.findById(song.addedBy);
  
  if (vote) {
    // User already voted - remove the vote (regardless of same or different type)
    const oldVoteType = vote.voteType;
    await Vote.deleteOne({ _id: vote._id });
    
    // Update song votes based on what we're removing
    if (oldVoteType === 'up') {
      song.upvotes = Math.max(0, song.upvotes - 1);
      // Remove from user's upvoted songs
      if (user && user.songsUpvoted.includes(songId)) {
        user.songsUpvoted = user.songsUpvoted.filter(id => id.toString() !== songId.toString());
        await user.save();
      }
      // Update song owner karma
      if (songOwner) {
        songOwner.karma = Math.max(0, songOwner.karma - 1);
        songOwner.stats.upvotesReceived = Math.max(0, songOwner.stats.upvotesReceived - 1);
        await songOwner.save();
      }
    } else {
      song.downvotes = Math.max(0, song.downvotes - 1);
      // Remove from user's downvoted songs
      if (user && user.songsDownvoted.includes(songId)) {
        user.songsDownvoted = user.songsDownvoted.filter(id => id.toString() !== songId.toString());
        await user.save();
      }
      // Update song owner karma
      if (songOwner) {
        songOwner.karma++;
        songOwner.stats.downvotesReceived = Math.max(0, songOwner.stats.downvotesReceived - 1);
        await songOwner.save();
      }
    }
    
    vote = null;
  } else {
    // New vote
    vote = new Vote({
      userId,
      songId,
      sessionId,
      voteType
    });
    await vote.save();
    
    // Update song votes
    if (voteType === 'up') {
      song.upvotes++;
      // Add to user's upvoted songs
      if (user && !user.songsUpvoted.includes(songId)) {
        user.songsUpvoted.push(songId);
        await user.save();
      }
      // Update song owner karma
      if (songOwner) {
        songOwner.karma++;
        songOwner.stats.upvotesReceived++;
        await songOwner.save();
      }
    } else {
      song.downvotes++;
      // Add to user's downvoted songs
      if (user && !user.songsDownvoted.includes(songId)) {
        user.songsDownvoted.push(songId);
        await user.save();
      }
      // Update song owner karma
      if (songOwner) {
        songOwner.karma--;
        songOwner.stats.downvotesReceived++;
        await songOwner.save();
      }
    }
  }
  
  // Calculate net votes
  song.calculateNetVotes();
  await song.save();
  
  // Update Redis vote cache
  await updateVoteCache(songId);
  
  // Check if song should be removed due to downvotes
  await checkAndRemoveDownvotedSongs(sessionId);
  
  // Reorder queue based on new votes
  await reorderQueue(sessionId);
  
  // Emit socket event
  emitToSession(session.name, 'votes-changed', {
    songId,
    upvotes: song.upvotes,
    downvotes: song.downvotes,
    netVotes: song.netVotes
  });
  
  return { song, vote };
};

export const getUserVoteForSong = async (userId, songId) => {
  const vote = await Vote.findOne({ userId, songId });
  return vote ? vote.voteType : null;
};

export const updateVoteCache = async (songId) => {
  const redis = getRedisClient();
  const song = await Song.findById(songId);
  
  if (!song) {
    return null;
  }
  
  const key = `votes:${songId}`;
  
  await redis.hSet(key, {
    upvotes: song.upvotes.toString(),
    downvotes: song.downvotes.toString(),
    netVotes: song.netVotes.toString()
  });
  
  await redis.expire(key, 3600); // Expire after 1 hour
  
  return song;
};

export const getVotesFromCache = async (songId) => {
  const redis = getRedisClient();
  const key = `votes:${songId}`;
  
  const cached = await redis.hGetAll(key);
  
  if (cached && Object.keys(cached).length > 0) {
    return {
      upvotes: parseInt(cached.upvotes),
      downvotes: parseInt(cached.downvotes),
      netVotes: parseInt(cached.netVotes)
    };
  }
  
  // If not cached, fetch from DB and cache
  const song = await updateVoteCache(songId);
  return song ? {
    upvotes: song.upvotes,
    downvotes: song.downvotes,
    netVotes: song.netVotes
  } : null;
};
