import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, setToken, errMsg, API_BASE } from '../lib/api';
import type { UserAccount } from '../App';

export default function Login({ onAuth }: { onAuth: (a: UserAccount) => void }) {
  const [identifier, setId] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const back = (loc.state as any)?.from || '/account';

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.post('/api/auth/user/login', { identifier, password });
      setToken(r.data.token);
      onAuth(r.data.account);
      nav(back);
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  function facebookLogin() {
    // Forward the redirect target through the OAuth round-trip so the user
    // ends up back on the session page after Facebook signs them in.
    const qs = back && back !== '/account' ? `?from=${encodeURIComponent(back)}` : '';
    window.location.href = `${API_BASE}/api/auth/facebook/login/start${qs}`;
  }

  return (
    <div className="center">
      <form className="card col" onSubmit={submit}>
        <h1>Log in</h1>
        {err && <div className="error">{err}</div>}
        <div><label>Username or email</label><input value={identifier} onChange={(e) => setId(e.target.value)} required /></div>
        <div><label>Password</label><input type="password" value={password} onChange={(e) => setP(e.target.value)} required /></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? '…' : 'Log in'}</button>
        <button type="button" className="btn" onClick={facebookLogin}>Continue with Facebook</button>
        <div className="mute">No account? <Link to="/register">Sign up</Link></div>
      </form>
    </div>
  );
}
