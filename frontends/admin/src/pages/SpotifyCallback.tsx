import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Spotify redirects here AFTER the backend has already finished the OAuth
 * exchange. The backend appends `?ok=1` (success) or `?error=...` (failure).
 * We just inspect the query string and route the user accordingly.
 */
export default function SpotifyCallback() {
  const nav = useNavigate();
  const [err, setErr] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('ok') === '1') {
      // Give the backend a moment to persist, then go home (Dashboard will
      // re-fetch /api/admin/session and see spotifyLinked = true).
      const t = setTimeout(() => nav('/'), 200);
      return () => clearTimeout(t);
    }
    setErr(p.get('error') || 'Spotify linking failed.');
  }, [nav]);

  return (
    <div className="center">
      <div className="card">
        {err ? <div className="error">{err}</div> : 'Linking Spotify…'}
      </div>
    </div>
  );
}
