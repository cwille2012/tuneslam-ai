import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionAPI } from '../services/api';
import Header from '../components/Header';

function CreateSession() {
  const [sessionName, setSessionName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await sessionAPI.create({ name: sessionName });
      const createdSession = response.data.session;
      navigate(`/session/${createdSession.name}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Header />
      
      <div className="container">
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1>Create New Session</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Create a new TuneSlam session for your event
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Session Name *</label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., tacotuesday, happyhour, etc."
                required
                disabled={loading}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '8px' }}>
                This will be used in the URL: tuneslam.com/session/{sessionName || 'your-session-name'}
              </small>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Session'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard')}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateSession;
