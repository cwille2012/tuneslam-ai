import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import type { UserAccount } from '../App';

/**
 * Lands here after the backend's /api/auth/spotify/callback redirects to
 * `${USER_URL}/spotify/callback?ok=1[&token=…]`.
 *
 *  - `?ok=1&token=…`  → the user just logged in via Spotify; persist the
 *    token and refresh the account.
 *  - `?ok=1`          → existing user just *linked* their Spotify; we just
 *    need to refresh the account so `spotifyLinked` flips to true.
 */
export default function SpotifyCallback({ onAuth }: { onAuth: (a: UserAccount) => void }) {
  const nav = useNavigate();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const token = p.get('token');
    if (token) setToken(token);
    api
      .get('/api/auth/user/me')
      .then((r) => {
        onAuth(r.data.account);
        nav('/account');
      })
      .catch(() => nav(token ? '/login' : '/account'));
  }, []);
  return (
    <div className="center">
      <div className="card">Connecting Spotify…</div>
    </div>
  );
}
