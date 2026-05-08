import { useState, useEffect, useRef, useCallback } from 'react';

export const useSpotifyPlayer = (accessToken, onStateChange) => {
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);
  const stateIntervalRef = useRef(null);

  useEffect(() => {
    if (!accessToken) return;

    // Wait for Spotify SDK to load
    const initPlayer = () => {
      if (!window.Spotify) {
        console.error('Spotify SDK not loaded');
        setError('Spotify SDK failed to load');
        return;
      }

      const spotifyPlayer = new window.Spotify.Player({
        name: 'TuneSlam Web Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.8
      });

      // Error handling
      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        console.error('Initialization error:', message);
        setError(`Initialization error: ${message}`);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Authentication error:', message);
        setError(`Authentication error: ${message}. Please ensure you have Spotify Premium.`);
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('Account error:', message);
        setError(`Account error: ${message}. Spotify Premium is required.`);
      });

      spotifyPlayer.addListener('playback_error', ({ message }) => {
        console.error('Playback error:', message);
        setError(`Playback error: ${message}`);
      });

      // Ready
      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        setDeviceId(device_id);
        setIsReady(true);
        setError(null);
      });

      // Not Ready
      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
        setIsReady(false);
      });

      // Player state changed
      spotifyPlayer.addListener('player_state_changed', state => {
        if (!state) return;

        console.log('Player state changed:', state);
        
        setIsPaused(state.paused);
        setPosition(state.position);
        setDuration(state.duration);

        const track = state.track_window.current_track;
        if (track) {
          setCurrentTrack({
            id: track.id,
            name: track.name,
            artists: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            albumArt: track.album.images[0]?.url,
            uri: track.uri,
            duration: track.duration_ms
          });
        }

        // Call parent state change handler
        if (onStateChange) {
          onStateChange({
            isPaused: state.paused,
            position: state.position,
            duration: state.duration,
            track: track ? {
              id: track.id,
              name: track.name,
              artists: track.artists.map(a => a.name).join(', '),
              uri: track.uri
            } : null
          });
        }
      });

      // Connect to the player
      spotifyPlayer.connect().then(success => {
        if (success) {
          console.log('The Web Playback SDK successfully connected to Spotify!');
        }
      });

      playerRef.current = spotifyPlayer;
      setPlayer(spotifyPlayer);
    };

    // The SDK may have already loaded (and fired its ready callback into our
    // index.html stub) before this hook runs, OR it may still be loading.
    // Handle both cases:
    //   1. If window.Spotify is already available, init immediately.
    //   2. If the stub recorded that SDK finished loading, init immediately.
    //   3. Otherwise, register our real callback for when it does load.
    if (window.Spotify) {
      initPlayer();
    } else if (window.__spotifySDKReady) {
      // SDK loaded but we missed the event - Spotify global should exist shortly
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = () => {
        window.__spotifySDKReady = true;
        initPlayer();
      };
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
      }
    };
  }, [accessToken, onStateChange]);

  // Poll for current position updates
  useEffect(() => {
    if (!player || isPaused) {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
        stateIntervalRef.current = null;
      }
      return;
    }

    // Update position every second while playing
    stateIntervalRef.current = setInterval(async () => {
      const state = await player.getCurrentState();
      if (state) {
        setPosition(state.position);
      }
    }, 1000);

    return () => {
      if (stateIntervalRef.current) {
        clearInterval(stateIntervalRef.current);
      }
    };
  }, [player, isPaused]);

  const play = useCallback(async (spotifyUri) => {
    if (!player || !deviceId) return;

    try {
      // Use Spotify Web API to start playback
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [spotifyUri] }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start playback');
      }
    } catch (err) {
      console.error('Play error:', err);
      setError(`Playback error: ${err.message}`);
    }
  }, [player, deviceId, accessToken]);

  const pause = useCallback(async () => {
    if (!player) return;
    try {
      await player.pause();
    } catch (err) {
      console.error('Pause error:', err);
    }
  }, [player]);

  const resume = useCallback(async () => {
    if (!player) return;
    try {
      await player.resume();
    } catch (err) {
      console.error('Resume error:', err);
    }
  }, [player]);

  const seek = useCallback(async (positionMs) => {
    if (!player) return;
    try {
      await player.seek(positionMs);
    } catch (err) {
      console.error('Seek error:', err);
    }
  }, [player]);

  const setVolume = useCallback(async (volume) => {
    if (!player) return;
    try {
      await player.setVolume(volume);
    } catch (err) {
      console.error('Volume error:', err);
    }
  }, [player]);

  // Activate the SDK's audio element. MUST be called inside a user-gesture
  // event handler (e.g. onClick) in the player tab itself — modern browsers
  // block audio autoplay until this happens. Without it, `play()` will load
  // a track but the browser will silently keep it paused (which is the
  // "moves to Now Playing but says Paused" bug).
  const activate = useCallback(async () => {
    if (!player) return false;
    try {
      if (typeof player.activateElement === 'function') {
        await player.activateElement();
      }
      setIsActivated(true);
      return true;
    } catch (err) {
      console.error('activateElement error:', err);
      setError(`Failed to activate player: ${err.message || err}`);
      return false;
    }
  }, [player]);

  return {
    player,
    deviceId,
    isReady,
    isActivated,
    isPaused,
    currentTrack,
    position,
    duration,
    error,
    play,
    pause,
    resume,
    seek,
    setVolume,
    activate
  };
};
