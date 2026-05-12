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
    // Track which trackId we most recently *commanded* the SDK to play
    // (i.e. the trackId of our last successful POST to Spotify's
    // `/v1/me/player/play`). The socket-driven nowPlayingUpdate handler
    // would otherwise call playTrack() multiple times for the same
    // track in the ~300–800 ms window between our REST play call and
    // the SDK firing the corresponding `player_state_changed` event —
    // each duplicate play restarts the song from 0 and emits an extra
    // `getOAuthToken` request, contending for audio-worker time and
    // causing audible glitches. Reset to null on natural end-of-track
    // so a subsequent re-add of the same song still plays.
    lastCommandedTrackId: null as string | null,
    deviceId: null as string | null,
    accessToken: '',

  });
  const instanceIdRef = useRef<string>(uuid());
  const playerRef = useRef<any>(null);
  // Live reference to the active Socket.IO client. Exposed via the
  // returned object so consumers like <ActivityTicker> can subscribe to
  // additional events without us having to plumb every event handler
  // through this hook. Updated by the socket effect below.
  const socketRef = useRef<any>(null);
  const [socket, setSocket] = useState<any>(null);


  // Claim + load SDK
  //
  // IMPORTANT: in dev React.StrictMode runs every effect twice
  // (mount → cleanup → mount). The cleanup must tear down the *local*
  // resources created by *that specific* invocation — not whatever
  // currently lives on the shared `playerRef`. Otherwise mount-1's
  // cleanup tears down mount-2's freshly-created SDK and we end up
  // running with mount-1's orphan SDK *plus* mount-2's SDK both active
  // (visible as duplicate `/claim`, `/state`, paired `/spotify-token`,
  // and double socket connect/disconnect lines in the dev log). The
  // orphan SDK's `ready` handler then runs PUT /v1/me/player to
  // transfer playback to itself, which Spotify treats as "restart this
  // track from 0" — that's where the song-repeat bug came from.
  useEffect(() => {
    let cancelled = false;
    let localPlayer: any = null;
    (async () => {
      try {
        await api.post('/api/player/claim', { instanceId: instanceIdRef.current });
        if (cancelled) return;
        const tok = await api.get('/api/player/spotify-token');
        if (cancelled) return;
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
        localPlayer = player;
        playerRef.current = player;


        player.addListener('ready', ({ device_id }: any) => {
          stateRef.current.deviceId = device_id;
          setDeviceId(device_id);
          setDeviceReady(true);
          const auth = 'Bearer ' + stateRef.current.accessToken;
          // Transfer playback to this device.
          fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: { Authorization: auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [device_id], play: false }),
          }).catch(() => {});
          // Force repeat=off and shuffle=off. Spotify Premium maintains
          // these settings *per account*, and a fresh SDK device
          // inherits whatever state the user last left them in (e.g. on
          // their phone). With `repeat=track` enabled, Spotify replays
          // the just-finished track immediately on track-end — racing
          // (and effectively cancelling) our `play(next)` call, which
          // is exactly the song-repeat symptom we were chasing. These
          // calls are idempotent — if it's already off Spotify no-ops.
          fetch(
            'https://api.spotify.com/v1/me/player/repeat?state=off&device_id=' + device_id,
            { method: 'PUT', headers: { Authorization: auth } },
          ).catch(() => {});
          fetch(
            'https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=' + device_id,
            { method: 'PUT', headers: { Authorization: auth } },
          ).catch(() => {});
        });

        player.addListener('not_ready', () => setDeviceReady(false));
        player.addListener('initialization_error', ({ message }: any) => onErr('Spotify init error: ' + message));
        player.addListener('authentication_error', ({ message }: any) => onErr('Spotify auth error: ' + message));
        player.addListener('account_error', ({ message }: any) => onErr('Spotify account error: ' + message + ' (Premium required)'));
        player.addListener('player_state_changed', (state: any) => {
          if (!state) return;
          // Detect a pause↔play transition (vs. just a position update or
          // a track change). When it changes, we need to push immediately
          // so admin/user UIs flip the Play/Pause button without waiting
          // for the next 5 s scheduled /progress post — that gap was
          // exactly the "click pause twice to actually pause" symptom.
          const wasPaused = stateRef.current.isPaused;
          const pauseChanged = wasPaused !== state.paused;
          stateRef.current.isPaused = state.paused;
          stateRef.current.progressMs = state.position;
          stateRef.current.lastUpdateAt = Date.now();
          stateRef.current.durationMs = state.duration;
          if (pauseChanged) {
            api.post('/api/player/progress', {
              progressMs: state.position,
              isPaused: state.paused,
              durationMs: state.duration,
            }).catch(() => {});
          }

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
            // The just-finished track may legitimately be queued again
            // (autofill, manual re-add, etc.). Clear the dedupe so a
            // future playTrack(wasTrackId) is allowed to actually fire.
            stateRef.current.lastCommandedTrackId = null;
            api.post('/api/player/ended', { trackId: wasTrackId }).catch(() => {});
          }

          stateRef.current.currentTrackId = trackId;
          setTick((x) => x + 1);
        });
        await player.connect();
        // If we got cancelled while connecting (StrictMode 2nd cleanup),
        // tear down the SDK we just connected and stop. Note that mount-2
        // may already have replaced `playerRef.current`, so only clear
        // it if it still points at *our* instance.
        if (cancelled) {
          try { player.disconnect?.(); } catch {}
          if (playerRef.current === player) playerRef.current = null;
        }
      } catch (e: any) {
        onErr(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
      if (localPlayer) {
        try { localPlayer.disconnect?.(); } catch {}
        // Don't blow away mount-2's freshly-installed SDK.
        if (playerRef.current === localPlayer) playerRef.current = null;
      }
    };
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
  // The local progress bar is driven entirely client-side by extrapolating
  // off the last SDK state event, so the server-bound POST only needs to
  // run often enough to (a) feed late-joining listeners' Now-Playing UI
  // and (b) let the autofill watcher detect a near-finished track. The
  // backend's socket broadcast is throttled to ~5 s anyway
  // (see routes/player.ts: `progressMs % 5000 < 250`), so a 5 s push
  // cadence is plenty without spamming the network and the dev log.
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
    }, 5000);
    return () => clearInterval(t);
  }, [nowPlaying?.track?.id]);


  // Initial state + socket listeners
  //
  // StrictMode-safe: capture the socket in a local var and disconnect
  // *that* in cleanup, instead of relying on the outer-scope `socket`
  // (which would be overwritten by mount-2 before mount-1's cleanup
  // runs, leaving us with two live sockets — see comment on the SDK
  // effect above).
  useEffect(() => {
    let cancelled = false;
    let localSocket: any = null;
    (async () => {
      try {
        const r = await api.get('/api/player/state');
        if (cancelled) return;
        setNowPlaying(r.data.nowPlaying);
        // Queue + nowPlaying snapshots arrive via the socket as soon as we
        // join the session room (server emits them right after the join).
      } catch (e: any) { if (!cancelled) onErr(errMsg(e)); }
      if (cancelled) return;
      const s = makeSocket();
      if (!s) return;
      if (cancelled) { try { s.disconnect(); } catch {} return; }
      localSocket = s;
      socketRef.current = s;
      // Trigger a re-render so consumers (e.g. <ActivityTicker>) that
      // received `socket = null` on the first render now see the live
      // socket and can subscribe to it.
      setSocket(s);
      s.on('connect', () => s.emit(SOCKET_EVENTS.joinSession, slug));

      s.on(SOCKET_EVENTS.queueUpdate, (data: any) => setQueue(data.items));
      s.on(SOCKET_EVENTS.nowPlayingUpdate, (np: any) => {
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
      s.on(SOCKET_EVENTS.playerCommand, (cmd: any) => {
        if (!playerRef.current) return;
        if (cmd.command === 'pause') playerRef.current.pause?.();
        else if (cmd.command === 'play') playerRef.current.resume?.();
      });
    })();
    return () => {
      cancelled = true;
      if (localSocket) {
        try { localSocket.disconnect(); } catch {}
        // Don't blow away mount-2's freshly-installed socket (same
        // StrictMode pattern as the SDK effect).
        if (socketRef.current === localSocket) {
          socketRef.current = null;
          setSocket(null);
        }
      }
    };
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

    // Dedupe by *commanded* track id, not by SDK-reported `currentTrackId`.
    // The SDK's `player_state_changed` event lags our REST `play` call by
    // 300–800 ms, so an in-flight `nowPlayingUpdate` socket message for
    // the same track would otherwise call playTrack() a second time —
    // restarting the song from 0 and emitting an extra getOAuthToken
    // request that contends with the audio worker (audible glitches).
    if (stateRef.current.lastCommandedTrackId === trackId) return;
    stateRef.current.lastCommandedTrackId = trackId;

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
      // No unconditional pre-fetch of /spotify-token here — we lean on
      // the SDK's getOAuthToken callback for refreshes and only refresh
      // ourselves on a 401 from Spotify (token actually expired). This
      // eliminates the pair of /spotify-token GETs that fired on every
      // track change in the dev log.
      let resp = await playOnce();

      // 401 = cached access token expired. Refresh from our backend and
      // retry once. (Spotify tokens last ~1 h.)
      if (resp.status === 401) {
        try {
          const r = await api.get('/api/player/spotify-token');
          stateRef.current.accessToken = r.data.accessToken;
        } catch { /* fall through with whatever we have */ }
        resp = await playOnce();
      }

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
        // The play command failed — clear the dedupe so we can retry on
        // the next nowPlayingUpdate (otherwise we'd be wedged on this
        // track id forever).
        stateRef.current.lastCommandedTrackId = null;
        onErr(`Spotify play failed (${resp.status}) ${body}`.trim());
      }
    } catch (e: any) {
      stateRef.current.lastCommandedTrackId = null;
      onErr(errMsg(e));
    }
  }


  // Tick UI — re-renders the parent so the progress bar can advance via
  // client-side extrapolation. We skip the re-render entirely while
  // paused, both because there's nothing to animate and to avoid
  // contending with the Spotify Web Playback SDK's audio worker on
  // weaker hardware (which would otherwise glitch the audio output).
  useEffect(() => {
    const t = setInterval(() => {
      if (!stateRef.current.isPaused) setTick((x) => x + 1);
    }, 500);
    return () => clearInterval(t);
  }, []);


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
    /** Live Socket.IO client (or `null` while connecting). */
    socket,
  };
}

