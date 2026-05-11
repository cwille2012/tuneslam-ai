import { useEffect, useState } from 'react';
import { api, errMsg, API_BASE } from '../lib/api';
import type { UserAccount } from '../App';

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
  function facebookLink() { window.location.href = `${API_BASE}/api/auth/facebook/login/start`; }
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
        <div className="mute">Status: {account.facebookLinked ? 'Linked ✓' : 'Not linked'}</div>
        {!account.facebookLinked && <button className="btn" onClick={facebookLink}>Link Facebook</button>}
      </div>
      <div className="card col">
        <h2>Spotify</h2>
        <div className="mute">
          Link your Spotify so you can add songs from your library and playlists.
        </div>
        <div className="mute">Status: {account.spotifyLinked ? 'Linked ✓' : 'Not linked'}</div>
        {account.spotifyLinked
          ? <button className="btn" onClick={spotifyUnlink}>Unlink Spotify</button>
          : <button className="btn btn-primary" onClick={spotifyLink}>Link Spotify</button>}
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
