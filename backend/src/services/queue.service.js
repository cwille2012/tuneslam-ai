import { getRedisClient } from '../config/redis.js';
import { emitToSession } from '../config/socket.js';
import Session from '../models/Session.js';
import Song from '../models/Song.js';
import User from '../models/User.js';
import Vote from '../models/Vote.js';
import { updatePlaylistTracks } from './spotify.service.js';

export const addSongToQueue = async (sessionId, userId, trackData, adminOverride = false) => {
  const session = await Session.findById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Check if session is active
  if (!session.isActive) {
    throw new Error('Session is not currently active');
  }
  
  // Check if user is session owner (for admin override)
  const isOwner = session.ownerId.toString() === userId.toString();
  
  // Only apply validation if not admin override OR if user is not owner
  if (!adminOverride || !isOwner) {
    // Check if user is blocked
    if (session.isUserBlocked(userId)) {
      throw new Error('You have been blocked from this session');
    }
    
    // Check if song is blacklisted
    if (session.blacklist.includes(trackData.spotifyTrackId)) {
      throw new Error('This song has been blacklisted by the session admin');
    }
    
    // Check song duration against max
    if (trackData.duration > session.settings.maxSongDuration) {
      const maxMinutes = Math.floor(session.settings.maxSongDuration / 60);
      throw new Error(`Song exceeds maximum duration of ${maxMinutes} minutes`);
    }
    
    // Check song popularity against minimum
    const minPopularity = session.settings.minSongPopularity || 0;
    if (trackData.popularity < minPopularity) {
      throw new Error(`Song must have at least ${minPopularity} popularity (this song: ${trackData.popularity})`);
    }
  }
  
  // Always check for duplicates (even for admins)
  const existingSong = await Song.findOne({
    sessionId,
    spotifyTrackId: trackData.spotifyTrackId,
    status: { $in: ['queued', 'playing'] }
  });
  
  if (existingSong) {
    throw new Error('This song is already in the queue');
  }
  
  // Create song
  const song = new Song({
    sessionId,
    spotifyTrackId: trackData.spotifyTrackId,
    title: trackData.title,
    artist: trackData.artist,
    album: trackData.album,
    duration: trackData.duration,
    albumArtUrl: trackData.albumArt,
    popularity: trackData.popularity || 0,
    addedBy: userId,
    upvotes: 0,
    downvotes: 0,
    netVotes: 0,
    status: 'queued'
  });
  
  await song.save();
  
  // Update user stats
  const user = await User.findById(userId);
  if (user) {
    user.songsAdded.push(song._id);
    user.stats.songsAddedCount++;
    await user.save();
  }
  
  // Update session participant
  await session.addParticipant(userId, user.username);
  const participant = session.getParticipant(userId);
  if (participant) {
    participant.songsAddedCount++;
    participant.songsAdded.push(song._id);
    await session.save();
  }
  
  // Update Redis cache
  await updateQueueCache(sessionId);
  
  // Sync to Spotify playlist
  await syncQueueToSpotify(sessionId);
  
  // Check if we need to switch back to TuneSlam playlist
  // (if Spotify is playing external songs/auto-play)
  const { getCurrentlyPlaying } = await import('./spotify.service.js');
  const playbackState = await getCurrentlyPlaying(sessionId);
  
  if (playbackState && playbackState.isPlaying) {
    // Set flag to switch back at the end of current song
    session.needsPlaylistSwitch = true;
    await session.save();
    console.log('📌 Marked session to switch back to TuneSlam playlist');
  }
  
  // Emit socket event
  emitToSession(session.name, 'song-added', {
    song: await song.populate('addedBy', 'username')
  });
  
  return song;
};

export const removeSongFromQueue = async (sessionId, songId, reason = 'admin') => {
  const song = await Song.findOne({ _id: songId, sessionId });
  
  if (!song) {
    throw new Error('Song not found');
  }
  
  if (song.status !== 'queued') {
    throw new Error('Can only remove queued songs');
  }
  
  song.status = 'removed';
  song.removedAt = new Date();
  song.removedReason = reason;
  await song.save();
  
  // Update Redis cache
  await updateQueueCache(sessionId);
  
  // Sync to Spotify playlist
  await syncQueueToSpotify(sessionId);
  
  const session = await Session.findById(sessionId);
  emitToSession(session.name, 'song-removed', { songId });
  
  return song;
};

export const getQueue = async (sessionId, userId = null) => {
  const songs = await Song.find({
    sessionId,
    status: { $in: ['queued', 'playing'] }
  })
    .populate('addedBy', 'username karma')
    .sort({ status: -1, netVotes: -1, addedAt: 1 });
  
  // If userId provided, add userVote field to each song
  if (userId) {
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId);
    
    if (user) {
      // Convert Mongoose documents to plain objects so we can add userVote
      const plainSongs = songs.map(song => {
        const plainSong = song.toObject();
        const songIdStr = song._id.toString();
        
        if (user.songsUpvoted && user.songsUpvoted.some(id => id.toString() === songIdStr)) {
          plainSong.userVote = 'up';
        } else if (user.songsDownvoted && user.songsDownvoted.some(id => id.toString() === songIdStr)) {
          plainSong.userVote = 'down';
        } else {
          plainSong.userVote = null;
        }
        
        return plainSong;
      });
      
      return plainSongs;
    }
  }
  
  return songs;
};

export const updateQueueCache = async (sessionId) => {
  const redis = getRedisClient();
  const songs = await getQueue(sessionId);
  
  const key = `queue:${sessionId}`;
  
  // Store as JSON string
  await redis.set(key, JSON.stringify(songs), {
    EX: 3600 // Expire after 1 hour
  });
  
  return songs;
};

export const getQueueFromCache = async (sessionId) => {
  const redis = getRedisClient();
  const key = `queue:${sessionId}`;
  
  const cached = await redis.get(key);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // If not cached, fetch and cache
  return await updateQueueCache(sessionId);
};

export const syncQueueToSpotify = async (sessionId) => {
  try {
    const session = await Session.findById(sessionId);
    
    if (!session || !session.tuneslamPlaylistId) {
      return;
    }
    
    const songs = await Song.find({
      sessionId,
      status: 'queued'
    }).sort({ netVotes: -1, addedAt: 1 });
    
    const trackUris = songs.map(song => `spotify:track:${song.spotifyTrackId}`);
    
    await updatePlaylistTracks(sessionId, session.tuneslamPlaylistId, trackUris);
    
    return true;
  } catch (error) {
    console.error('Error syncing queue to Spotify:', error);
    return false;
  }
};

export const checkAndRemoveDownvotedSongs = async (sessionId) => {
  const session = await Session.findById(sessionId);
  
  if (!session) {
    return;
  }
  
  const threshold = session.settings.downvoteThreshold;
  
  // Find songs that have reached downvote threshold
  const songs = await Song.find({
    sessionId,
    status: 'queued',
    downvotes: { $gte: threshold }
  });
  
  for (const song of songs) {
    await removeSongFromQueue(sessionId, song._id, 'downvotes');
    
    // Update user karma
    const user = await User.findById(song.addedBy);
    if (user) {
      user.karma -= song.downvotes;
      user.stats.downvotesReceived += song.downvotes;
      await user.save();
    }
  }
  
  return songs.length;
};

export const resetSessionQueue = async (sessionId) => {
  const session = await Session.findById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get all songs for this session (queued, playing, played, removed)
  const songs = await Song.find({ sessionId });
  const songIds = songs.map(s => s._id);
  
  // Delete all votes associated with these songs
  await Vote.deleteMany({ songId: { $in: songIds } });
  
  // Delete all songs
  await Song.deleteMany({ sessionId });
  
  // Clear Redis cache
  await updateQueueCache(sessionId);
  
  // Clear Spotify playlist
  if (session.tuneslamPlaylistId) {
    await updatePlaylistTracks(sessionId, session.tuneslamPlaylistId, []);
  }
  
  // Emit socket event
  emitToSession(session.name, 'session-reset', {});
  
  return { success: true, songsCleared: songs.length };
};

export const reorderQueue = async (sessionId) => {
  // Get current top song BEFORE reordering (for optimization)
  const currentTopSong = await Song.findOne({
    sessionId,
    status: 'queued'
  }).sort({ position: 1 });
  
  const allSongs = await Song.find({
    sessionId,
    status: 'queued'
  }).populate('addedBy', '_id username karma');
  
  // Separate locked and unlocked songs
  const lockedSongs = allSongs.filter(s => s.isLocked);
  const unlockedSongs = allSongs.filter(s => !s.isLocked);
  
  // Sort only unlocked songs by netVotes (desc) then addedAt (asc)
  unlockedSongs.sort((a, b) => {
    if (b.netVotes !== a.netVotes) {
      return b.netVotes - a.netVotes;
    }
    return a.addedAt - b.addedAt;
  });
  
  // Combine: locked songs stay at top, then sorted unlocked songs
  const orderedSongs = [...lockedSongs, ...unlockedSongs];
  
  // Update positions
  for (let i = 0; i < orderedSongs.length; i++) {
    orderedSongs[i].position = i + 1;
    await orderedSongs[i].save();
  }
  
  // Check if top song changed
  const newTopSong = orderedSongs[0];
  const topSongChanged = !currentTopSong || 
    !newTopSong ||
    currentTopSong._id.toString() !== newTopSong._id.toString();
  
  await updateQueueCache(sessionId);
  
  // Only sync Spotify if the top (next to play) song changed
  // This significantly reduces API calls while maintaining correct playback order
  if (topSongChanged) {
    await syncQueueToSpotify(sessionId);
  }
  
  const session = await Session.findById(sessionId);
  emitToSession(session.name, 'queue-updated', { queue: orderedSongs });
  
  return orderedSongs;
};
