import { useEffect, useState } from 'react';
import { Routes, Route, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, errMsg, getToken, setToken } from './lib/api';
import { usePlayer } from './lib/usePlayer';

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

  return (
    <div className="player-root">
      {err && <div className="error" style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 99 }}>{err}</div>}
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
          <div className="list" style={{ marginBottom: 16 }}>
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

          <h3>Join the party</h3>
          <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div style={{ background: '#fff', padding: 8, borderRadius: 8 }}>
              <QRCodeSVG value={userJoinUrl} size={140} />
            </div>
            <div>
              <div className="mute">Scan or visit</div>
              <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{userJoinUrl}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
