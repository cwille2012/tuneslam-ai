import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, getToken, setToken, errMsg } from './lib/api';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import SessionView from './pages/SessionView';
import FacebookCallback from './pages/FacebookCallback';
import SpotifyCallback from './pages/SpotifyCallback';

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  facebookLinked: boolean;
  spotifyLinked: boolean;
}

export default function App() {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/api/auth/user/me')
      .then((r) => setAccount(r.data.account))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, []);

  function logout() { setToken(null); setAccount(null); nav('/'); }

  if (loading) return <div className="center"><div className="mute">Loading…</div></div>;

  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/" className="brand">TuneSlam</NavLink>
        <span className="spacer" />
        {account ? (
          <>
            <NavLink to="/account">@{account.username}</NavLink>
            <button className="btn btn-sm" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Sign up</NavLink>
          </>
        )}
      </nav>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={account ? <Navigate to="/account" replace /> : <Login onAuth={setAccount} />} />
        <Route path="/register" element={account ? <Navigate to="/account" replace /> : <Register onAuth={setAccount} />} />
        <Route path="/account" element={account ? <Account account={account} setAccount={setAccount} /> : <Navigate to="/login" replace />} />
        <Route path="/facebook/callback" element={<FacebookCallback onAuth={setAccount} />} />
        <Route path="/spotify/callback" element={<SpotifyCallback onAuth={setAccount} />} />
        <Route path="/:slug" element={<SessionView account={account} setAccount={setAccount} />} />
      </Routes>
    </div>
  );
}
