import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sessionAPI, queueAPI, spotifyAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import Header from '../components/Header';
import SearchModal from '../components/SearchModal';

function ManageSession() {
  const { sessionName } = useParams();
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { connected, on, off } = useSocket(sessionName);

  useEffect(() => {
    loadSessionData();
  }, [sessionName]);

  useEffect(() => {
    if (!connected) return;

    const handleQueueUpdated = (data) => {
      setQueue(data.queue || []);
    };

    const handleSongAdded = () => {
      loadQueue();
    };

    const handleSongRemoved = () => {
      loadQueue();
    };

    on('queue-updated', handleQueueUpdated);
    on('song-added', handleSongAdded);
    on('song-removed', handleSongRemoved);

    return () => {
      off('queue-updated', handleQueueUpdated);
      off('song-added', handleSongAdded);
      off('song-removed', handleSongRemoved);
    };
  }, [connected, on, off]);

  const loadSessionData = async () => {
    try {
      const [sessionRes, queueRes] = await Promise.all([
        sessionAPI.get(sessionName),
        queueAPI.get(sessionName)
      ]);
      setSession(sessionRes.data.session);
      setQueue(queueRes.data.queue);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    try {
      const response = await queueAPI.get(sessionName);
      setQueue(response.data.queue);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  const handleToggleSession = async () => {
    try {
      const response = await sessionAPI.toggle(sessionName);
      setSession(response.data.session);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle session');
    }
  };

  const handleRemoveSong = async (songId) => {
    if (!confirm('Remove this song from the queue?')) return;
    
    try {
      await queueAPI.removeSong(sessionName, songId);
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove song');
    }
  };

  const handleLinkSpotify = async () => {
    try {
      const response = await spotifyAPI.getAuthUrl(sessionName);
      window.location.href = response.data.authUrl;
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to get Spotify auth URL');
    }
  };

  const openTVViewer = () => {
    const viewerUrl = import.meta.env.VITE_VIEWER_URL || 'http://localhost:5175';
    window.open(`${viewerUrl}/viewer/${sessionName}`, '_blank');
  };

  if (loading) {
    return (
      <div>
        <Header />
        <div className="loading"><div className="spinner"></div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header />
        <div className="container">
          <div className="card">
            <div className="error-message">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      
      <div className="container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1>Session: {sessionName}</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Status: {session?.isActive ? '✅ Active' : '⭕ Inactive'}
                {connected && ' • 🟢 Connected'}
                {session?.spotifyAccessToken && ' • 🎵 Spotify Linked'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleToggleSession}
                className={session?.isActive ? 'btn btn-secondary' : 'btn btn-primary'}
              >
                {session?.isActive ? 'Disable Session' : 'Enable Session'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {!session?.spotifyAccessToken && (
              <button onClick={handleLinkSpotify} className="btn btn-primary">
                🎵 Link Spotify
              </button>
            )}
            <button onClick={openTVViewer} className="btn btn-secondary">
              📺 Open TV Display
            </button>
            <button onClick={() => setShowSearch(true)} className="btn btn-secondary">
              ➕ Add Song
            </button>
            <Link to={`/session/${sessionName}/users`} className="btn btn-secondary">
              👥 Manage Users
            </Link>
            <Link to={`/session/${sessionName}/settings`} className="btn btn-secondary">
              ⚙️ Session Settings
            </Link>
          </div>
        </div>

        {session?.qrCode && (
          <div className="card">
            <h2>Session QR Code</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Users can scan this QR code to join: {session.sessionUrl}
            </p>
            <img src={session.qrCode} alt="QR Code" style={{ maxWidth: '300px' }} />
          </div>
        )}

        <div className="card">
          <h2>Current Queue ({queue.length} songs)</h2>
          <div style={{ marginTop: '16px' }}>
            {queue.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
                No songs in queue
              </p>
            ) : (
              queue.map((song, index) => (
                <div
                  key={song._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderBottom: '1px solid var(--border-color)',
                    gap: '16px'
                  }}
                >
                  <div style={{ fontWeight: '600', minWidth: '30px' }}>#{index + 1}</div>
                  <img
                    src={song.albumArtUrl}
                    alt={song.title}
                    style={{ width: '50px', height: '50px', borderRadius: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600' }}>{song.title}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {song.artist}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      {song.netVotes > 0 ? '+' : ''}{song.netVotes}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      ↑{song.upvotes} ↓{song.downvotes}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveSong(song._id)}
                    className="btn btn-danger"
                    style={{ padding: '8px 16px' }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        sessionName={sessionName}
        onSongAdded={loadQueue}
      />
    </div>
  );
}

export default ManageSession;
