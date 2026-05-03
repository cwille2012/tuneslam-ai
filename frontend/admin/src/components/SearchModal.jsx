import React, { useState, useEffect } from 'react';
import { spotifyAPI, queueAPI } from '../services/api';

function SearchModal({ isOpen, onClose, sessionName, onSongAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchSongs();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const searchSongs = async () => {
    setLoading(true);
    try {
      const response = await spotifyAPI.search(sessionName, query);
      setResults(response.data.tracks);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSong = async (track) => {
    setAdding(track.id);
    try {
      const trackData = {
        spotifyTrackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        albumArt: track.albumArt,
        popularity: track.popularity
      };
      
      await queueAPI.addSong(sessionName, trackData);
      
      if (onSongAdded) {
        onSongAdded();
      }
      
      setQuery('');
      setResults([]);
      onClose();
    } catch (error) {
      console.error('Add song error:', error);
      alert(error.response?.data?.error || 'Failed to add song');
    } finally {
      setAdding(null);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>
        
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ marginBottom: '16px' }}>Search for a Song</h2>
          <input
            type="text"
            placeholder="Search songs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '16px'
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              No results found for "{query}"
            </p>
          )}

          {!loading && results.length === 0 && !query && (
            <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              Start typing to search for songs
            </p>
          )}

          {results.map((track) => (
            <div
              key={track.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px',
                gap: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                opacity: adding === track.id ? 0.5 : 1,
                pointerEvents: adding ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => handleAddSong(track)}
            >
              <img
                src={track.albumArt}
                alt={track.title}
                style={{ width: '60px', height: '60px', borderRadius: '4px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{track.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {track.artist} • {formatDuration(track.duration)}
                </div>
              </div>
              {adding === track.id ? (
                <div style={{ color: 'var(--primary-color)' }}>Adding...</div>
              ) : (
                <div style={{ color: 'var(--primary-color)', fontSize: '24px', fontWeight: '700' }}>+</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
