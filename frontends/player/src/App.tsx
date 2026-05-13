import { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

import { api, errMsg, getToken, setToken } from './lib/api';
import { usePlayer } from './lib/usePlayer';
import { ActivityTicker } from './components/ActivityTicker';
import { Leaderboard, LeaderboardEntry } from './components/Leaderboard';

/**
 * How long the leaderboard stays visible after a new song starts
 * before flipping back to the queue. Spec: 5 seconds.
 */
const LEADERBOARD_VISIBLE_MS = 5000;



export default function App() {
  return (
    <Routes>
      <Route path="/:slug" element={<PlayerView />} />
      <Route path="*" element={<div className="center"><div className="card">Open the player from the admin dashboard.</div></div>} />
    </Routes>
  );
}

function PlayerView() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [err, setErr] = useState('');

  // Capture token from URL
  useEffect(() => {
    const t = params.get('token');
    if (t) {
      setToken(t);
      setAuthed(true);
      // strip token from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  if (!authed) return <div className="center"><div className="card">Missing player token. Open the player from the admin dashboard.</div></div>;

  return <PlayerInner slug={slug} onErr={setErr} err={err} />;
}

function PlayerInner({ slug, err, onErr }: { slug: string; err: string; onErr: (s: string) => void }) {
  const player = usePlayer(slug, onErr);
  const userJoinUrl = `${(import.meta as any).env.VITE_USER_URL}/${slug}`;

  // Karma leaderboard wall display.
  //
  // The queue card "flips" to show the leaderboard for 5 seconds every
  // time a new song starts, then flips back. We watch
  // `nowPlaying.track.id` for transitions and trigger the flip on a
  // genuine *change* (not on initial paint, not on null↔null pause
  // bounces).
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // Track ID we last reacted to. Initialized lazily so the first
  // observed track ID (which may already be playing when the player
  // first loads) is treated as the baseline rather than as a
  // "transition" — we don't want to flip into the leaderboard the
  // instant the page paints.
  const lastTrackIdRef = useRef<string | null>(null);
  const initialisedRef = useRef(false);
  // Holding refs for the visibility timer so a second new-song event
  // landing within the 5s window cleanly extends the visible window
  // (clear+reset) instead of double-firing setTimeouts.
  const hideTimerRef = useRef<number | null>(null);

  const currentTrackId = player.nowPlaying?.track?.id ?? null;

  useEffect(() => {
    // Wait for the first real track ID to land, then mark the ref so
    // future ID changes are treated as transitions.
    if (!initialisedRef.current) {
      if (currentTrackId) {
        lastTrackIdRef.current = currentTrackId;
        initialisedRef.current = true;
      }
      return;
    }
    if (!currentTrackId) return; // brief null between songs — ignore
    if (currentTrackId === lastTrackIdRef.current) return;
    lastTrackIdRef.current = currentTrackId;

    // New song! Fetch fresh data, then flip in.
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get('/api/player/leaderboard');
        if (cancelled) return;
        setLeaderboard(r.data.leaderboard as LeaderboardEntry[]);
      } catch (e: any) {
        // Don't surface errors here — the wall display has nowhere to
        // put them and a stale leaderboard is better than a flicker.
      }
      if (cancelled) return;
      setShowLeaderboard(true);
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = window.setTimeout(() => {
        setShowLeaderboard(false);
        hideTimerRef.current = null;
      }, LEADERBOARD_VISIBLE_MS);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrackId]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);



  // The QR code never changes during a session, but the parent re-renders
  // twice a second (progress bar tick) and `<QRCodeSVG>` is non-trivial
  // — it generates 400+ SVG paths every render. Memoizing it removes
  // that work from the hot path and avoids GPU contention with the
  // Spotify Web Playback SDK's audio worker (which manifested as
  // intermittent audio glitches).
  const qrSvg = useMemo(
    () => <QRCodeSVG value={userJoinUrl} size={96} />,
    [userJoinUrl],
  );


  return (
    <div className="player-root">
      {err && <div className="error" style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 99 }}>{err}</div>}

      {/*
        Header bar: TuneSlam logo on the left, the session join URL +
        QR code on the right. The logo asset lives in
        `frontends/player/public/logo-wide-full.png` and is served by
        Vite from the site root. The URL text is colored with the
        accent (Spotify green, #1db954) which matches the logo so the
        eye stitches them together as one unit.
      */}
      <header className="player-header">
        <img
          src="/logo-wide-full.png"
          alt="TuneSlam"
          className="player-logo"
          // The logo is the brand mark, so screen readers can pick up
          // the alt text; we don't need it as a heading.
        />
        <div className="spacer" />
        <div className="player-join">
          <div className="player-join-text">
            <div className="player-join-label">Scan to join</div>
            <div className="player-join-url">{userJoinUrl}</div>
          </div>
          <div className="player-qr">
            {qrSvg}
          </div>

        </div>
      </header>

      <div className="player-grid">
        <div className="player-now">
          {player.nowPlaying?.track ? (
            <>
              <img className="player-art" src={player.nowPlaying.track.albumArt || ''} alt="" />
              <div className="player-title">{player.nowPlaying.track.name}</div>
              <div className="player-sub">{(player.nowPlaying.track.artists || []).map((a: any) => a.name).join(', ')}</div>
              <div className="progress" style={{ width: '60%', maxWidth: 640, marginTop: 16 }}>
                <div style={{ width: `${player.progressPct}%` }} />
              </div>
              <div className="mute" style={{ marginTop: 12 }}>{player.deviceReady ? (player.isPaused ? 'Paused' : 'Playing') : 'Connecting…'}</div>
            </>
          ) : (
            <>
              <div className="player-title">No song playing</div>
              <div className="mute">Waiting for the queue…</div>
            </>
          )}
        </div>

        {/*
          Side panel = card-flipper containing two faces (queue +
          leaderboard). Both faces are rendered inside the same
          parent so the flip is a CSS transform on the parent, not a
          DOM swap. `is-flipped` toggles the transform.
        */}
        <div
          className={`player-side player-side-flipper${showLeaderboard ? ' is-flipped' : ''}`}
        >
          {/* Queue face — shown by default. */}
          <div className="player-side-card player-side-card-front">
            <h3>Up next</h3>
            <div className="list">
              {player.queue.slice(0, 8).map((it: any, i: number) => (
                <div key={it.id} className={`queue-item ${it.locked ? 'locked' : ''}`}>
                  <div className="pos">{i + 1}</div>
                  <img src={it.track.albumArt || ''} alt="" />
                  <div className="info">
                    <div className="title">{it.track.name}</div>
                    <div className="sub">{(it.track.artists || []).map((a: any) => a.name).join(', ')}</div>
                  </div>
                  <div className="votes">{it.netVotes >= 0 ? `+${it.netVotes}` : it.netVotes}</div>
                </div>
              ))}
              {player.queue.length === 0 && <div className="mute">Empty.</div>}
            </div>
          </div>
          {/* Leaderboard face — shown for 5 s after each new song starts. */}
          <div className="player-side-card player-side-card-back">
            <Leaderboard entries={leaderboard} />
          </div>
        </div>

      </div>

      {/*
        Activity ticker — fixed footer, slides events right→left as
        users add songs / vote / join. Subscribes to the same socket
        the queue+nowplaying do; render-only when the socket is up.
      */}
      <ActivityTicker socket={(player as any).socket} />
    </div>
  );

}

