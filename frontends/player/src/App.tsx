import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

import { api, errMsg, getToken, setToken } from './lib/api';
import { usePlayer } from './lib/usePlayer';
import { ActivityTicker } from './components/ActivityTicker';


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

        <div className="player-side">
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

