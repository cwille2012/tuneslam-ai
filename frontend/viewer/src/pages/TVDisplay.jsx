import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { sessionAPI, queueAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import NowPlaying from '../components/NowPlaying';
import QueueList from '../components/QueueList';

function TVDisplay() {
  const { sessionName } = useParams();
  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // For viewer, we need a token - in production, admin would provide this
  // For now, we'll use localStorage token if available
  const token = localStorage.getItem('token');
  const { connected, on, off } = useSocket(sessionName, token);

  useEffect(() => {
    loadSessionData();
  }, [sessionName]);

  useEffect(() => {
    if (!connected) return;

    console.log('🔌 Setting up socket listeners for session:', sessionName);

    const handleQueueUpdated = (data) => {
      console.log('📋 queue-updated received:', data);
      if (data.queue) {
        setQueue(data.queue);
      }
    };

    const handleSongAdded = () => {
      console.log('➕ song-added received');
      loadQueue();
    };

    const handleSongRemoved = () => {
      console.log('➖ song-removed received');
      loadQueue();
    };

    const handleVotesChanged = () => {
      console.log('🗳️ votes-changed received');
      loadQueue();
    };

    const handleNowPlayingUpdated = (data) => {
      console.log('🎵 now-playing-updated received:', data);
      // Always update, even if song is null (clears display)
      setCurrentlyPlaying(data.song || null);
    };

    const handlePlaybackProgress = (data) => {
      console.log('⏱️ playback-progress received:', data.percentage + '%');
      setProgress(data);
    };

    const handleSongLocked = (data) => {
      console.log('🔒 song-locked received:', data.songId);
      // Update queue to show locked song
      setQueue(prev => prev.map(s => 
        s._id === data.songId 
          ? { ...s, isLocked: true }
          : { ...s, isLocked: false }
      ));
    };

    on('queue-updated', handleQueueUpdated);
    on('song-added', handleSongAdded);
    on('song-removed', handleSongRemoved);
    on('votes-changed', handleVotesChanged);
    on('now-playing-updated', handleNowPlayingUpdated);
    on('playback-progress', handlePlaybackProgress);
    on('song-locked', handleSongLocked);

    console.log('✅ All socket handlers registered');

    return () => {
      off('queue-updated', handleQueueUpdated);
      off('song-added', handleSongAdded);
      off('song-removed', handleSongRemoved);
      off('votes-changed', handleVotesChanged);
      off('now-playing-updated', handleNowPlayingUpdated);
      off('playback-progress', handlePlaybackProgress);
      off('song-locked', handleSongLocked);
    };
  }, [connected, on, off]);

  const loadSessionData = async () => {
    try {
      const [sessionRes, queueRes] = await Promise.all([
        sessionAPI.get(sessionName),
        queueAPI.get(sessionName)
      ]);
      
      setSession(sessionRes.data.session);
      const queueData = queueRes.data.queue;
      
      // Separate currently playing from queue
      const playing = queueData.find(s => s.status === 'playing');
      const queued = queueData.filter(s => s.status === 'queued');
      
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
      const queueData = response.data.queue;
      
      const playing = queueData.find(s => s.status === 'playing');
      const queued = queueData.filter(s => s.status === 'queued');
      
      // Only update currently playing if there's a queue song or clear if no external
      // Don't overwrite external songs (socket events handle those)
      setCurrentlyPlaying(prev => {
        // If API has a playing song, use it
        if (playing) return playing;
        // If previous was external, keep it (external songs aren't in API)
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
      <div className="tv-loading">
        <div className="tv-spinner"></div>
        <div style={{ marginTop: '30px', fontSize: '24px', color: 'var(--tv-light-grey)' }}>
          Loading TuneSlam...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tv-loading">
        <div style={{ fontSize: '64px', marginBottom: '30px' }}>😕</div>
        <div style={{ fontSize: '24px', color: 'var(--tv-light-grey)' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!session?.isActive) {
    return (
      <div className="tv-loading">
        <div style={{ fontSize: '120px', marginBottom: '40px' }}>💤</div>
        <div style={{ fontSize: '48px', fontWeight: '700', marginBottom: '20px' }}>
          TuneSlam is Not Active
        </div>
        <div style={{ fontSize: '24px', color: 'var(--tv-light-grey)' }}>
          Check back later when the session starts!
        </div>
      </div>
    );
  }

  return (
    <div className="tv-container">
      <div className="tv-header">
        <div className="tv-logo">TuneSlam</div>
        
        <div className="tv-session-info">
          {session?.qrCode && (
            <img
              src={session.qrCode}
              alt="Session QR Code"
              className="tv-qr-code"
            />
          )}
          
          <div className="tv-url">
            <div className="tv-url-label">Join the queue:</div>
            <div className="tv-url-text">
              {session?.sessionUrl?.replace('http://localhost:5174', 'tuneslam.com') || ''}
            </div>
          </div>
        </div>
      </div>

      <div className="tv-main">
        <NowPlaying song={currentlyPlaying} progress={progress} />
        <QueueList queue={queue} />
      </div>
    </div>
  );
}

export default TVDisplay;
