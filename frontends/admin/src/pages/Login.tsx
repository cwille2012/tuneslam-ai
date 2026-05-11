import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, errMsg } from '../lib/api';
import type { AdminAccount } from '../App';

export default function Login({ onAuth }: { onAuth: (a: AdminAccount) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.post('/api/auth/admin/login', { email, password });
      setToken(r.data.token);
      onAuth(r.data.account);
      nav('/');
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="center">
      <form className="card col" onSubmit={submit}>
        <h1>Admin login</h1>
        {err && <div className="error">{err}</div>}
        <div><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <div className="mute">No account? <Link to="/register">Create one</Link></div>
      </form>
    </div>
  );
}
