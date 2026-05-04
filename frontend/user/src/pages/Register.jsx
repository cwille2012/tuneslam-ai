import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, user } = useAuth();
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      await register(registerData);
      const redirectTo = new URLSearchParams(location.search).get('redirect') || '/';
      navigate(redirectTo);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">TuneSlam</div>
          <div className="auth-subtitle">Create your account</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a username"
              required
              disabled={loading}
              minLength={3}
              maxLength={30}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="+1234567890"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password (min 8 characters)"
              required
              disabled={loading}
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>

          <div style={{ 
            textAlign: 'center', 
            margin: '20px 0', 
            color: 'var(--spotify-light-grey)',
            fontSize: '14px'
          }}>
            or sign up with
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
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;
