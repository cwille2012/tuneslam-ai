import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';

import type { LinkedProviderProfile, UserAccount } from '../App';

interface JoinedSession {
  slug: string;
  active: boolean;
  adminLabel: string;
  joinedAt: string;
  lastSeenAt: string;
  blocked: boolean;
}

/**
 * Per-session leaderboard / personal-stats payload returned by
 * GET /api/user/sessions/:slug/me-stats. Driven by the popup that
 * opens when a user taps a row in "Sessions you've joined".
 */
interface SessionMeStats {
  slug: string;
  adminLabel: string;
  me: {
    songsAdded: number;
    songsPlayed: number;
    sessionKarma: number;
    /** 1-indexed rank, or null if the user has never added a song here. */
    rank: number | null;
    /** Total participants who have at least one add (i.e. sortable). */
    total: number;
  };
  leaderboard: Array<{
    rank: number;
    username: string;
    songsAdded: number;
    songsPlayed: number;
    sessionKarma: number;
    isMe: boolean;
  }>;
}


/**
 * Format a Date as a friendly relative string ("2 minutes ago",
 * "3 days ago"). Falls back to a localized date for anything older
 * than a month, since "47 days ago" is less useful than the date.
 */
function relativeTime(input: string): string {
  const then = new Date(input).getTime();
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(input).toLocaleDateString();
}


/**
 * Compact row showing the linked-account avatar + display name. Falls back
 * gracefully when the provider didn't return a name or picture.
 */
/**
 * Tiny stat tile used in the per-session stats popup. Just three of
 * these in a 1fr/1fr/1fr grid — a label up top, a big number below.
 * Pulled out as a component so the JSX in the modal stays scannable.
 */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: 'var(--bg-3)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px',
        textAlign: 'center',
      }}
    >
      <div className="mute" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}


function LinkedProviderRow({ profile }: { profile?: LinkedProviderProfile }) {

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {profile?.pictureUrl ? (
        <img
          src={profile.pictureUrl}
          alt=""
          width={36}
          height={36}
          style={{ borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto' }}
          // If the provider URL goes stale (FB CDN URLs eventually expire),
          // hide the broken image rather than show a busted thumbnail.
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <div className="mute">
        Linked ✓{profile?.name ? ` — ${profile.name}` : ''}
      </div>
    </div>
  );
}


export default function Account({ account, setAccount }: { account: UserAccount; setAccount: (a: UserAccount) => void }) {
  const [form, setForm] = useState({ username: account.username, email: account.email, phone: account.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [stats, setStats] = useState<any>(null);
  const [joinedSessions, setJoinedSessions] = useState<JoinedSession[] | null>(null);
  // The "Sessions you've joined" rows open a stats popup instead of
  // navigating into the session (per product spec — joining is via
  // QR scan / direct link only). `selectedSlug` drives the modal:
  // null means closed, a string means the per-session stats fetch is
  // in flight or its result is shown via `selectedStats`.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<SessionMeStats | null>(null);
  const [selectedErr, setSelectedErr] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { api.get('/api/user/me/stats').then((r) => setStats(r.data.stats)).catch(() => {}); }, []);
  // Fire-and-forget — failure is silent (the section just stays in
  // its loading state). Anything else makes the profile page noisier
  // than it needs to be.
  useEffect(() => {
    api.get('/api/user/me/sessions')
      .then((r) => setJoinedSessions(r.data.items as JoinedSession[]))
      .catch(() => setJoinedSessions([]));
  }, []);


  /**
   * Open the per-session stats popup. Always blanks any prior payload
   * so the modal shows a fresh "Loading…" state instead of the
   * previously-viewed session's numbers while the new fetch is in
   * flight.
   */
  function openSessionStats(slug: string) {
    setSelectedSlug(slug);
    setSelectedStats(null);
    setSelectedErr('');
    api
      .get(`/api/user/sessions/${slug}/me-stats`)
      .then((r) => setSelectedStats(r.data as SessionMeStats))
      .catch((e: any) => setSelectedErr(errMsg(e)));
  }

  function closeSessionStats() {
    setSelectedSlug(null);
    setSelectedStats(null);
    setSelectedErr('');
  }

  async function save(e: any) {

    e.preventDefault(); setErr(''); setMsg('');
    try {
      const r = await api.patch('/api/auth/user/me', form);
      setAccount(r.data.account);
      setMsg('Saved.');
    } catch (e: any) { setErr(errMsg(e)); }
  }
  async function changePw(e: any) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      await api.post('/api/auth/user/me/password', pw);
      setMsg('Password updated.'); setPw({ currentPassword: '', newPassword: '' });
    } catch (e: any) { setErr(errMsg(e)); }
  }
  // Use the *authenticated* link endpoint (mirrors `spotifyLink` below) so
  // the backend knows which already-signed-in user to attach FB to. A
  // top-level navigation to `/login/start` would have no Authorization
  // header, which is why an earlier version of this code accidentally ran
  // the find-or-create login flow and silently swapped the active user
  // (clobbering Spotify-linked state in the process).
  async function facebookLink() {
    setErr(''); setMsg('');
    try {
      const r = await api.get('/api/auth/facebook/link/url');
      window.location.href = r.data.url;
    } catch (e: any) { setErr(errMsg(e)); }
  }
  async function facebookUnlink() {
    setErr(''); setMsg('');
    try {
      const r = await api.post('/api/auth/facebook/unlink');
      setAccount(r.data.account);
      setMsg('Facebook unlinked.');
    } catch (e: any) { setErr(errMsg(e)); }
  }

  async function spotifyLink() {
    try {
      // The /url endpoint requires the auth header (axios attaches it),
      // whereas a top-level navigation to /start would not — so we get
      // the URL via JSON and then redirect.
      const r = await api.get('/api/auth/spotify/user/link/url');
      window.location.href = r.data.url;
    } catch (e: any) { setErr(errMsg(e)); }
  }
  async function spotifyUnlink() {
    setErr(''); setMsg('');
    try {
      const r = await api.post('/api/auth/spotify/user/unlink');
      setAccount(r.data.account);
      setMsg('Spotify unlinked.');
    } catch (e: any) { setErr(errMsg(e)); }
  }

  return (
    <div className="container col" style={{ maxWidth: 560 }}>
      <h1>Your account</h1>
      {err && <div className="error">{err}</div>}
      {msg && <div className="notice">{msg}</div>}
      <form className="col card" onSubmit={save}>
        <h2>Profile</h2>
        <div><label>Username</label><input value={form.username} onChange={set('username')} required /></div>
        <div><label>Email</label><input type="email" value={form.email} onChange={set('email')} required /></div>
        <div><label>Phone</label><input value={form.phone} onChange={set('phone')} /></div>
        <button className="btn btn-primary">Save</button>
      </form>
      <form className="col card" onSubmit={changePw}>
        <h2>Password</h2>
        <div><label>Current</label><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
        <div><label>New (min 8)</label><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} /></div>
        <button className="btn">Update password</button>
      </form>
      <div className="card col">
        <h2>Facebook</h2>
        {account.facebookLinked
          ? <LinkedProviderRow profile={account.facebookProfile} />
          : <div className="mute">Status: Not linked</div>}
        {account.facebookLinked
          ? <button className="btn" onClick={facebookUnlink}>Unlink Facebook</button>
          : <button className="btn" onClick={facebookLink}>Link Facebook</button>}
      </div>

      <div className="card col">
        <h2>Spotify</h2>
        <div className="mute">
          Link your Spotify so you can add songs from your library and playlists.
        </div>
        {account.spotifyLinked ? (
          // Inline row: small round Spotify avatar sits directly next to
          // the Unlink button so the user can see whose Spotify is
          // currently attached at a glance. Display name (if any) is
          // appended to the button label.
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {account.spotifyProfile?.pictureUrl && (
              <img
                src={account.spotifyProfile.pictureUrl}
                alt=""
                width={36}
                height={36}
                style={{
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flex: '0 0 auto',
                }}
                // Spotify CDN URLs can rotate; hide a busted image instead
                // of showing a broken-image icon.
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <button className="btn" onClick={spotifyUnlink}>
              Unlink Spotify
              {account.spotifyProfile?.name
                ? ` (${account.spotifyProfile.name})`
                : ''}
            </button>
          </div>
        ) : (
          <>
            <div className="mute">Status: Not linked</div>
            <button className="btn btn-primary" onClick={spotifyLink}>
              Link Spotify
            </button>
          </>
        )}

      </div>

      <div className="card col">
        <h2>Sessions you've joined</h2>
        {joinedSessions === null ? (
          <div className="mute">Loading…</div>
        ) : joinedSessions.length === 0 ? (
          <div className="mute">You haven't joined any sessions yet.</div>
        ) : (
          <div className="list">
            {joinedSessions.map((s) => (
              // Buttons (not links) — tapping a row opens a per-session
              // stats popup. Joining a session from this list is
              // intentionally NOT possible: per spec, users only join
              // via QR scan / direct link to the slug. The styling
              // matches the queue-item rows used elsewhere so visual
              // affordance is consistent.
              <button
                key={s.slug}
                type="button"
                className="queue-item"
                onClick={() => openSessionStats(s.slug)}
                style={{
                  textAlign: 'left',
                  background: 'var(--bg-2)',
                  color: 'inherit',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <div className="info">
                  <div className="title">
                    {s.adminLabel}
                    {/*
                      Visual cues for the row's lifecycle state.
                      "Active" / "Inactive" reflect the session's
                      current `active` flag (admin can stop a session
                      between visits); "Blocked" overrides everything
                      because the user can't add/vote there even if
                      the session is running.
                    */}
                    {s.blocked ? (
                      <span className="tag" style={{ marginLeft: 8, background: '#5a1a1a', color: '#fff' }}>
                        Blocked
                      </span>
                    ) : s.active ? (
                      <span className="tag" style={{ marginLeft: 8 }}>Active</span>
                    ) : (
                      <span className="tag mute" style={{ marginLeft: 8 }}>Inactive</span>
                    )}
                  </div>
                  <div className="sub">
                    @{s.slug} · last seen {relativeTime(s.lastSeenAt)}
                  </div>
                </div>
                <div className="mute">›</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSlug && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            // Click-outside-to-close — mirrors the Add Song modal in
            // SessionView.tsx. We compare e.target/currentTarget so
            // clicks inside the modal card don't dismiss it.
            if (e.target === e.currentTarget) closeSessionStats();
          }}
          role="presentation"
        >
          <div
            className="modal modal-wide"
            role="dialog"
            aria-modal="true"
            aria-label="Session stats"
          >
            <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>
                {selectedStats?.adminLabel || joinedSessions?.find((j) => j.slug === selectedSlug)?.adminLabel || 'Session'}
              </h2>
              <button
                className="btn btn-sm"
                onClick={closeSessionStats}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mute" style={{ marginTop: -8, marginBottom: 12 }}>@{selectedSlug}</div>

            {selectedErr && <div className="error">{selectedErr}</div>}

            {!selectedStats && !selectedErr && (
              <div className="mute">Loading stats…</div>
            )}

            {selectedStats && (
              <>
                {/*
                  3-up stat strip for the calling user. Karma here is
                  the per-session number — net votes received on
                  currently-queued items + 1 per played song. Players
                  see a different (global) figure further down.
                */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <Stat label="Karma" value={selectedStats.me.sessionKarma} />
                  <Stat label="Played" value={selectedStats.me.songsPlayed} />
                  <Stat label="Added" value={selectedStats.me.songsAdded} />
                </div>

                <div className="mute" style={{ marginBottom: 12 }}>
                  {selectedStats.me.rank !== null
                    ? `Rank #${selectedStats.me.rank} of ${selectedStats.me.total}`
                    : selectedStats.me.total > 0
                    ? `Unranked — add a song to enter the leaderboard.`
                    : `No one has added a song here yet.`}

                </div>

                {selectedStats.leaderboard.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 32 }}>#</th>
                        <th>User</th>
                        <th style={{ textAlign: 'right' }}>Karma</th>
                        <th style={{ textAlign: 'right' }}>Played</th>
                        <th style={{ textAlign: 'right' }}>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStats.leaderboard.map((row, idx) => {
                        // Detect the gap between top-10 and the trailing
                        // "your row" so we can render an ellipsis. The
                        // backend appends the user's row after rank 10
                        // when they're outside the top, so any jump in
                        // `rank` of >1 between consecutive rows is the
                        // signal.
                        const prev = idx > 0 ? selectedStats.leaderboard[idx - 1].rank : 0;
                        const gap = idx > 0 && row.rank > prev + 1;
                        return (
                          <>
                            {gap && (
                              <tr key={`gap-${row.rank}`}>
                                <td colSpan={5} className="mute" style={{ textAlign: 'center' }}>
                                  …
                                </td>
                              </tr>
                            )}
                            <tr
                              key={row.rank}
                              style={
                                row.isMe
                                  ? { background: 'rgba(29, 185, 84, 0.12)' }
                                  : undefined
                              }
                            >
                              <td>{row.rank}</td>
                              <td>
                                @{row.username}
                                {row.isMe && (
                                  <span className="tag" style={{ marginLeft: 6 }}>you</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>{row.sessionKarma}</td>
                              <td style={{ textAlign: 'right' }}>{row.songsPlayed}</td>
                              <td style={{ textAlign: 'right' }}>{row.songsAdded}</td>
                            </tr>
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {stats && (

        <div className="card">
          <h2>Stats</h2>
          <div className="mute">Songs added: {stats.songsAdded ?? 0}</div>
          <div className="mute">Songs played: {stats.songsPlayed ?? 0}</div>
          <div className="mute">Karma: {stats.karma ?? 0}</div>
        </div>
      )}
    </div>
  );
}

