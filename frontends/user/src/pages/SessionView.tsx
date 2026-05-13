import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { SOCKET_EVENTS } from '@tuneslam/shared';
import { api, errMsg, makeSocket, getToken } from '../lib/api';
import { useQuota } from '../lib/quota';
import type { UserAccount } from '../App';


type AddTab = 'search' | 'library' | 'playlists';

export default function SessionView({ account, setAccount }: { account: UserAccount | null; setAccount: (a: UserAccount | null) => void }) {
  const { slug = '' } = useParams();
  const [session, setSession] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const [err, setErr] = useState('');
  const [exists, setExists] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<AddTab>('search');
  const [library, setLibrary] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [openPlaylist, setOpenPlaylist] = useState<any | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const socketRef = useRef<any>(null);
  const [, setTick] = useState(0);
  // Quota refresher — call after any add/vote (success OR rate-limit
  // error) so the Activity popover reflects the new count without
  // waiting on the 30s background poll.
  const { refresh: refreshQuota } = useQuota();

  // Wall-clock timestamp at which we received the current `nowPlaying`
  // snapshot. Used to extrapolate the progress bar smoothly between the
  // (sparse) socket updates without double-counting elapsed time.
  const [nowPlayingAt, setNowPlayingAt] = useState<number>(Date.now());
  const nav = useNavigate();


  useEffect(() => {
    api.get(`/api/sessions/${slug}/exists`).then((r) => setExists(r.data.exists)).catch(() => setExists(false));
  }, [slug]);

  async function refresh() {
    try {
      const r = await api.get(`/api/user/sessions/${slug}`);
      setSession(r.data.session);
      setNowPlaying(r.data.nowPlaying);
      setNowPlayingAt(Date.now());
      const q = await api.get(`/api/user/sessions/${slug}/queue`);
      setItems(q.data.items);
    } catch (e: any) { setErr(errMsg(e)); }
  }

  useEffect(() => { if (exists) refresh(); }, [exists, !!account]);

  useEffect(() => {
    if (!exists) return;
    const s = makeSocket();
    if (!s) return;
    socketRef.current = s;
    s.on('connect', () => s.emit(SOCKET_EVENTS.joinSession, slug));
    s.on(SOCKET_EVENTS.queueUpdate, (data: any) => setItems(data.items));
    s.on(SOCKET_EVENTS.nowPlayingUpdate, (np: any) => {
      setNowPlaying(np);
      // Reset the extrapolation baseline every time we get a fresh
      // server-side progress snapshot, so the bar stays in sync.
      setNowPlayingAt(Date.now());
    });
    s.on(SOCKET_EVENTS.userBlocked, (data: any) => {
      if (account && data.userId === account.id) setErr(data.blocked ? 'You have been blocked from this session.' : '');
    });
    return () => { s.disconnect(); };
  }, [exists, !!account]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  // Library + playlists — only relevant when the user has linked Spotify.
  // We lazy-load each list when its tab is first opened so we don't burn an
  // API call on every page view. NOTE: this hook MUST run on every render
  // (even when we'd otherwise early-return below), or React's hook order
  // changes when `account` flips from null → object after login.
  useEffect(() => {
    if (!account?.spotifyLinked) return;
    if (tab === 'library' && library.length === 0) {
      api.get('/api/user/spotify/library')
        .then((r) => setLibrary(r.data.items))
        .catch((e) => setErr(errMsg(e)));
    }
    if (tab === 'playlists' && playlists.length === 0) {
      api.get('/api/user/spotify/playlists')
        .then((r) => setPlaylists(r.data.items))
        .catch((e) => setErr(errMsg(e)));
    }
  }, [tab, account?.spotifyLinked]);

  if (exists === null) return <div className="center"><div className="mute">Loading…</div></div>;
  if (!exists) return <div className="center"><div className="card"><h1>No session at /{slug}</h1><Link to="/">Try another</Link></div></div>;

  if (!account) {
    return (
      <div className="center">
        <div className="card col">
          <h1>Join @{slug}</h1>
          <div className="mute">Sign in or create an account to add and vote on songs.</div>
          <div className="row">
            <Link to="/login" state={{ from: `/${slug}` }} className="btn btn-primary">Log in</Link>
            <Link to="/register" state={{ from: `/${slug}` }} className="btn">Sign up</Link>
          </div>
        </div>
      </div>
    );
  }

  async function doSearch(e?: any) {
    e?.preventDefault?.();
    if (!search.trim()) return;
    setBusy(true);
    try {
      // Pass the session slug so unlinked users still get results via the
      // host admin's Spotify token. Linked users just use their own token
      // (the backend prefers it automatically).
      const r = await api.get('/api/user/spotify/search', { params: { q: search, slug } });
      setResults(r.data.items);
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  async function add(trackId: string) {
    try {
      await api.post(`/api/user/sessions/${slug}/queue`, { trackId });
      setSearch(''); setResults([]);
    } catch (e: any) {
      setErr(errMsg(e));
    } finally {
      // Refresh either way: a successful add bumps `songsUsedThisHour`,
      // and a rate-limit-rejection (the only "expected" error) does
      // not change quota — but other races (e.g. just-rolled-over
      // window) might. Cheap call.
      refreshQuota();
    }
  }


  async function openPlaylistTracks(p: any) {
    setOpenPlaylist(p);
    setPlaylistTracks([]);
    try {
      const r = await api.get(`/api/user/spotify/playlists/${p.id}/tracks`);
      setPlaylistTracks(r.data.items);
    } catch (e: any) { setErr(errMsg(e)); }
  }

  async function linkSpotify() {
    try {
      const r = await api.get('/api/auth/spotify/user/link/url');
      window.location.href = r.data.url;
    } catch (e: any) { setErr(errMsg(e)); }
  }

  async function vote(itemId: string, pressed: 1 | -1) {
    try {
      await api.post(`/api/user/sessions/${slug}/queue/${itemId}/vote`, { pressed });
    } catch (e: any) {
      setErr(errMsg(e));
    } finally {
      // See add() — same reasoning. The vote endpoint bumps
      // `votesUsedThisHour` on success, and we want the popover to
      // reflect that immediately.
      refreshQuota();
    }
  }


  const computedProgressMs = (() => {
    if (!nowPlaying?.track) return 0;
    // Extrapolate from when we received the snapshot, NOT from
    // `startedAt`. The server-pushed `progressMs` already accounts for
    // elapsed-since-start; using `startedAt` as the base would
    // double-count and cause the bar to run at ~2x speed (and hit 100%
    // around the song's actual halfway point).
    const base = nowPlaying.progressMs || 0;
    const elapsed = nowPlaying.isPaused ? 0 : Date.now() - nowPlayingAt;
    return Math.min(base + elapsed, nowPlaying.track.durationMs ?? base + elapsed);
  })();

  return (
    <div className="container col">
      {err && <div className="error" onClick={() => setErr('')} style={{ cursor: 'pointer' }}>{err}</div>}

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

      <h2 style={{ margin: '12px 0 4px' }}>Queue</h2>
      {items.length === 0 && <div className="mute">Nothing queued yet — add a song!</div>}
      <div className="list">
        {items.map((it, i) => (
          <div key={it.id} className={`queue-item ${it.locked ? 'locked' : ''}`}>
            <div className="pos">{i + 1}</div>
            <img src={it.track.albumArt || ''} alt="" />
            <div className="info">
              <div className="title">{it.track.name} {it.locked && <span className="tag locked">locked</span>}</div>
              <div className="sub">{(it.track.artists || []).map((a: any) => a.name).join(', ')} · {it.addedBy.label}</div>
            </div>
            <div className="votes">{it.netVotes >= 0 ? `+${it.netVotes}` : it.netVotes}</div>
            <div className="actions">
              {/*
                You can't vote on your own song (the backend 403s the
                attempt anyway, with "You cannot vote on your own song.").
                Show a "Your song" tag so it's clear at a glance which
                track in the queue is yours, instead of presenting up/down
                arrows that would just error.
              */}
              {account && it.addedBy.kind === 'user' && it.addedBy.id === account.id ? (
                <span className="tag mute">Your song</span>
              ) : (
                <>
                  <button
                    className={`btn btn-sm ${it.myVote === 1 ? 'btn-primary' : ''}`}
                    onClick={() => vote(it.id, 1)}
                    disabled={it.locked}
                    aria-pressed={it.myVote === 1}
                  >▲</button>
                  {/*
                    Hide the downvote arrow entirely when this session
                    has `downvoteBehavior === 'disabled'`. The backend
                    also 403s the request in that mode (defense in
                    depth) — this just stops us from rendering a
                    button that can't do anything. `noEffectOnOrder`
                    keeps the button: the vote still affects the
                    threshold, only the displayed queue order is
                    masked.
                  */}
                  {session?.settings?.downvoteBehavior !== 'disabled' && (
                    <button
                      className={`btn btn-sm ${it.myVote === -1 ? 'btn-danger' : ''}`}
                      onClick={() => vote(it.id, -1)}
                      disabled={it.locked}
                      aria-pressed={it.myVote === -1}
                    >▼</button>
                  )}
                </>
              )}

            </div>

          </div>
        ))}
      </div>

      <h2 style={{ margin: '16px 0 4px' }}>Add a song</h2>
      <div className="tabs">
        {(['search', 'library', 'playlists'] as const).map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setOpenPlaylist(null); }}>{t}</div>
        ))}
      </div>

      {tab === 'search' && (
        <>
          <form onSubmit={doSearch} className="row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Spotify…" />
            <button className="btn btn-primary" disabled={busy}>{busy ? '…' : 'Search'}</button>
          </form>
          <div className="list">
            {results.map((t) => (
              <div key={t.id} className="queue-item">
                <img src={t.albumArt || ''} alt="" />
                <div className="info"><div className="title">{t.name}</div><div className="sub">{t.artists.map((a: any) => a.name).join(', ')}</div></div>
                <button className="btn btn-sm btn-primary" onClick={() => add(t.id)}>Add</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'library' && (
        !account.spotifyLinked ? (
          <div className="card col">
            <div className="mute">Link your Spotify to add songs from your saved library.</div>
            <button className="btn btn-primary" onClick={linkSpotify}>Link Spotify</button>
          </div>
        ) : (
          <div className="list">
            {library.length === 0 && <div className="mute">Loading your library…</div>}
            {library.map((t) => (
              <div key={t.id} className="queue-item">
                <img src={t.albumArt || ''} alt="" />
                <div className="info"><div className="title">{t.name}</div><div className="sub">{t.artists.map((a: any) => a.name).join(', ')}</div></div>
                <button className="btn btn-sm btn-primary" onClick={() => add(t.id)}>Add</button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'playlists' && (
        !account.spotifyLinked ? (
          <div className="card col">
            <div className="mute">Link your Spotify to add songs from your playlists.</div>
            <button className="btn btn-primary" onClick={linkSpotify}>Link Spotify</button>
          </div>
        ) : openPlaylist ? (
          <div className="col">
            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => { setOpenPlaylist(null); setPlaylistTracks([]); }}>← Playlists</button>
              <div style={{ fontWeight: 600 }}>{openPlaylist.name}</div>
            </div>
            <div className="list">
              {playlistTracks.length === 0 && <div className="mute">Loading…</div>}
              {playlistTracks.map((t) => (
                <div key={t.id} className="queue-item">
                  <img src={t.albumArt || ''} alt="" />
                  <div className="info"><div className="title">{t.name}</div><div className="sub">{t.artists.map((a: any) => a.name).join(', ')}</div></div>
                  <button className="btn btn-sm btn-primary" onClick={() => add(t.id)}>Add</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="list">
            {playlists.length === 0 && <div className="mute">Loading your playlists…</div>}
            {playlists.map((p) => (
              <div key={p.id} className="queue-item" onClick={() => openPlaylistTracks(p)} style={{ cursor: 'pointer' }}>
                <img src={p.image || ''} alt="" />
                <div className="info"><div className="title">{p.name}</div><div className="sub">{p.tracks} tracks</div></div>
                <div className="mute">›</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
