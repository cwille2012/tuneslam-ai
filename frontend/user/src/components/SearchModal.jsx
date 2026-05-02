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
        albumArt: track.albumArt
      };
      
      await queueAPI.addSong(sessionName, trackData);
      
      if (onSongAdded) {
        onSongAdded();
      }
      
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
    <div className="search-modal">
      <div className="search-header">
        <button onClick={onClose} className="search-back-btn">
          ←
        </button>
        <input
          type="text"
          className="search-input"
          placeholder="Search for songs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="search-results">
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--spotify-light-grey)' }}>
            No results found for "{query}"
          </div>
        )}

        {!loading && results.length === 0 && !query && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--spotify-light-grey)' }}>
            Start typing to search for songs
          </div>
        )}

        {results.map((track) => (
          <div
            key={track.id}
            className="search-result-item"
            onClick={() => handleAddSong(track)}
            style={{
              opacity: adding === track.id ? 0.5 : 1,
              pointerEvents: adding ? 'none' : 'auto'
            }}
          >
            <img
              src={track.albumArt}
              alt={track.title}
              className="song-artwork"
            />
            <div className="song-info">
              <div className="song-title">{track.title}</div>
              <div className="song-artist">
                {track.artist} • {formatDuration(track.duration)}
              </div>
            </div>
            {adding === track.id ? (
              <div style={{ color: 'var(--spotify-green)' }}>Adding...</div>
            ) : (
              <div style={{ color: 'var(--spotify-green)', fontSize: '24px' }}>+</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchModal;
