import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, api } from '../lib/api';
import type { UserAccount } from '../App';

export default function FacebookCallback({ onAuth }: { onAuth: (a: UserAccount) => void }) {
  const nav = useNavigate();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get('token');
    // Honor the `?from=/some-path` the backend round-tripped for us so the
    // user lands back on whatever session page they came from. Falls back to
    // /account for a generic "Continue with Facebook" from the login screen.
    const fromRaw = p.get('from') || '';
    const from = fromRaw.startsWith('/') ? fromRaw : '/account';
    if (token) {
      setToken(token);
      api
        .get('/api/auth/user/me')
        .then((r) => {
          onAuth(r.data.account);
          nav(from);
        })
        .catch(() => nav('/login'));
    } else {
      nav('/login');
    }
  }, []);
  return (
    <div className="center">
      <div className="card">Signing you in…</div>
    </div>
  );
}
