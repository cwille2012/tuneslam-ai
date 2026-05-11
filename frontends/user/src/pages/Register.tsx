import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, setToken, errMsg } from '../lib/api';
import type { UserAccount } from '../App';

export default function Register({ onAuth }: { onAuth: (a: UserAccount) => void }) {
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  // Preserve the page the user came from (typically the session join URL)
  // so they land back there after sign-up instead of the generic /account.
  const back = (loc.state as any)?.from || '/account';
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: any) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await api.post('/api/auth/user/register', form);
      setToken(r.data.token);
      onAuth(r.data.account);
      nav(back);
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="center">
      <form className="card col" onSubmit={submit}>
        <h1>Create account</h1>
        {err && <div className="error">{err}</div>}
        <div><label>Username</label><input value={form.username} onChange={set('username')} required pattern="[A-Za-z0-9_]+" minLength={3} maxLength={20} /></div>
        <div><label>Email</label><input type="email" value={form.email} onChange={set('email')} required /></div>
        <div><label>Phone</label><input value={form.phone} onChange={set('phone')} required /></div>
        <div><label>Password (min 8)</label><input type="password" value={form.password} onChange={set('password')} required minLength={8} /></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? '…' : 'Sign up'}</button>
        <div className="mute">Have one? <Link to="/login">Log in</Link></div>
      </form>
    </div>
  );
}
