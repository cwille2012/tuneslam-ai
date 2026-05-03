import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthData } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        navigate(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      if (!token) {
        navigate('/login?error=Authentication failed - no token received');
        return;
      }

      try {
        // Store token
        localStorage.setItem('tuneslam_token', token);

        // Fetch user data with the token
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();

        // Store user data
        localStorage.setItem('tuneslam_user', JSON.stringify(data.user));

        // Update auth context
        setAuthData(data.user, token);

        // Check for redirect parameter (from OAuth state)
        const redirectParam = searchParams.get('redirect');
        const redirectTo = redirectParam || sessionStorage.getItem('oauth_redirect') || '/profile';
        sessionStorage.removeItem('oauth_redirect');

        navigate(redirectTo);
      } catch (err) {
        console.error('OAuth callback error:', err);
        navigate('/login?error=Failed to complete authentication');
      }
    };

    handleCallback();
  }, [searchParams, navigate, setAuthData]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
          <p style={{ color: 'var(--spotify-light-grey)' }}>
            Completing authentication...
          </p>
        </div>
      </div>
    </div>
  );
}

export default OAuthCallback;
