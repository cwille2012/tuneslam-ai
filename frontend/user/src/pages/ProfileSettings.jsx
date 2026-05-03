import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, userSpotifyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function ProfileSettings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState(user?.username || '');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState({ linked: false, loading: true });

  // Check for Spotify callback messages
  useEffect(() => {
    const spotifyParam = searchParams.get('spotify');
    const errorParam = searchParams.get('error');
    
    if (spotifyParam === 'linked') {
      setMessage('✅ Spotify linked successfully!');
      // Clear URL params
      window.history.replaceState({}, '', '/profile');
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, '', '/profile');
    }
  }, [searchParams]);

  // Fetch Spotify status
  useEffect(() => {
    fetchSpotifyStatus();
  }, []);

  const fetchSpotifyStatus = async () => {
    try {
      const response = await userSpotifyAPI.getStatus();
      setSpotifyStatus({ linked: response.data.linked, loading: false });
    } catch (err) {
      console.error('Failed to fetch Spotify status:', err);
      setSpotifyStatus({ linked: false, loading: false });
    }
  };

  const handleLinkSpotify = async () => {
    try {
      const response = await userSpotifyAPI.getAuthUrl();
      window.location.href = response.data.authUrl;
    } catch (err) {
      setError('Failed to initiate Spotify linking');
    }
  };

  const handleUnlinkSpotify = async () => {
    if (!confirm('Are you sure you want to unlink your Spotify account?')) {
      return;
    }

    setLoading(true);
    try {
      await userSpotifyAPI.unlink();
      setSpotifyStatus({ linked: false, loading: false });
      setMessage('Spotify unlinked successfully');
    } catch (err) {
      setError('Failed to unlink Spotify');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.updateProfile({ username });
      const { user: updatedUser, token } = response.data;
      
      if (token) {
        localStorage.setItem('token', token);
      }
      
      updateUser(updatedUser);
      setMessage('Username updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update username');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setMessage('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--spotify-black)' }}>
      <div className="session-header">
        <button onClick={() => navigate(-1)} className="search-back-btn">
          ←
        </button>
        <div className="session-title">Profile Settings</div>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="container">
        <div style={{
          background: 'var(--spotify-dark-grey)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '16px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--spotify-green)',
              color: 'var(--spotify-black)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: '700',
              margin: '0 auto 16px'
            }}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <h2 style={{ marginBottom: '8px' }}>{user?.username}</h2>
            <div style={{ color: 'var(--spotify-light-grey)' }}>
              Karma: {user?.karma || 0} 🌟
            </div>
          </div>

          <form onSubmit={handleUsernameSubmit}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={30}
                disabled={loading}
              />
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Update Username'}
            </button>
          </form>
        </div>

        <div style={{
          background: 'var(--spotify-dark-grey)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '16px'
        }}>
          <h3 style={{ marginBottom: '16px' }}>Change Password</h3>
          
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                minLength={8}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        <div style={{
          background: 'var(--spotify-dark-grey)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '16px'
        }}>
          <h3 style={{ marginBottom: '16px' }}>🎵 Spotify Connection</h3>
          <p style={{ color: 'var(--spotify-light-grey)', marginBottom: '16px', fontSize: '14px' }}>
            Link your Spotify account to browse your personal playlists and library when adding songs.
          </p>
          
          {spotifyStatus.loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          ) : spotifyStatus.linked ? (
            <div>
              <div style={{
                padding: '12px',
                background: 'rgba(30, 215, 96, 0.1)',
                borderRadius: '8px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>✓</span>
                <div>
                  <div style={{ color: 'var(--spotify-green)', fontWeight: '600' }}>
                    Spotify Connected
                  </div>
                  <div style={{ color: 'var(--spotify-light-grey)', fontSize: '14px' }}>
                    You can now browse your playlists when adding songs
                  </div>
                </div>
              </div>
              <button
                onClick={handleUnlinkSpotify}
                className="btn btn-secondary"
                disabled={loading}
                style={{ width: '100%' }}
              >
                Unlink Spotify
              </button>
            </div>
          ) : (
            <button
              onClick={handleLinkSpotify}
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span style={{ fontSize: '20px' }}>🎵</span>
              Link Spotify Account
            </button>
          )}
        </div>

        <div style={{
          background: 'var(--spotify-dark-grey)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '16px'
        }}>
          <h3 style={{ marginBottom: '16px' }}>Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--spotify-green)' }}>
                {user?.stats?.songsAddedCount || 0}
              </div>
              <div style={{ color: 'var(--spotify-light-grey)', fontSize: '14px' }}>
                Songs Added
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--spotify-green)' }}>
                {user?.stats?.songsPlayedCount || 0}
              </div>
              <div style={{ color: 'var(--spotify-light-grey)', fontSize: '14px' }}>
                Songs Played
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--spotify-green)' }}>
                {user?.stats?.upvotesReceived || 0}
              </div>
              <div style={{ color: 'var(--spotify-light-grey)', fontSize: '14px' }}>
                Upvotes
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--spotify-red)' }}>
                {user?.stats?.downvotesReceived || 0}
              </div>
              <div style={{ color: 'var(--spotify-light-grey)', fontSize: '14px' }}>
                Downvotes
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{ marginBottom: '40px' }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default ProfileSettings;
