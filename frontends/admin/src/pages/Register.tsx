import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, errMsg } from '../lib/api';
import type { AdminAccount } from '../App';

export default function Register({ onAuth }: { onAuth: (a: AdminAccount) => void }) {
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '', businessName: '',
    line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api.post('/api/auth/admin/register', {
        email: form.email, password: form.password, name: form.name,
        phone: form.phone, businessName: form.businessName || undefined,
        address: { line1: form.line1, line2: form.line2 || undefined, city: form.city, state: form.state, postalCode: form.postalCode, country: form.country },
      });
      setToken(r.data.token);
      onAuth(r.data.account);
      nav('/');
    } catch (e: any) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="center">
      <form className="card col" onSubmit={submit} style={{ maxWidth: 560 }}>
        <h1>Create admin account</h1>
        {err && <div className="error">{err}</div>}
        <div><label>Full name</label><input value={form.name} onChange={set('name')} required /></div>
        <div><label>Business name (optional)</label><input value={form.businessName} onChange={set('businessName')} /></div>
        <div><label>Email</label><input type="email" value={form.email} onChange={set('email')} required /></div>
        <div><label>Phone</label><input value={form.phone} onChange={set('phone')} required /></div>
        <div><label>Password (min 8)</label><input type="password" value={form.password} onChange={set('password')} required minLength={8} /></div>
        <div><label>Address line 1</label><input value={form.line1} onChange={set('line1')} required /></div>
        <div><label>Address line 2</label><input value={form.line2} onChange={set('line2')} /></div>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}><label>City</label><input value={form.city} onChange={set('city')} required /></div>
          <div style={{ width: 110 }}><label>State</label><input value={form.state} onChange={set('state')} required /></div>
          <div style={{ width: 130 }}><label>Postal</label><input value={form.postalCode} onChange={set('postalCode')} required /></div>
          <div style={{ width: 70 }}><label>Country</label><input value={form.country} onChange={set('country')} required maxLength={2} /></div>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <div className="mute">Have an account? <Link to="/login">Log in</Link></div>
      </form>
    </div>
  );
}
