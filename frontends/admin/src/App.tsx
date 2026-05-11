import { useEffect, useState } from 'react';
import { Routes, Route, Link, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { api, getToken, setToken, errMsg, API_BASE, USER_URL } from './lib/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Blacklist from './pages/Blacklist';
import Participants from './pages/Participants';
import History from './pages/History';
import Account from './pages/Account';
import SpotifyCallback from './pages/SpotifyCallback';

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  businessName?: string;
  spotifyLinked: boolean;
}

export default function App() {
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.get('/api/auth/admin/me')
      .then((r) => setAccount(r.data.account))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    setToken(null);
    setAccount(null);
    navigate('/login');
  };

  if (loading) return <div className="center"><div className="mute">Loading…</div></div>;

  const requireAuth = (el: JSX.Element) => account ? el : <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return (
    <div className="app">
      {account && (
        <nav className="nav">
          <span className="brand">TuneSlam · Admin</span>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/blacklist">Blacklist</NavLink>
          <NavLink to="/participants">Participants</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <NavLink to="/account">Account</NavLink>
          <span className="spacer" />
          <span className="mute">{account.name || account.email}</span>
          <button className="btn btn-sm" onClick={logout}>Logout</button>
        </nav>
      )}
      <Routes>
        <Route path="/login" element={account ? <Navigate to="/" replace /> : <Login onAuth={setAccount} />} />
        <Route path="/register" element={account ? <Navigate to="/" replace /> : <Register onAuth={setAccount} />} />
        <Route path="/spotify/callback" element={<SpotifyCallback />} />
        <Route path="/" element={requireAuth(<Dashboard account={account!} setAccount={setAccount} />)} />
        <Route path="/blacklist" element={requireAuth(<Blacklist />)} />
        <Route path="/participants" element={requireAuth(<Participants />)} />
        <Route path="/history" element={requireAuth(<History />)} />
        <Route path="/settings" element={requireAuth(<Settings />)} />
        <Route path="/account" element={requireAuth(<Account account={account!} setAccount={setAccount} />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
