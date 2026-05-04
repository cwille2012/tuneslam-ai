import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get redirect URL from query params
  const getRedirectUrl = () => {
    const params = new URLSearchParams(location.search);
    return params.get('redirect') || '/profile';
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const redirectTo = getRedirectUrl();
      navigate(redirectTo);
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
      // Navigation will happen via useEffect above when user state updates
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">TuneSlam</div>
          <div className="auth-subtitle">Login to join the party</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email, Username, or Phone</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter your email or username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <div style={{ 
            textAlign: 'center', 
            margin: '20px 0', 
            color: 'var(--spotify-light-grey)',
            fontSize: '14px'
          }}>
            or continue with
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              // Pass redirect URL in state parameter
              const redirectTo = getRedirectUrl();
              const stateParam = redirectTo !== '/profile' ? `&state=${encodeURIComponent(redirectTo)}` : '';
              window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/facebook?${stateParam}`;
            }}
            disabled={loading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}
          >
            <span style={{ fontSize: '20px' }}>📘</span>
            Continue with Facebook
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => {
              // Pass redirect URL in state parameter
              const redirectTo = getRedirectUrl();
              const stateParam = redirectTo !== '/profile' ? `&state=${encodeURIComponent(redirectTo)}` : '';
              window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/spotify?${stateParam}`;
            }}
            disabled={loading}
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px',
              background: '#1DB954',
              color: 'white',
              border: 'none'
            }}
          >
            <span style={{ fontSize: '20px' }}>🎵</span>
            Continue with Spotify
          </button>
        </form>

        <div className="auth-link">
          New to TuneSlam? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
