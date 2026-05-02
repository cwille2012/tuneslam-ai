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

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const redirectTo = new URLSearchParams(location.search).get('redirect');
      if (redirectTo) {
        navigate(redirectTo);
      } else {
        // If no redirect, go to profile page
        navigate('/profile');
      }
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
        </form>

        <div className="auth-link">
          New to TuneSlam? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
