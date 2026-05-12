import { useEffect, useMemo, useRef, useState } from 'react';
import { SOCKET_EVENTS } from '@tuneslam/shared';
import { api, errMsg, makeSocket, USER_URL, PLAYER_URL, API_BASE, getToken } from '../lib/api';
import type { AdminAccount } from '../App';

interface NowPlaying {
  track: any | null;
  isPaused: boolean;
  progressMs: number;
  startedAt: string | null;
}

interface QueueItem {
  id: string;
  track: any;
  addedBy: { kind: string; id: string | null; label: string };
  netVotes: number;
  upvotes: number;
  downvotes: number;
  myVote: number;
  locked: boolean;
  addedAt: string;
}

interface Session {
  id: string;
  slug: string;
  active: boolean;
  settings: any;
  spotifyLinked: boolean;
}

export default function Dashboard({ account, setAccount }: { account: AdminAccount; setAccount: (a: AdminAccount) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'search' | 'library' | 'playlists' | 'genre'>('search');
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<any>(null);
  const [progressTick, setProgressTick] = useState(0);
  // Wall-clock timestamp at which we received the current `nowPlaying`
  // snapshot, used for accurate progress-bar extrapolation. We can't
  // extrapolate from `startedAt` because the server-pushed `progressMs`
  // already includes elapsed-since-start — using `startedAt` would
  // double-count and run the bar at ~2x speed.
  const [nowPlayingAt, setNowPlayingAt] = useState<number>(Date.now());

  // Load initial state
  useEffect(() => {
    refresh();
  }, []);

  // Socket
  useEffect(() => {
    if (!session) return;
    const s = makeSocket();
    if (!s) return;
    socketRef.current = s;
    s.on('connect', () => s.emit(SOCKET_EVENTS.joinSession, session.slug));
    s.on(SOCKET_EVENTS.queueUpdate, (data: any) => { setItems(data.items); });
    s.on(SOCKET_EVENTS.nowPlayingUpdate, (np: any) => {
      setNowPlaying(np);
      setNowPlayingAt(Date.now());
    });
    s.on(SOCKET_EVENTS.sessionActive, (data: any) => setSession((cur) => cur ? { ...cur, active: data.active } : cur));
    return () => { s.disconnect(); };
  }, [session?.slug]);

  // Tick for progress bar
  useEffect(() => {
    const t = setInterval(() => setProgressTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    try {
      const r = await api.get('/api/admin/session');
      setSession(r.data.session);
      setNowPlaying(r.data.nowPlaying || null);
      setNowPlayingAt(Date.now());
      if (r.data.session) {
        const q = await api.get('/api/admin/session/queue');
        setItems(q.data.items);
      }
    } catch (e: any) { setErr(errMsg(e)); }
  }

  if (!session) return <CreateSession onCreated={refresh} />;
  if (!session.spotifyLinked) return <LinkSpotify onLinked={refresh} />;

  const computedProgressMs = (() => {
    if (!nowPlaying?.track) return 0;
    const base = nowPlaying.progressMs || 0;
    const elapsed = nowPlaying.isPaused ? 0 : Date.now() - nowPlayingAt;
    return Math.min(base + elapsed, nowPlaying.track.durationMs ?? base + elapsed);
  })();
  void progressTick;

  // Spotify track popularity (0-100) → 1-5 stars.
  function popToStars(p: number): number {
    if (p <= 20) return 1;
    if (p <= 40) return 2;
    if (p <= 60) return 3;
    if (p <= 80) return 4;
    return 5;
  }
  function Stars({ popularity }: { popularity: number }) {
    const filled = popToStars(popularity ?? 0);
    return (
      <span title={`Popularity ${popularity ?? 0}/100`} style={{ letterSpacing: 1 }}>
        {'★'.repeat(filled)}
        <span style={{ opacity: 0.35 }}>{'★'.repeat(5 - filled)}</span>
      </span>
    );
  }

  async function toggleActive() {
    setBusy(true); setErr('');
    try {
      const r = await api.patch('/api/admin/session/active', { active: !session!.active });
      setSession(r.data.session);
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  async function reset() {
    if (!confirm('Reset queue? This clears all queued songs and history.')) return;
    try { await api.post('/api/admin/session/reset'); await refresh(); }
    catch (e: any) { setErr(errMsg(e)); }
  }

  async function play() { await api.post('/api/admin/session/player/play').catch(() => {}); }
  async function pause() { await api.post('/api/admin/session/player/pause').catch(() => {}); }
  async function skip() { await api.post('/api/admin/session/player/skip').catch(() => {}); }

  async function vote(itemId: string, pressed: 1 | -1) {
    try { await api.post(`/api/admin/session/queue/${itemId}/vote`, { pressed }); }
    catch (e: any) { setErr(errMsg(e)); }
  }

  async function removeItem(itemId: string) {
    try { await api.delete(`/api/admin/session/queue/${itemId}`); }
    catch (e: any) { setErr(errMsg(e)); }
  }

  async function addTrack(trackId: string, force = false) {
    try {
      await api.post('/api/admin/session/queue', { trackId, force });
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.canForce) {
        if (confirm(`${data.error}\n\nAdd anyway?`)) return addTrack(trackId, true);
      } else {
        setErr(errMsg(e));
      }
    }
  }

  async function blacklist(trackId: string) {
    try { await api.post('/api/admin/blacklist', { trackId }); alert('Track blacklisted.'); }
    catch (e: any) { setErr(errMsg(e)); }
  }

  async function openPlayer() {
    const r = await api.post('/api/admin/session/player/launch-token');
    window.open(r.data.playerUrl, '_blank');
  }

  const userLink = `${USER_URL}/${session.slug}`;

  return (
    <div className="container">
      {err && <div className="error" onClick={() => setErr('')} style={{ marginBottom: 12, cursor: 'pointer' }}>{err}</div>}

      <div className="row-wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div>
          <div className="mute">Session</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>/{session.slug}</div>
        </div>
        <div>
          <div className="mute">User join link</div>
          <a href={userLink} target="_blank">{userLink}</a>
        </div>
        <span className="spacer" />
        <button className={`btn ${session.active ? 'btn-danger' : 'btn-primary'}`} onClick={toggleActive} disabled={busy}>
          {session.active ? 'Stop session' : 'Start session'}
        </button>
        <button className="btn" onClick={openPlayer}>Open Player</button>
        <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(userLink)}>Copy link</button>
      </div>

      <div className="grid-2">
        <div className="col">
          {/* Playback controls live outside the now-playing card so the admin
              can press "Play" to kick off the very first song (when there's
              nothing currently loaded yet, but there are queued items). */}
          <div className="row" style={{ gap: 6, marginBottom: 8 }}>
            {nowPlaying?.track && !nowPlaying.isPaused
              ? <button className="btn btn-sm" onClick={pause}>❚❚ Pause</button>
              : <button
                  className="btn btn-sm btn-primary"
                  onClick={play}
                  disabled={!nowPlaying?.track && items.length === 0}
                >▶ Play</button>}
            <button
              className="btn btn-sm"
              onClick={skip}
              disabled={!nowPlaying?.track && items.length === 0}
            >Skip ⏭</button>
          </div>
          {nowPlaying?.track && (
            <div className="now-playing">
              <img src={nowPlaying.track.albumArt || ''} alt="" />
              <div className="info">
                <div className="title">{nowPlaying.track.name}</div>
                <div className="sub">{(nowPlaying.track.artists || []).map((a: any) => a.name).join(', ')}</div>
                <div className="progress"><div style={{ width: `${Math.min(100, (computedProgressMs / Math.max(1, nowPlaying.track.durationMs)) * 100)}%` }} /></div>
              </div>
            </div>
          )}

          <h2 style={{ margin: '16px 0 8px' }}>Queue</h2>
          {items.length === 0 && <div className="mute">Queue is empty.</div>}
          <div className="list">
            {items.map((it, i) => (
              <div key={it.id} className={`queue-item ${it.locked ? 'locked' : ''}`}>
                <div className="pos">{i + 1}</div>
                <img src={it.track.albumArt || ''} alt="" />
                <div className="info">
                  <div className="title">{it.track.name} {it.locked && <span className="tag locked">locked</span>}</div>
                  <div className="sub">
                    {(it.track.artists || []).map((a: any) => a.name).join(', ')} · added by {it.addedBy.label}
                    {' · '}
                    <Stars popularity={it.track.popularity ?? 0} />
                    <span className="mute" style={{ marginLeft: 4 }}>({it.track.popularity ?? 0})</span>
                  </div>
                </div>
                <div className="votes">{it.netVotes >= 0 ? `+${it.netVotes}` : it.netVotes}</div>
                <div className="actions">
                  {/*
                    Backend rejects self-votes ("You cannot vote on your
                    own song.") so we replace the up/down arrows with a
                    "Your song" tag for the song's author. Admin still
                    keeps the ✕ remove button — they manage the queue.
                  */}
                  {it.addedBy.kind === 'admin' && it.addedBy.id === account.id ? (
                    <span className="tag mute">Your song</span>
                  ) : (
                    <>
                      <button
                        className={`btn btn-sm ${it.myVote === 1 ? 'btn-primary' : ''}`}
                        onClick={() => vote(it.id, 1)}
                        disabled={it.locked}
                        aria-pressed={it.myVote === 1}
                      >▲</button>
                      <button
                        className={`btn btn-sm ${it.myVote === -1 ? 'btn-danger' : ''}`}
                        onClick={() => vote(it.id, -1)}
                        disabled={it.locked}
                        aria-pressed={it.myVote === -1}
                      >▼</button>
                    </>
                  )}
                  <button className="btn btn-sm" onClick={() => removeItem(it.id)}>✕</button>
                </div>

              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={reset}>Reset queue</button>
          </div>
        </div>

        <div className="col">
          <h2>Add a song</h2>
          <div className="tabs">
            {(['search', 'library', 'playlists', 'genre'] as const).map((t) => (
              <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>
            ))}
          </div>
          {tab === 'search' && <SearchTab onAdd={addTrack} onBlacklist={blacklist} />}
          {tab === 'library' && <LibraryTab onAdd={addTrack} onBlacklist={blacklist} />}
          {tab === 'playlists' && <PlaylistsTab />}
          {tab === 'genre' && <div className="mute">Set the genre/playlist autofill in <a href="/settings">Settings</a>.</div>}
        </div>
      </div>
    </div>
  );
}

function CreateSession({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.post('/api/admin/sessions', { slug });
      onCreated();
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="center">
      <form className="card col" onSubmit={submit}>
        <h1>Create your session</h1>
        <div className="mute">Pick a unique URL slug. Users will join at /{slug || '<slug>'}.</div>
        {err && <div className="error">{err}</div>}
        <div><label>Session slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9-]+" required minLength={3} maxLength={40} />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create session'}</button>
      </form>
    </div>
  );
}

function LinkSpotify({ onLinked }: { onLinked: () => void }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await api.get('/api/auth/spotify/admin/url');
      window.location.href = r.data.url;
    } finally { setBusy(false); }
  }
  return (
    <div className="center">
      <div className="card col">
        <h1>Link your Spotify</h1>
        <div className="mute">TuneSlam needs access to a Spotify Premium account to play music.</div>
        <button className="btn btn-primary" onClick={go} disabled={busy}>Connect Spotify</button>
      </div>
    </div>
  );
}

function SearchTab({ onAdd, onBlacklist }: { onAdd: (id: string) => void; onBlacklist: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  async function go(e?: any) {
    e?.preventDefault?.();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await api.get('/api/admin/spotify/search', { params: { q } });
      setResults(r.data.items);
    } finally { setBusy(false); }
  }
  return (
    <div className="col">
      <form onSubmit={go} className="row">
        <input placeholder="Search Spotify…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}>{busy ? '…' : 'Search'}</button>
      </form>
      <div className="list">
        {results.map((t) => (
          <div key={t.id} className="queue-item">
            <img src={t.albumArt || ''} alt="" />
            <div className="info">
              <div className="title">{t.name}</div>
              <div className="sub">{t.artists.map((a: any) => a.name).join(', ')}</div>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => onAdd(t.id)}>Add</button>
            <button className="btn btn-sm" onClick={() => onBlacklist(t.id)}>Blacklist</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LibraryTab({ onAdd, onBlacklist }: { onAdd: (id: string) => void; onBlacklist: (id: string) => void }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/api/admin/spotify/library').then((r) => setItems(r.data.items)).catch(() => {}); }, []);
  return (
    <div className="list">
      {items.map((t) => (
        <div key={t.id} className="queue-item">
          <img src={t.albumArt || ''} alt="" />
          <div className="info"><div className="title">{t.name}</div><div className="sub">{t.artists.map((a: any) => a.name).join(', ')}</div></div>
          <button className="btn btn-sm btn-primary" onClick={() => onAdd(t.id)}>Add</button>
          <button className="btn btn-sm" onClick={() => onBlacklist(t.id)}>Blacklist</button>
        </div>
      ))}
    </div>
  );
}

function PlaylistsTab() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get('/api/admin/spotify/playlists').then((r) => setItems(r.data.items)).catch(() => {}); }, []);
  return (
    <div className="list">
      {items.map((p) => (
        <div key={p.id} className="queue-item">
          <img src={p.image || ''} alt="" />
          <div className="info"><div className="title">{p.name}</div><div className="sub">{p.tracks} tracks</div></div>
        </div>
      ))}
      <div className="mute" style={{ fontSize: 12 }}>Set autofill from a playlist in Settings.</div>
    </div>
  );
}
