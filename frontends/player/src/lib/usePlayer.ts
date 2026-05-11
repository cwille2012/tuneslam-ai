import { useEffect, useRef, useState } from 'react';
import { SOCKET_EVENTS } from '@tuneslam/shared';
import { api, makeSocket, errMsg } from './api';

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

function loadSdk(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) return resolve();
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    if (!document.querySelector('script[src="' + SDK_URL + '"]')) {
      const s = document.createElement('script');
      s.src = SDK_URL; s.async = true; document.body.appendChild(s);
    }
  });
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export interface PlayerState {
  queue: any[];
  nowPlaying: any | null;
  isPaused: boolean;
  progressMs: number;
  durationMs: number;
  progressPct: number;
  deviceReady: boolean;
  deviceId: string | null;
  replaced: boolean;
}

export function usePlayer(slug: string, onErr: (s: string) => void) {
  const [queue, setQueue] = useState<any[]>([]);
  const [nowPlaying, setNowPlaying] = useState<any | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [replaced, setReplaced] = useState(false);
  const [, setTick] = useState(0);

  const stateRef = useRef({
    isPaused: true,
    progressMs: 0,
    // Wall-clock timestamp at which the SDK last reported `progressMs`. We
    // use this to extrapolate the displayed position between SDK events
    // (which only fire on play/pause/track change), so the progress bar
    // ticks smoothly instead of freezing for ~30s at a time.
    lastUpdateAt: Date.now(),
    durationMs: 0,
    currentTrackId: null as string | null,
    // Track which trackId we've already reported as ended so we don't
    // re-fire /ended for the same track. The Spotify Web Playback SDK
    // emits multiple paused+position=0 state changes around a track
    // boundary (track-end, then again as the next track buffers), and
    // each spurious POST would advance the queue + run autofill.
    lastEndedTrackId: null as string | null,
    deviceId: null as string | null,
    accessToken: '',
  });
  const instanceIdRef = useRef<string>(uuid());
  const playerRef = useRef<any>(null);

  // Claim + load SDK
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.post('/api/player/claim', { instanceId: instanceIdRef.current });
        const tok = await api.get('/api/player/spotify-token');
        stateRef.current.accessToken = tok.data.accessToken;

        await loadSdk();
        if (cancelled) return;
        const player = new window.Spotify.Player({
          name: 'TuneSlam Player',
          getOAuthToken: async (cb: (t: string) => void) => {
            try {
              const r = await api.get('/api/player/spotify-token');
              stateRef.current.accessToken = r.data.accessToken;
              cb(r.data.accessToken);
            } catch (e: any) { onErr(errMsg(e)); }
          },
          volume: 0.8,
        });
        playerRef.current = player;

        player.addListener('ready', ({ device_id }: any) => {
          stateRef.current.deviceId = device_id;
          setDeviceId(device_id);
          setDeviceReady(true);
          // Transfer playback to this device
          fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + stateRef.current.accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [device_id], play: false }),
          }).catch(() => {});
        });
        player.addListener('not_ready', () => setDeviceReady(false));
        player.addListener('initialization_error', ({ message }: any) => onErr('Spotify init error: ' + message));
        player.addListener('authentication_error', ({ message }: any) => onErr('Spotify auth error: ' + message));
        player.addListener('account_error', ({ message }: any) => onErr('Spotify account error: ' + message + ' (Premium required)'));
        player.addListener('player_state_changed', (state: any) => {
          if (!state) return;
          stateRef.current.isPaused = state.paused;
          stateRef.current.progressMs = state.position;
          stateRef.current.lastUpdateAt = Date.now();
          stateRef.current.durationMs = state.duration;
          const trackId = state.track_window?.current_track?.id ?? null;
          const wasTrackId = stateRef.current.currentTrackId;
          // Detect a *real* end-of-track. The Spotify Web Playback SDK
          // signals end-of-track with `paused=true, position=0`, and the
          // `current_track` in `track_window` is still the just-finished
          // track (it has not yet advanced). A state event whose
          // `trackId !== wasTrackId` is a *track change* in progress —
          // never an "end" — so we must NOT treat it as one.
          const ended =
            !!wasTrackId &&
            state.paused &&
            state.position === 0 &&
            trackId === wasTrackId;
          if (ended && wasTrackId !== stateRef.current.lastEndedTrackId) {
            stateRef.current.lastEndedTrackId = wasTrackId;
            api.post('/api/player/ended', { trackId: wasTrackId }).catch(() => {});
          }
          stateRef.current.currentTrackId = trackId;
          setTick((x) => x + 1);
        });
        await player.connect();
      } catch (e: any) {
        onErr(errMsg(e));
      }
    })();
    return () => { cancelled = true; if (playerRef.current?.disconnect) playerRef.current.disconnect(); };
  }, []);

  // Heartbeat
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        await api.post('/api/player/heartbeat', { instanceId: instanceIdRef.current });
      } catch (e: any) {
        if (e?.response?.data?.stop) {
          setReplaced(true);
          onErr('This player was replaced by another tab.');
          if (playerRef.current?.disconnect) playerRef.current.disconnect();
        }
      }
    }, 15000);
    return () => clearInterval(t);
  }, []);

  // Push progress
  useEffect(() => {
    const t = setInterval(async () => {
      const s = stateRef.current;
      if (!nowPlaying?.track) return;
      // Extrapolate to "now" so the server sees a smooth, accurate position
      // between sparse SDK state events.
      const elapsed = s.isPaused ? 0 : Date.now() - s.lastUpdateAt;
      const progressMs = Math.min(s.progressMs + elapsed, s.durationMs || Number.MAX_SAFE_INTEGER);
      try {
        await api.post('/api/player/progress', {
          progressMs,
          isPaused: s.isPaused,
          durationMs: s.durationMs,
        });
      } catch {}
    }, 1000);
    return () => clearInterval(t);
  }, [nowPlaying?.track?.id]);

  // Initial state + socket listeners
  useEffect(() => {
    let socket: any;
    (async () => {
      try {
        const r = await api.get('/api/player/state');
        setNowPlaying(r.data.nowPlaying);
        // Queue + nowPlaying snapshots arrive via the socket as soon as we
        // join the session room (server emits them right after the join).
      } catch (e: any) { onErr(errMsg(e)); }
      socket = makeSocket();
      if (!socket) return;
      socket.on('connect', () => socket.emit(SOCKET_EVENTS.joinSession, slug));
      socket.on(SOCKET_EVENTS.queueUpdate, (data: any) => setQueue(data.items));
      socket.on(SOCKET_EVENTS.nowPlayingUpdate, (np: any) => {
        setNowPlaying(np);
        // If a new track is selected, play it
        if (np?.track && stateRef.current.deviceId && np.track.id !== stateRef.current.currentTrackId) {
          playTrack(np.track.id, np.progressMs || 0);
        }
        if (!np?.track && stateRef.current.deviceId) {
          // Pause the player
          fetch('https://api.spotify.com/v1/me/player/pause?device_id=' + stateRef.current.deviceId, {
            method: 'PUT', headers: { Authorization: 'Bearer ' + stateRef.current.accessToken },
          }).catch(() => {});
        }
      });
      socket.on(SOCKET_EVENTS.playerCommand, (cmd: any) => {
        if (!playerRef.current) return;
        if (cmd.command === 'pause') playerRef.current.pause?.();
        else if (cmd.command === 'play') playerRef.current.resume?.();
      });
    })();
    return () => { socket?.disconnect(); };
  }, []);

  // When deviceReady becomes true and we have a now-playing track, start playback
  useEffect(() => {
    if (deviceReady && nowPlaying?.track) {
      playTrack(nowPlaying.track.id, nowPlaying.progressMs || 0);
    }
  }, [deviceReady]);

  async function playTrack(trackId: string, positionMs: number) {
    const did = stateRef.current.deviceId;
    if (!did) return;
    // NOTE: do NOT optimistically overwrite `currentTrackId` or
    // `lastEndedTrackId` here. The SDK will fire a trailing
    // `paused/pos=0` event for the *just-finished* track right after we
    // call playTrack(next), and our end-detection logic in
    // `player_state_changed` relies on `currentTrackId` still pointing at
    // the old track to correctly identify which track ended. If we
    // overwrite it here we'd misidentify the end-event as ending the
    // *new* track and POST /ended for it — causing the queue to skip.
    //
    // We do still reset the *progress display* state so the bar starts
    // moving from `positionMs` immediately, before the SDK's first state
    // event for this track lands.
    stateRef.current.progressMs = positionMs;
    stateRef.current.lastUpdateAt = Date.now();
    stateRef.current.isPaused = false;

    // Refresh the access token before each play. Spotify tokens expire
    // after ~1 hour and the cached one can be stale by the time the next
    // track is supposed to start, which makes the play call silently 401.
    try {
      const r = await api.get('/api/player/spotify-token');
      stateRef.current.accessToken = r.data.accessToken;
    } catch {
      /* ignore — we'll try with the cached token */
    }

    const playOnce = async () =>
      fetch('https://api.spotify.com/v1/me/player/play?device_id=' + did, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + stateRef.current.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: ['spotify:track:' + trackId], position_ms: positionMs }),
      });

    try {
      let resp = await playOnce();
      // 404 NO_ACTIVE_DEVICE happens when Spotify dropped our SDK device
      // off the active list (common right after a track ends naturally).
      // Re-transfer playback to our device, then retry once.
      if (resp.status === 404) {
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + stateRef.current.accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ device_ids: [did], play: false }),
        });
        await new Promise((r) => setTimeout(r, 250));
        resp = await playOnce();
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        onErr(`Spotify play failed (${resp.status}) ${body}`.trim());
      }
    } catch (e: any) {
      onErr(errMsg(e));
    }
  }

  // Tick UI
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 500); return () => clearInterval(t); }, []);

  const dur = stateRef.current.durationMs || nowPlaying?.track?.durationMs || 1;
  // Extrapolate position between sparse SDK state events so the bar ticks.
  const elapsed = stateRef.current.isPaused ? 0 : Date.now() - stateRef.current.lastUpdateAt;
  const displayProgressMs = Math.min(stateRef.current.progressMs + elapsed, dur);
  const pct = (displayProgressMs / dur) * 100;

  return {
    queue,
    nowPlaying,
    isPaused: stateRef.current.isPaused,
    progressMs: displayProgressMs,
    durationMs: dur,
    progressPct: isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0,
    deviceReady,
    deviceId,
    replaced,
  };
}
