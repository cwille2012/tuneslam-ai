import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg } from '../lib/api';

export default function Landing() {
  const [slug, setSlug] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  async function go(e: any) {
    e.preventDefault();
    const s = slug.trim().toLowerCase().replace(/^\//, '');
    if (!s) return;
    setErr('');
    try {
      const r = await api.get(`/api/sessions/${s}/exists`);
      if (!r.data.exists) { setErr('No active session at /' + s); return; }
      nav('/' + s);
    } catch (e: any) { setErr(errMsg(e)); }
  }
  return (
    <div className="center">
      <form className="card col" onSubmit={go}>
        <h1>Join a TuneSlam session</h1>
        <div className="mute">Enter the URL slug provided by the venue.</div>
        {err && <div className="error">{err}</div>}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><label>Slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="venue-name" />
          </div>
          <button className="btn btn-primary">Join</button>
        </div>
      </form>
    </div>
  );
}
