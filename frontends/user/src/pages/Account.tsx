import { useEffect, useState } from 'react';
import { api, errMsg } from '../lib/api';

import type { LinkedProviderProfile, UserAccount } from '../App';

/**
 * Compact row showing the linked-account avatar + display name. Falls back
 * gracefully when the provider didn't return a name or picture.
 */
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
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { api.get('/api/user/me/stats').then((r) => setStats(r.data.stats)).catch(() => {}); }, []);

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
