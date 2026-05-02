import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionAPI } from '../services/api';
import Header from '../components/Header';

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await sessionAPI.getMySessions();
      setSessions(response.data.sessions);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionName) => {
    if (!confirm(`Delete session "${sessionName}"? This action cannot be undone.`)) return;
    
    try {
      await sessionAPI.delete(sessionName);
      loadSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete session');
    }
  };

  const handleToggleSession = async (sessionName) => {
    try {
      await sessionAPI.toggle(sessionName);
      loadSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle session');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const activeSessions = sessions.filter(s => s.isActive);
  const inactiveSessions = sessions.filter(s => !s.isActive);

  return (
    <div>
      <Header />
      
      <div className="container">
        <div className="card">
          <h1>Welcome, {user?.username}!</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            {user?.businessName}
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <Link 
              to="/session/create" 
              className="btn btn-primary"
              style={{ pointerEvents: activeSessions.length > 0 ? 'none' : 'auto', opacity: activeSessions.length > 0 ? 0.5 : 1 }}
            >
              {activeSessions.length > 0 ? 'Session Already Active' : 'Create New Session'}
            </Link>
            <Link to="/settings" className="btn btn-secondary">
              Account Settings
            </Link>
          </div>
          {activeSessions.length > 0 && (
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '14px' }}>
              You can only have one active session at a time. Disable your current session to create a new one.
            </p>
          )}
        </div>

        {loading ? (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          </div>
        ) : error ? (
          <div className="card">
            <div className="error-message">{error}</div>
          </div>
        ) : (
          <>
            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <div className="card">
                <h2 style={{ marginBottom: '16px' }}>Active Session</h2>
                {activeSessions.map((session) => (
                  <div
                    key={session._id}
                    style={{
                      padding: '20px',
                      background: 'rgba(29, 185, 84, 0.1)',
                      border: '2px solid var(--primary-color)',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {session.name}
                          <span style={{ 
                            background: 'var(--primary-color)', 
                            color: 'white', 
                            padding: '4px 12px', 
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            🟢 ACTIVE
                          </span>
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                          Created {formatDate(session.createdAt)}
                          {session.spotifyAccessToken && ' • 🎵 Spotify Linked'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link 
                          to={`/session/${session.name}`}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px' }}
                        >
                          Manage
                        </Link>
                        <button
                          onClick={() => handleToggleSession(session.name)}
                          className="btn btn-secondary"
                          style={{ padding: '8px 16px' }}
                        >
                          Disable
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inactive Sessions */}
            {inactiveSessions.length > 0 && (
              <div className="card">
                <h2 style={{ marginBottom: '16px' }}>Previous Sessions</h2>
                {inactiveSessions.map((session) => (
                  <div
                    key={session._id}
                    style={{
                      padding: '20px',
                      background: 'var(--bg-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {session.name}
                          <span style={{ 
                            background: 'var(--text-secondary)', 
                            color: 'white', 
                            padding: '4px 12px', 
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            ⭕ INACTIVE
                          </span>
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                          Created {formatDate(session.createdAt)}
                          {session.spotifyAccessToken && ' • 🎵 Spotify Linked'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link 
                          to={`/session/${session.name}`}
                          className="btn btn-secondary"
                          style={{ padding: '8px 16px' }}
                        >
                          View
                        </Link>
                        <button
                          onClick={() => handleToggleSession(session.name)}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px' }}
                          disabled={activeSessions.length > 0}
                        >
                          Resume
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.name)}
                          className="btn btn-danger"
                          style={{ padding: '8px 16px' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sessions.length === 0 && (
              <div className="card">
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎵</div>
                  <h3 style={{ marginBottom: '8px' }}>No Sessions Yet</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    Create your first session to get started with TuneSlam!
                  </p>
                  <Link to="/session/create" className="btn btn-primary">
                    Create New Session
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Getting Started</h2>
          <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Create a new session for your event</li>
            <li>Link your Spotify account to the session</li>
            <li>Display the TV viewer on a screen for attendees</li>
            <li>Share the session URL or QR code with guests</li>
            <li>Manage the queue and user activity from your dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
