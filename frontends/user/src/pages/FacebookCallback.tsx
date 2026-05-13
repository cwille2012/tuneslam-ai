import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, api } from '../lib/api';
import { readPendingSession, clearPendingSession } from '../lib/pendingSession';
import type { UserAccount } from '../App';

export default function FacebookCallback({ onAuth }: { onAuth: (a: UserAccount) => void }) {
  const nav = useNavigate();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get('token');
    // Where to send the user after we finish the OAuth dance.
    // Resolution order:
    //   1. ?from= query param the backend round-tripped (set when the
    //      user hit "Continue with Facebook" from a session login
    //      page that knew its origin).
    //   2. localStorage `pendingSession` (set by SessionView when the
    //      user landed on a slug while logged out — survives the
    //      full-page redirect to FB and back).
    //   3. /account.
    const fromRaw = p.get('from') || '';
    const fromParam = fromRaw.startsWith('/') && !fromRaw.startsWith('//') ? fromRaw : '';
    const from = fromParam || readPendingSession() || '/account';
    if (token) {
      setToken(token);
      api
        .get('/api/auth/user/me')
        .then((r) => {
          onAuth(r.data.account);
          clearPendingSession();
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
