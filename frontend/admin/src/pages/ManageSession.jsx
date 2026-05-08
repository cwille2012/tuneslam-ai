import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sessionAPI, queueAPI, spotifyAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import SearchModal from '../components/SearchModal';

function ManageSession() {
  const { sessionName } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [userVotes, setUserVotes] = useState({}); // Track votes by songId
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { connected, on, off } = useSocket(sessionName);

  useEffect(() => {
    loadSessionData();
  }, [sessionName]);

  // Initialize vote state from queue data
  useEffect(() => {
    const votes = {};
    queue.forEach(song => {
      if (song.userVote) {
        votes[song._id] = song.userVote;
      }
    });
    setUserVotes(votes);
  }, [queue]);

  useEffect(() => {
    if (!connected) return;

    const handleQueueUpdated = (data) => {
      // Fetch queue from API to get userVote data for current user
      loadQueue();
    };

    const handleSongAdded = () => {
      loadQueue();
    };

    const handleSongRemoved = () => {
      loadQueue();
    };

    const handlePlayerConnected = (data) => {
      console.log('🎵 player-connected received', data);
      // Update local session state so the playback controls panel appears
      // without requiring a page refresh.
      setSession(prev => prev ? { ...prev, playerConnected: true } : prev);
    };

    const handlePlayerDisconnected = (data) => {
      console.log('🎵 player-disconnected received', data);
      setSession(prev => prev ? { ...prev, playerConnected: false } : prev);
    };

    on('queue-updated', handleQueueUpdated);
    on('song-added', handleSongAdded);
    on('song-removed', handleSongRemoved);
    on('player-connected', handlePlayerConnected);
    on('player-disconnected', handlePlayerDisconnected);

    return () => {
      off('queue-updated', handleQueueUpdated);
      off('song-added', handleSongAdded);
      off('song-removed', handleSongRemoved);
      off('player-connected', handlePlayerConnected);
      off('player-disconnected', handlePlayerDisconnected);
    };
  }, [connected, on, off]);

  const loadSessionData = async () => {
    try {
      const [sessionRes, queueRes, historyRes] = await Promise.all([
        sessionAPI.get(sessionName),
        queueAPI.get(sessionName),
        queueAPI.getHistory(sessionName)
      ]);
      setSession(sessionRes.data.session);
      
      // Filter to only show queued songs (not playing or played)
      const allSongs = queueRes.data.queue || [];
      const queuedOnly = allSongs.filter(s => s.status === 'queued');
      setQueue(queuedOnly);
      
      setHistory(historyRes.data.history || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    try {
      const response = await queueAPI.get(sessionName);
      // Filter to only show queued songs
      const allSongs = response.data.queue || [];
      const queuedOnly = allSongs.filter(s => s.status === 'queued');
      setQueue(queuedOnly);
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

  const handleResetSession = async () => {
    if (!confirm('⚠️ WARNING: This will clear ALL songs and history from this session.\n\nUser karma, blocklist, and blacklisted songs will NOT be affected.\n\nAre you sure you want to reset this session?')) {
      return;
    }
    
    try {
      const response = await sessionAPI.reset(sessionName);
      alert(response.data.message);
      loadSessionData(); // Reload everything
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset session');
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

  const handleRemoveAndBlock = async (songId, trackId) => {
    if (!confirm('Remove this song and add to blacklist? It cannot be re-added to this session.')) return;
    
    try {
      await queueAPI.removeSong(sessionName, songId);
      await sessionAPI.addToBlacklist(sessionName, trackId);
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to block song');
    }
  };

  const handleBlockFromHistory = async (trackId) => {
    if (!confirm('Add this song to blacklist? It cannot be re-added to this session.')) return;
    
    try {
      await sessionAPI.addToBlacklist(sessionName, trackId);
      alert('Song added to blacklist');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to block song');
    }
  };

  const handleVote = async (songId, voteType) => {
    try {
      await queueAPI.vote(sessionName, songId, voteType);
      loadQueue(); // Refresh to show updated votes
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to vote');
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
    const viewerUrl = import.meta.env.VITE_VIEWER_URL;
    window.open(`${viewerUrl}/viewer/${sessionName}`, '_blank');
  };

  const openPlayer = () => {
    const token = localStorage.getItem('tuneslam_admin_token');
    const playerUrl = `${import.meta.env.VITE_PLAYER_URL}/session/${sessionName}?token=${token}`;
    window.open(playerUrl, 'TuneSlam Player', 'width=1200,height=800');
  };

  const handlePlaybackControl = async (action) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/sessions/${sessionName}/playback/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('tuneslam_admin_token')}`
        }
      });
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(`Failed to ${action} playback`);
    }
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
          {session?.playerConnected && (
            <div style={{ 
              padding: '12px 16px', 
              background: 'linear-gradient(135deg, #1DB954 0%, #1ed760 100%)',
              color: 'white',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '20px' }}>🎵</span>
                  <strong>Web Player Active</strong>
                </div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>
                  Browser player is connected and ready
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handlePlaybackControl('play')} 
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ▶️ Play
                </button>
                <button 
                  onClick={() => handlePlaybackControl('pause')}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ⏸️ Pause
                </button>
                <button 
                  onClick={() => handlePlaybackControl('skip')}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ⏭️ Skip
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {!session?.spotifyAccessToken && (
              <button onClick={handleLinkSpotify} className="btn btn-primary">
                🎵 Link Spotify
              </button>
            )}
            <button onClick={openPlayer} className="btn btn-primary">
              🎵 Open Web Player
            </button>
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
            <button onClick={handleResetSession} className="btn btn-danger">
              🔄 Reset Session
            </button>
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
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                      Added by: {song.addedBy?.username || (song.isSystemAdded ? 'Recommended' : 'Unknown')}
                    </div>
                    {song.popularity !== undefined && (
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        {song.popularity >= 80 && <span style={{ color: '#1DB954' }}>⭐⭐⭐⭐⭐ Very Popular ({song.popularity})</span>}
                        {song.popularity >= 60 && song.popularity < 80 && <span style={{ color: '#1DB954' }}>⭐⭐⭐⭐ Popular ({song.popularity})</span>}
                        {song.popularity >= 40 && song.popularity < 60 && <span style={{ color: '#888' }}>⭐⭐⭐ Moderate ({song.popularity})</span>}
                        {song.popularity >= 20 && song.popularity < 40 && <span style={{ color: '#888' }}>⭐⭐ Low ({song.popularity})</span>}
                        {song.popularity < 20 && <span style={{ color: '#888' }}>⭐ Rare ({song.popularity})</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      {song.netVotes > 0 ? '+' : ''}{song.netVotes}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      ↑{song.upvotes} ↓{song.downvotes}
                    </div>
                  </div>
                  {song.status === 'queued' && (
                    <>
                      {/* Voting buttons - disabled for admin's own songs (but not system songs) */}
                      {!song.isSystemAdded && user?.id === song.addedBy?._id ? (
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--primary-color)', 
                          fontWeight: '600',
                          padding: '8px 12px',
                          background: 'rgba(29, 185, 84, 0.1)',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          Your Song
                        </div>
                      ) : (
                        <div className="vote-buttons">
                          <button
                            onClick={() => handleVote(song._id, 'up')}
                            className={`vote-btn ${userVotes[song._id] === 'up' ? 'voted-up' : ''}`}
                            title="Upvote"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleVote(song._id, 'down')}
                            className={`vote-btn ${userVotes[song._id] === 'down' ? 'voted-down' : ''}`}
                            title="Downvote"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleRemoveSong(song._id)}
                          className="btn btn-secondary"
                          style={{ padding: '8px 16px' }}
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => handleRemoveAndBlock(song._id, song.spotifyTrackId)}
                          className="btn btn-danger"
                          style={{ padding: '8px 16px' }}
                        >
                          🚫 Block
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Song History Section */}
        <div className="card">
          <h2>Song History ({history.length} songs)</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
            Recently played and removed songs from this session
          </p>
          <div style={{ marginTop: '16px' }}>
            {history.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>
                No history yet
              </p>
            ) : (
              history.map((song) => (
                <div
                  key={song._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    borderBottom: '1px solid var(--border-color)',
                    gap: '16px',
                    opacity: song.status === 'removed' ? 0.7 : 1
                  }}
                >
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
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Added by: {song.addedBy?.username || (song.isSystemAdded ? 'Recommended' : 'Unknown')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>
                      {song.netVotes > 0 ? '+' : ''}{song.netVotes}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      ↑{song.upvotes} ↓{song.downvotes}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: '600',
                      color: song.status === 'played' ? 'var(--primary-color)' : 'var(--spotify-red)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: song.status === 'played' ? 'rgba(29, 185, 84, 0.1)' : 'rgba(226, 33, 52, 0.1)'
                    }}>
                      {song.status === 'played' ? '✓ PLAYED' : '✗ REMOVED'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleBlockFromHistory(song.spotifyTrackId)}
                    className="btn btn-danger"
                    style={{ padding: '8px 16px' }}
                  >
                    🚫 Block
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
