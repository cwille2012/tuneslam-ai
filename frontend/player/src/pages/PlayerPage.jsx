import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { sessionAPI, queueAPI, playerAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import NowPlaying from '../components/NowPlaying';
import QueueList from '../components/QueueList';

function PlayerPage() {
  const { sessionName } = useParams();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [currentQueueItem, setCurrentQueueItem] = useState(null);
  const currentSongRef = useRef(null);

  // Refs used by the memoized Spotify state-change handler so it can read
  // the latest queue / currentTrack / play without re-binding on every render.
  const queueRef = useRef([]);
  const currentTrackRef = useRef(null);
  const playRef = useRef(null);
  const advancingRef = useRef(false); // guards against double auto-advance

  
  // Get auth token from URL or localStorage
  const urlToken = searchParams.get('token');
  
  useEffect(() => {
    if (urlToken) {
      localStorage.setItem('tuneslam_player_token', urlToken);
      // Remove token from URL
      window.history.replaceState({}, '', `/session/${sessionName}`);
    }
  }, [urlToken, sessionName]);

  // Socket connection
  const token = localStorage.getItem('tuneslam_player_token');
  const { connected, on, off, emit } = useSocket(sessionName, token);

  // Spotify Player state change handler. Kept minimal (only emits playback
  // state to the backend). The SDK's `player_state_changed` event ONLY fires
  // on actual transitions (play/pause/seek/track change) — NOT on position
  // ticks — so we can't do "near-end" detection here. Auto-advance is
  // instead driven by the 1-second position polling (see effect below).
  const handleSpotifyStateChange = useCallback((state) => {
    if (state.track) {
      emit('playback-state-changed', {
        isPaused: state.isPaused,
        position: state.position,
        track: state.track
      });
    }
  }, [emit]);



  // Initialize Spotify Player
  const {
    deviceId,
    isReady,
    isActivated,
    isPaused,
    currentTrack,
    position,
    duration,
    error: playerError,
    play,
    pause,
    resume,
    activate
  } = useSpotifyPlayer(spotifyToken, handleSpotifyStateChange);

  // Keep refs in sync with the latest values so `handleSpotifyStateChange`
  // (memoized on [emit]) can read them without causing SDK re-init.
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { playRef.current = play; }, [play]);

  // When the currently-playing track actually changes, release the
  // auto-advance guard. (Tying it to a timer was fragile — state_changed
  // events don't fire during playback, so a stale timer could miss a real
  // transition.)
  useEffect(() => {
    currentTrackRef.current = currentTrack;
    advancingRef.current = false;
  }, [currentTrack?.id]);

  // Position-driven auto-advance. The Spotify Web Playback SDK's
  // `player_state_changed` listener does NOT fire while position ticks —
  // it only fires on actual transitions. So we key off the 1-second
  // position polling done inside useSpotifyPlayer: when we get within 2s
  // of the track end, play the next queued song ourselves. A 2-second
  // threshold is important — it gives our `PUT /me/player/play` call time
  // to hit Spotify before Spotify's own autoplay kicks in and starts a
  // recommended track on us.
  useEffect(() => {
    if (isPaused) return;
    if (!currentTrack || !duration || duration <= 0) return;
    if (!position || position <= 0) return;
    const remaining = duration - position;
    if (remaining >= 2000) return;
    if (advancingRef.current) return;

    advancingRef.current = true;
    emit('player-song-ended');

    const currentId = currentTrack.id;
    // Prefer a locked "up-next" song if the backend marked one; otherwise
    // take the first queued song that isn't the current track.
    const nextSong =
      queue.find((s) => s.isLocked && s.spotifyTrackId && s.spotifyTrackId !== currentId)
      || queue.find((s) => s.spotifyTrackId && s.spotifyTrackId !== currentId);

    if (nextSong) {
      const uri =
        nextSong.spotifyUri ||
        (nextSong.spotifyTrackId ? `spotify:track:${nextSong.spotifyTrackId}` : null);
      if (uri) {
        console.log(
          `▶️ Auto-advancing to next queued song: "${nextSong.title || uri}" ` +
          `(remaining=${remaining}ms, queueLen=${queue.length})`
        );
        currentSongRef.current = nextSong;
        setCurrentQueueItem(nextSong);
        play(uri);
        return;
      }
      console.warn('Auto-advance: next song has no spotify URI/trackId', nextSong);
    }

    // Nothing to play next — explicitly pause so Spotify's account-level
    // autoplay ("play similar tracks") can't hijack the device and start
    // unrelated songs. User can press Play again when songs are added.
    console.log('Auto-advance: no next song available — pausing.');
    pause();
  }, [position, duration, isPaused, currentTrack, queue, play, pause, emit]);


  // Reload just the queue from the API (used by socket event handlers).
  // Defined with useCallback so socket handlers have a stable reference.
  const loadQueue = useCallback(async () => {
    try {
      const response = await queueAPI.get(sessionName);
      const queued = (response.data.queue || []).filter(s => s.status === 'queued');
      setQueue(queued);
    } catch (err) {
      console.error('Failed to reload queue:', err);
    }
  }, [sessionName]);


  // Load initial session data and get Spotify token
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get session and queue
        const [sessionRes, queueRes] = await Promise.all([
          sessionAPI.get(sessionName),
          queueAPI.get(sessionName)
        ]);
        
        setSession(sessionRes.data.session);
        const queuedSongs = queueRes.data.queue.filter(s => s.status === 'queued');
        setQueue(queuedSongs);

        // Get Spotify access token for player
        const tokenRes = await playerAPI.getToken(sessionName);
        setSpotifyToken(tokenRes.data.accessToken);
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load session:', err);
        const apiError = err.response?.data?.error;
        const statusHint = err.response?.status ? ` (HTTP ${err.response.status})` : '';
        setError(apiError
          ? apiError
          : `Failed to load session${statusHint}. Check the browser console for details.`);
        setLoading(false);
      }
    };

    if (sessionName) {
      loadData();
    }
  }, [sessionName]);

  // Register as active player ONLY after the SDK is ready AND the audio
  // element has been activated by a user gesture. Registering before
  // activation would cause the admin to see controls for a player that
  // cannot actually produce sound yet.
  useEffect(() => {
    if (!isReady || !isActivated || !deviceId) return;

    const register = async () => {
      try {
        await sessionAPI.registerPlayer(sessionName);
        console.log('Registered as active player');
        emit('player-connected', { deviceId });
      } catch (err) {
        console.error('Failed to register player:', err);
      }
    };

    register();

    // Unregister on React unmount. NOTE: this does NOT fire when the user
    // closes the browser tab — that case is handled on the backend by the
    // socket `disconnect` handler (see backend/src/config/socket.js).
    return () => {
      sessionAPI.unregisterPlayer(sessionName).catch(console.error);
      emit('player-disconnected');
    };
  }, [isReady, isActivated, deviceId, sessionName, emit]);

  // Socket event handlers
  useEffect(() => {
    if (!connected) return;

    const handleQueueUpdated = (data) => {
      console.log('📋 queue-updated received');
      if (data.queue) {
        const queuedSongs = data.queue.filter(s => s.status === 'queued');
        setQueue(queuedSongs);
      } else {
        // Fallback to API in case payload didn't include the queue
        loadQueue();
      }
    };

    const handleSongAdded = () => {
      console.log('➕ song-added received');
      loadQueue();
    };

    const handleSongRemoved = () => {
      console.log('➖ song-removed received');
      loadQueue();
    };

    const handleVotesChanged = () => {
      console.log('🗳️ votes-changed received');
      loadQueue();
    };

    const handleSongLocked = (data) => {
      console.log('🔒 song-locked received', data);
      loadQueue();
    };

    const handleNowPlayingUpdated = (data) => {
      // Backend poller's view of the currently-playing track; use it to
      // refresh the queue (the DB status transitions queued→playing and back).
      console.log('🎶 now-playing-updated received', data?.song?.title);
      loadQueue();
    };


    const handlePlayNext = (data) => {
      console.log('Play next song:', data);
      if (data.song && isReady) {
        currentSongRef.current = data.song;
        setCurrentQueueItem(data.song);
        // Some backend paths send a raw trackId, others send spotifyUri.
        const uri = data.song.spotifyUri
          || (data.song.spotifyTrackId ? `spotify:track:${data.song.spotifyTrackId}` : null);
        if (uri) play(uri);
      }
    };

    const handlePlaybackControl = (data) => {
      console.log('Playback control:', data);
      switch (data.action) {
        case 'play': {
          // If something is already loaded and paused, just resume.
          if (currentTrack && isPaused) {
            resume();
            break;
          }
          // If nothing is loaded yet, kick off the top song in the queue.
          if (!currentTrack && queue.length > 0) {
            const next = queue[0];
            const uri = next.spotifyUri
              || (next.spotifyTrackId ? `spotify:track:${next.spotifyTrackId}` : null);
            if (uri) {
              currentSongRef.current = next;
              setCurrentQueueItem(next);
              play(uri);
            } else {
              console.warn('Top queued song has no spotify URI/trackId', next);
            }
          }
          break;
        }
        case 'pause':
          if (!isPaused) {
            pause();
          }
          break;
        case 'skip':
          // Backend will send play-next event
          emit('player-skip-requested');
          break;
        default:
          console.warn('Unknown playback action:', data.action);
      }
    };

    on('queue-updated', handleQueueUpdated);
    on('song-added', handleSongAdded);
    on('song-removed', handleSongRemoved);
    on('votes-changed', handleVotesChanged);
    on('song-locked', handleSongLocked);
    on('now-playing-updated', handleNowPlayingUpdated);
    on('play-next', handlePlayNext);
    on('playback-control', handlePlaybackControl);

    return () => {
      off('queue-updated', handleQueueUpdated);
      off('song-added', handleSongAdded);
      off('song-removed', handleSongRemoved);
      off('votes-changed', handleVotesChanged);
      off('song-locked', handleSongLocked);
      off('now-playing-updated', handleNowPlayingUpdated);
      off('play-next', handlePlayNext);
      off('playback-control', handlePlaybackControl);
    };

  }, [connected, isReady, isPaused, currentTrack, queue, play, pause, resume, on, off, emit, loadQueue]);

  if (loading) {
    return (
      <div className="player-loading">
        <div className="player-spinner"></div>
        <div style={{ marginTop: '30px', fontSize: '24px' }}>
          Initializing TuneSlam Player...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="player-loading">
        <div style={{ fontSize: '64px', marginBottom: '30px' }}>😕</div>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>
          {error}
        </div>
        <div style={{ fontSize: '16px', color: 'rgba(255, 255, 255, 0.6)' }}>
          Note: Spotify Premium is required for the web player
        </div>
      </div>
    );
  }

  if (playerError) {
    return (
      <div className="player-loading">
        <div style={{ fontSize: '64px', marginBottom: '30px' }}>❌</div>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>
          Player Error
        </div>
        <div style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.7)' }}>
          {playerError}
        </div>
      </div>
    );
  }

  if (!session?.isActive) {
    return (
      <div className="player-loading">
        <div style={{ fontSize: '120px', marginBottom: '40px' }}>💤</div>
        <div style={{ fontSize: '48px', fontWeight: '700', marginBottom: '20px' }}>
          Session Not Active
        </div>
        <div style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.6)' }}>
          The session is currently inactive
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="player-loading">
        <div className="player-spinner"></div>
        <div style={{ marginTop: '30px', fontSize: '24px' }}>
          Connecting to Spotify...
        </div>
      </div>
    );
  }

  // One-time activation screen. Browsers block audio autoplay until the
  // Spotify SDK's <audio> element is activated inside a user-gesture event
  // handler in this tab. Without this click, remote Play commands will load
  // a track but leave it silently paused.
  if (!isActivated) {
    return (
      <div
        className="player-loading"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px'
        }}
      >
        <div style={{ fontSize: '80px', marginBottom: '30px' }}>🎵</div>
        <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px' }}>
          TuneSlam Player Ready
        </div>
        <div
          style={{
            fontSize: '18px',
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '520px',
            marginBottom: '40px',
            lineHeight: 1.5
          }}
        >
          Tap the button below once to enable audio playback in this browser.
          After this, the admin's Play / Pause / Skip controls will work.
        </div>
        <button
          onClick={activate}
          style={{
            background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
            color: 'white',
            border: 'none',
            padding: '20px 48px',
            borderRadius: '999px',
            fontSize: '22px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(29, 185, 84, 0.35)'
          }}
        >
          ▶️ Tap to Start Player
        </button>
      </div>
    );
  }

  return (
    <div className="player-container">
      <div className="player-header">
        <div className="player-logo">TuneSlam Player</div>
        
        <div className="player-session-info">
          {session?.qrCode && (
            <img
              src={session.qrCode}
              alt="Session QR Code"
              className="player-qr-code"
            />
          )}
          
          <div className="player-url">
            <div className="player-url-label">Join the queue:</div>
            <div className="player-url-text">
              {session?.sessionUrl?.replace('http://localhost:5174', 'tuneslam.com') || ''}
            </div>
          </div>
        </div>
      </div>

      <div className="player-main">
        <NowPlaying 
          track={currentTrack} 
          position={position} 
          duration={duration}
          isPaused={isPaused}
        />
        {/*
          Hide the currently-playing track from the queue. The backend still
          stores it with status='queued' until the song finishes (the player
          plays it via the Spotify SDK without a DB status update), so we
          filter it out here by Spotify track id.
        */}
        <QueueList
          queue={queue.filter(
            (s) => !currentTrack || s.spotifyTrackId !== currentTrack.id
          )}
        />
      </div>
    </div>
  );
}

export default PlayerPage;
