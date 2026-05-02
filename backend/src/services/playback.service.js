import Session from '../models/Session.js';
import Song from '../models/Song.js';
import { getCurrentlyPlaying, getTrackDetails } from './spotify.service.js';
import { emitToSession } from '../config/socket.js';

// Track state for each session
const sessionStates = new Map();

// Start monitoring playback for all active sessions
export const startPlaybackMonitoring = () => {
  console.log('Starting playback monitoring service...');
  
  // Poll every 5 seconds
  setInterval(async () => {
    try {
      await monitorAllSessions();
    } catch (error) {
      console.error('Error in playback monitoring:', error);
    }
  }, 5000);
};

const monitorAllSessions = async () => {
  // Get all active sessions with Spotify connected
  const activeSessions = await Session.find({
    isActive: true,
    spotifyAccessToken: { $exists: true, $ne: null }
  });

  for (const session of activeSessions) {
    try {
      await monitorSession(session);
    } catch (error) {
      console.error(`Error monitoring session ${session.name}:`, error.message);
    }
  }
};

const monitorSession = async (session) => {
  // Get currently playing from Spotify
  const spotifyData = await getCurrentlyPlaying(session._id);
  
  if (!spotifyData || !spotifyData.trackId) {
    // Nothing playing - clear any "playing" status
    await Song.updateMany(
      { sessionId: session._id, status: 'playing' },
      { $set: { status: 'queued' } }
    );
    sessionStates.delete(session._id.toString());
    return;
  }

  const { trackId, progress, duration, isPlaying } = spotifyData;
  
  if (!isPlaying) {
    return; // Paused
  }

  // Get our queue
  const currentlyPlaying = await Song.findOne({
    sessionId: session._id,
    status: 'playing'
  });

  const queuedSongs = await Song.find({
    sessionId: session._id,
    status: 'queued'
  }).sort({ position: 1 });

  // Check if track changed (compare with in-memory state for external songs)
  const lastState = sessionStates.get(session._id.toString());
  const trackChanged = !lastState || lastState.trackId !== trackId;

  if (trackChanged) {
    // Track actually changed - handle song change
    await handleSongChange(session, trackId, currentlyPlaying, queuedSongs);
    
    // Update state
    sessionStates.set(session._id.toString(), {
      trackId,
      isExternal: !queuedSongs.find(s => s.spotifyTrackId === trackId)
    });
  }

  // Calculate time remaining in milliseconds
  const remainingMs = duration - progress;
  const remainingSeconds = Math.floor(remainingMs / 1000);

  // ALWAYS emit progress update (for both queue and external songs)
  emitToSession(session.name, 'playback-progress', {
    songId: currentlyPlaying?._id || `external-${trackId}`,
    progress: Math.floor(progress / 1000),
    duration: Math.floor(duration / 1000),
    progressMs: progress,
    durationMs: duration,
    percentage: Math.floor((progress / duration) * 100)
  });

  // Only lock/complete for queue songs
  if (currentlyPlaying) {
    // Lock next song if current song has 30s or less remaining
    if (remainingSeconds <= 30 && queuedSongs.length > 0) {
      const nextSong = queuedSongs[0];
      
      if (!nextSong.isLocked) {
        console.log(`Locking next song: ${nextSong.title} (${remainingSeconds}s remaining)`);
        
        nextSong.isLocked = true;
        nextSong.lockedAt = new Date();
        await nextSong.save();

        emitToSession(session.name, 'song-locked', {
          songId: nextSong._id,
          remainingSeconds
        });
      }
    }
    
    // Auto-fill queue to maintain minimum 3 songs
    if (queuedSongs.length < 3) {
      await fillQueue(session, queuedSongs);
    }

  // Check if song finished (less than 2 seconds remaining)
  if (remainingSeconds <= 2) {
    // Check if we need to switch back to TuneSlam playlist
    if (session.needsPlaylistSwitch && queuedSongs.length > 0) {
      console.log('🔄 Switching back to TuneSlam playlist...');
      const { startPlayback } = await import('./spotify.service.js');
      const switched = await startPlayback(session._id, session.tuneslamPlaylistId);
      
      if (switched) {
        session.needsPlaylistSwitch = false;
        await session.save();
        console.log('✅ Successfully switched to TuneSlam playlist');
      }
    }
    
    await handleSongCompletion(session, currentlyPlaying, queuedSongs);
  }
  }
};

const handleSongChange = async (session, newTrackId, currentlyPlaying, queuedSongs) => {
  console.log(`Song change detected in session ${session.name}`);

  // Mark old song as played if it exists
  if (currentlyPlaying) {
    currentlyPlaying.status = 'played';
    currentlyPlaying.hasPlayed = true;
    currentlyPlaying.playedAt = new Date();
    currentlyPlaying.isLocked = false;
    await currentlyPlaying.save();
  }

  // Find the new playing song in our queue
  const newPlayingSong = queuedSongs.find(s => s.spotifyTrackId === newTrackId);
  
  if (newPlayingSong) {
    // Song is from our queue
    newPlayingSong.status = 'playing';
    newPlayingSong.isLocked = false;
    await newPlayingSong.save();

    // Unlock all other queued songs
    await Song.updateMany(
      { 
        sessionId: session._id,
        status: 'queued',
        _id: { $ne: newPlayingSong._id }
      },
      { $set: { isLocked: false } }
    );

    // Emit now playing update
    emitToSession(session.name, 'now-playing-updated', {
      song: newPlayingSong
    });

    // Update user stats
    await updateUserStats(newPlayingSong.addedBy);
  } else {
    // Song is NOT in our queue - fetch details from Spotify
    console.log(`External song detected: ${newTrackId}`);
    
    const trackDetails = await getTrackDetails(session._id, newTrackId);
    console.log('Track details received:', trackDetails ? trackDetails.title : 'NULL');
    
    if (trackDetails) {
      const externalSong = {
        _id: `external-${newTrackId}`,
        spotifyTrackId: trackDetails.spotifyTrackId,
        title: trackDetails.title,
        artist: trackDetails.artist,
        album: trackDetails.album,
        duration: trackDetails.duration,
        albumArtUrl: trackDetails.albumArtUrl,
        isExternal: true,
        status: 'playing'
      };
      
      console.log(`Emitting external song to session "${session.name}": ${externalSong.title}`);
      
      // Emit external song as now playing
      emitToSession(session.name, 'now-playing-updated', {
        song: externalSong
      });
    } else {
      console.log('❌ Failed to get track details from Spotify');
    }
  }
};

const handleSongCompletion = async (session, currentSong, queuedSongs) => {
  console.log(`Song completed: ${currentSong.title}`);

  // Mark current song as played
  currentSong.status = 'played';
  currentSong.hasPlayed = true;
  currentSong.playedAt = new Date();
  currentSong.isLocked = false;
  await currentSong.save();

  // Move to next song
  if (queuedSongs.length > 0) {
    const nextSong = queuedSongs[0];
    nextSong.status = 'playing';
    nextSong.isLocked = false;
    await nextSong.save();

    // Unlock all queued songs
    await Song.updateMany(
      { 
        sessionId: session._id,
        status: 'queued',
        _id: { $ne: nextSong._id }
      },
      { $set: { isLocked: false } }
    );

    // Emit now playing update
    emitToSession(session.name, 'now-playing-updated', {
      song: nextSong
    });

    // Emit queue update
    const updatedQueue = await Song.find({
      sessionId: session._id,
      status: { $in: ['queued', 'playing'] }
    }).sort({ position: 1 });

    emitToSession(session.name, 'queue-updated', {
      queue: updatedQueue
    });

    // Update user stats
    await updateUserStats(nextSong.addedBy);
  } else {
    // No more songs - emit empty now playing
    emitToSession(session.name, 'now-playing-updated', {
      song: null
    });
  }
};

const fillQueue = async (session, currentQueue) => {
  try {
    const songsNeeded = 3 - currentQueue.length;
    if (songsNeeded <= 0) return;

    console.log(`📝 Auto-filling queue with ${songsNeeded} AI recommendations...`);

    // Get recent played and queued songs as seeds
    const recentSongs = await Song.find({
      sessionId: session._id,
      status: { $in: ['played', 'queued', 'playing'] }
    })
      .sort({ addedAt: -1 })
      .limit(10);

    if (recentSongs.length === 0) {
      console.log('No recent songs for recommendations');
      return;
    }

    // Get seed track IDs (max 5)
    const seedIds = recentSongs.slice(0, 5).map(s => s.spotifyTrackId);

    // Get recommendations from Spotify
    const { getRecommendations } = await import('./spotify.service.js');
    const recommendations = await getRecommendations(session._id, seedIds, songsNeeded + 2);

    if (recommendations.length === 0) {
      console.log('No recommendations received from Spotify');
      return;
    }

    // Filter out duplicates and blacklisted
    const existingTrackIds = [...recentSongs.map(s => s.spotifyTrackId)];
    const filtered = recommendations.filter(track => 
      !existingTrackIds.includes(track.spotifyTrackId) &&
      !session.blacklist.includes(track.spotifyTrackId) &&
      track.duration <= session.settings.maxSongDuration
    );

    // Add system songs to queue
    let added = 0;
    for (const track of filtered) {
      if (added >= songsNeeded) break;

      const song = new Song({
        sessionId: session._id,
        spotifyTrackId: track.spotifyTrackId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        albumArtUrl: track.albumArt,
        isSystemAdded: true,
        upvotes: 0,
        downvotes: 0,
        netVotes: 0,
        status: 'queued'
      });

      await song.save();
      added++;
      console.log(`✅ Added AI recommendation: ${track.title} by ${track.artist}`);
    }

    if (added > 0) {
      // Sync to Spotify playlist
      const { syncQueueToSpotify } = await import('./queue.service.js');
      await syncQueueToSpotify(session._id);

      // Emit queue update
      const updatedQueue = await Song.find({
        sessionId: session._id,
        status: 'queued'
      }).sort({ position: 1 });

      emitToSession(session.name, 'queue-updated', {
        queue: updatedQueue
      });

      console.log(`🎵 Auto-filled queue with ${added} songs`);
    }
  } catch (error) {
    console.error('Error filling queue:', error);
  }
};

const updateUserStats = async (userId) => {
  // This will be implemented when we track played songs per user
  // For now, just increment their songs played count
  try {
    const User = (await import('../models/User.js')).default;
    await User.findByIdAndUpdate(userId, {
      $inc: { 'stats.songsPlayed': 1 }
    });
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

export default {
  startPlaybackMonitoring
};
