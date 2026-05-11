import { useState } from 'react';
import { api, errMsg } from '../lib/api';
import type { AdminAccount } from '../App';

export default function Account({ account, setAccount }: { account: AdminAccount; setAccount: (a: AdminAccount) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function linkSpotify() {
    setBusy(true);
    try { const r = await api.get('/api/auth/spotify/admin/url'); window.location.href = r.data.url; }
    finally { setBusy(false); }
  }

  async function unlinkSpotify() {
    if (!confirm('Unlink Spotify? Your session will need to be relinked before activating.')) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.post('/api/auth/spotify/admin/unlink');
      setAccount({ ...account, spotifyLinked: false });
      setMsg('Spotify unlinked.');
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="container col" style={{ maxWidth: 560 }}>
      <h1>Account</h1>
      {err && <div className="error">{err}</div>}
      {msg && <div className="notice">{msg}</div>}
      <div><label>Email</label><input value={account.email} disabled /></div>
      <div><label>Name</label><input value={account.name} disabled /></div>
      {account.businessName && <div><label>Business</label><input value={account.businessName} disabled /></div>}
      <h2 style={{ marginTop: 16 }}>Spotify</h2>
      <div className="mute">Status: {account.spotifyLinked ? 'Linked ✓' : 'Not linked'}</div>
      <div className="row">
        {account.spotifyLinked
          ? <button className="btn btn-danger" onClick={unlinkSpotify} disabled={busy}>Unlink Spotify</button>
          : <button className="btn btn-primary" onClick={linkSpotify} disabled={busy}>Link Spotify</button>}
      </div>
    </div>
  );
}
