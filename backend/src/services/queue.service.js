import { getRedisClient } from '../config/redis.js';
import { emitToSession } from '../config/socket.js';
import Session from '../models/Session.js';
import Song from '../models/Song.js';
import User from '../models/User.js';
import { updatePlaylistTracks } from './spotify.service.js';

export const addSongToQueue = async (sessionId, userId, trackData) => {
  const session = await Session.findById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Check if session is active
  if (!session.isActive) {
    throw new Error('Session is not currently active');
  }
  
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
  
  // Check if song already exists in queue
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

export const getQueue = async (sessionId) => {
  const songs = await Song.find({
    sessionId,
    status: { $in: ['queued', 'playing'] }
  })
    .populate('addedBy', 'username karma')
    .sort({ status: -1, netVotes: -1, addedAt: 1 });
  
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

export const reorderQueue = async (sessionId) => {
  const allSongs = await Song.find({
    sessionId,
    status: 'queued'
  });
  
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
  
  await updateQueueCache(sessionId);
  await syncQueueToSpotify(sessionId);
  
  const session = await Session.findById(sessionId);
  emitToSession(session.name, 'queue-updated', { queue: orderedSongs });
  
  return orderedSongs;
};
