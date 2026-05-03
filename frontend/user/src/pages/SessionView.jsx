import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionAPI, queueAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import QueueItem from '../components/QueueItem';
import NowPlaying from '../components/NowPlaying';
import SearchModal from '../components/SearchModal';

function SessionView() {
  const { sessionName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const { connected, on, off } = useSocket(sessionName);

  useEffect(() => {
    loadSessionData();
  }, [sessionName]);

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

    const handleVotesChanged = () => {
      // loadQueue will be called by handleQueueUpdated
    };

    const handleNowPlayingUpdated = (data) => {
      setCurrentlyPlaying(data.song || null);
      loadQueue(); // Refresh queue to remove playing song from list
    };

    const handleSessionStatusChanged = (data) => {
      setSession(prev => ({ ...prev, isActive: data.isActive }));
    };

    const handleUserBlocked = (data) => {
      if (data.userId === user?.id) {
        setIsBlocked(true);
      }
    };

    const handleUserUnblocked = (data) => {
      if (data.userId === user?.id) {
        setIsBlocked(false);
      }
    };

    const handleSongLocked = (data) => {
      console.log('🔒 Song locked:', data.songId);
      // Update queue to show locked song
      setQueue(prev => prev.map(s => 
        s._id === data.songId 
          ? { ...s, isLocked: true }
          : { ...s, isLocked: false }  // Only one song can be locked
      ));
    };

    on('queue-updated', handleQueueUpdated);
    on('song-added', handleSongAdded);
    on('song-removed', handleSongRemoved);
    on('votes-changed', handleVotesChanged);
    on('now-playing-updated', handleNowPlayingUpdated);
    on('session-status-changed', handleSessionStatusChanged);
    on('user-blocked', handleUserBlocked);
    on('user-unblocked', handleUserUnblocked);
    on('song-locked', handleSongLocked);

    return () => {
      off('queue-updated', handleQueueUpdated);
      off('song-added', handleSongAdded);
      off('song-removed', handleSongRemoved);
      off('votes-changed', handleVotesChanged);
      off('now-playing-updated', handleNowPlayingUpdated);
      off('session-status-changed', handleSessionStatusChanged);
      off('user-blocked', handleUserBlocked);
      off('user-unblocked', handleUserUnblocked);
      off('song-locked', handleSongLocked);
    };
  }, [connected, on, off, user]);

  const loadSessionData = async () => {
    try {
      const [sessionRes, queueRes] = await Promise.all([
        sessionAPI.get(sessionName),
        queueAPI.get(sessionName)
      ]);
      setSession(sessionRes.data.session);
      
      // Separate currently playing from queued songs
      const allSongs = queueRes.data.queue || [];
      const playing = allSongs.find(s => s.status === 'playing');
      const queued = allSongs.filter(s => s.status === 'queued');
      
      setCurrentlyPlaying(playing || null);
      setQueue(queued);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    try {
      const response = await queueAPI.get(sessionName);
      const allSongs = response.data.queue || [];
      
      // Separate currently playing from queued songs
      const playing = allSongs.find(s => s.status === 'playing');
      const queued = allSongs.filter(s => s.status === 'queued');
      
      // Don't overwrite external songs (socket events handle those)
      setCurrentlyPlaying(prev => {
        // If API has a playing song, use it
        if (playing) return playing;
        // If previous was external, keep it
        if (prev?.isExternal) return prev;
        // Otherwise clear
        return null;
      });
      
      setQueue(queued);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!session?.isActive) {
    return (
      <div className="loading-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎵</div>
          <h1 style={{ marginBottom: '12px' }}>TuneSlam is Not Active</h1>
          <p style={{ color: 'var(--spotify-light-grey)', marginBottom: '24px' }}>
            The session "{sessionName}" is currently disabled.
            <br />
            Check back later!
          </p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="blocked-overlay">
        <div className="blocked-icon">🚫</div>
        <div className="blocked-title">Access Restricted</div>
        <div className="blocked-message">
          You have been blocked from participating in this session by the admin.
          <br /><br />
          You can still view the queue but cannot add or vote on songs.
        </div>
        <button className="btn btn-secondary" onClick={() => setIsBlocked(false)}>
          View Queue (Read-Only)
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="session-header">
        <div>
          <div className="session-title">{sessionName}</div>
          <div className="session-status">
            {connected ? '🟢 Connected' : '⚪ Connecting...'}
          </div>
        </div>
        <button
          className="settings-btn"
          onClick={() => navigate('/profile')}
          title="Profile Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Now Playing Section */}
      <NowPlaying song={currentlyPlaying} />

      <div className="queue-section">
        <div className="section-header">
          Queue ({queue.length})
        </div>

        {queue.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px' }}>🎵</div>
            <p>No songs in the queue yet.</p>
            <p>Be the first to add one!</p>
          </div>
        ) : (
          queue.map((song, index) => (
            <QueueItem
              key={song._id}
              song={song}
              index={index}
              sessionName={sessionName}
              currentUserId={user?.id}
              onVoteUpdate={loadQueue}
            />
          ))
        )}
      </div>

      <button
        className="add-song-fab"
        onClick={() => setShowSearch(true)}
        title="Add Song"
      >
        +
      </button>

      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        sessionName={sessionName}
        onSongAdded={loadQueue}
      />
    </div>
  );
}

export default SessionView;
