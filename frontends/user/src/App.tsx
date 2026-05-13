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
import { QuotaProvider } from './lib/quota';
import ActivityButton from './components/ActivityButton';
import ConfirmDialog from './components/ConfirmDialog';



export interface LinkedProviderProfile {
  name?: string;
  pictureUrl?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  facebookLinked: boolean;
  spotifyLinked: boolean;
  /** Provider profile metadata captured at link-time (only present when linked). */
  facebookProfile?: LinkedProviderProfile;
  spotifyProfile?: LinkedProviderProfile;
}


export default function App() {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
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
    <QuotaProvider loggedIn={!!account}>
    <div className="app">
      <nav className="nav">
        <NavLink to="/" className="brand">TuneSlam</NavLink>
        <span className="spacer" />
        {account ? (
          <>
            {/*
              Nav button order: Activity → @username → Logout. The
              username link is styled as `btn btn-sm` (same as the
              other two) per request; `NavLink` still applies its
              `active` class so visited-state styling keeps working.
            */}
            <ActivityButton />
            <NavLink to="/account" className="btn btn-sm">@{account.username}</NavLink>
            <button
              className="btn btn-sm"
              onClick={() => setConfirmingLogout(true)}
            >
              Logout
            </button>
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
      <ConfirmDialog
        open={confirmingLogout}
        title="Log out?"
        message="You'll be signed out of TuneSlam on this device."
        confirmLabel="Log out"
        variant="danger"
        onConfirm={() => {
          setConfirmingLogout(false);
          logout();
        }}
        onCancel={() => setConfirmingLogout(false)}
      />
    </div>
    </QuotaProvider>
  );
}


