import React, { useState, useEffect } from 'react';
import { spotifyAPI, queueAPI, userSpotifyAPI } from '../services/api';

function SearchModal({ isOpen, onClose, sessionName, onSongAdded }) {
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'library'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(null);
  
  // Library state
  const [spotifyLinked, setSpotifyLinked] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [savedTracks, setSavedTracks] = useState([]);

  // Check Spotify link status when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'library') {
      checkSpotifyStatus();
    }
  }, [isOpen, activeTab]);

  // Search functionality
  useEffect(() => {
    if (activeTab !== 'search' || !query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchSongs();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query, activeTab]);

  const checkSpotifyStatus = async () => {
    try {
      const response = await userSpotifyAPI.getStatus();
      setSpotifyLinked(response.data.linked);
      if (response.data.linked) {
        loadPlaylists();
      }
    } catch (error) {
      console.error('Check Spotify status error:', error);
      setSpotifyLinked(false);
    }
  };

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const [playlistsRes, savedRes] = await Promise.all([
        userSpotifyAPI.getPlaylists(),
        userSpotifyAPI.getSavedTracks()
      ]);
      setPlaylists(playlistsRes.data.playlists);
      setSavedTracks(savedRes.data.tracks);
    } catch (error) {
      console.error('Load playlists error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylistTracks = async (playlistId) => {
    setLoading(true);
    setSelectedPlaylist(playlistId);
    try {
      const response = await userSpotifyAPI.getPlaylistTracks(playlistId);
      setPlaylistTracks(response.data.tracks);
    } catch (error) {
      console.error('Load playlist tracks error:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const renderSearchTab = () => (
    <>
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
    </>
  );

  const renderLibraryTab = () => {
    if (!spotifyLinked) {
      return (
        <>
          <div className="search-header">
            <button onClick={onClose} className="search-back-btn">
              ←
            </button>
            <div style={{ flex: 1, padding: '0 16px', fontSize: '18px', fontWeight: '600' }}>
              My Library
            </div>
          </div>
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--spotify-light-grey)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
            <h3 style={{ marginBottom: '12px' }}>Link Your Spotify Account</h3>
            <p style={{ marginBottom: '24px', lineHeight: '1.5' }}>
              Connect your Spotify account to browse your personal playlists and library when adding songs to the queue.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                onClose();
                window.location.href = '/profile';
              }}
            >
              Go to Profile Settings
            </button>
          </div>
        </>
      );
    }

    // Show playlist view if one is selected
    if (selectedPlaylist) {
      const playlist = playlists.find(p => p.id === selectedPlaylist);
      
      return (
        <>
          <div className="search-header">
            <button onClick={() => setSelectedPlaylist(null)} className="search-back-btn">
              ←
            </button>
            <div style={{ flex: 1, padding: '0 16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                {playlist?.name || 'Playlist'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--spotify-light-grey)' }}>
                {playlistTracks.length} songs
              </div>
            </div>
          </div>

          <div className="search-results">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
              </div>
            ) : (
              playlistTracks.map((track) => (
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
              ))
            )}
          </div>
        </>
      );
    }

    // Show playlists list
    return (
      <>
        <div className="search-header">
          <button onClick={onClose} className="search-back-btn">
            ←
          </button>
          <div style={{ flex: 1, padding: '0 16px', fontSize: '18px', fontWeight: '600' }}>
            My Library
          </div>
        </div>

        <div className="search-results">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          ) : (
            <>
              {/* Liked Songs */}
              {savedTracks.length > 0 && (
                <div
                  className="search-result-item"
                  onClick={() => {
                    setPlaylistTracks(savedTracks);
                    setSelectedPlaylist('liked');
                  }}
                  style={{ borderBottom: '1px solid var(--spotify-grey)', paddingBottom: '16px', marginBottom: '16px' }}
                >
                  <div style={{
                    width: '56px',
                    height: '56px',
                    background: 'linear-gradient(135deg, #450af5, #c4efd9)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    💜
                  </div>
                  <div className="song-info">
                    <div className="song-title">Liked Songs</div>
                    <div className="song-artist">{savedTracks.length} songs</div>
                  </div>
                  <div style={{ color: 'var(--spotify-light-grey)', fontSize: '20px' }}>→</div>
                </div>
              )}

              {/* Playlists */}
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="search-result-item"
                  onClick={() => loadPlaylistTracks(playlist.id)}
                >
                  {playlist.image ? (
                    <img
                      src={playlist.image}
                      alt={playlist.name}
                      className="song-artwork"
                    />
                  ) : (
                    <div style={{
                      width: '56px',
                      height: '56px',
                      background: 'var(--spotify-grey)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      🎵
                    </div>
                  )}
                  <div className="song-info">
                    <div className="song-title">{playlist.name}</div>
                    <div className="song-artist">{playlist.trackCount} songs</div>
                  </div>
                  <div style={{ color: 'var(--spotify-light-grey)', fontSize: '20px' }}>→</div>
                </div>
              ))}
            </>
          )}
        </div>
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="search-modal">
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--spotify-grey)',
        background: 'var(--spotify-black)'
      }}>
        <button
          onClick={() => {
            setActiveTab('search');
            setSelectedPlaylist(null);
          }}
          style={{
            flex: 1,
            padding: '16px',
            background: 'none',
            border: 'none',
            color: activeTab === 'search' ? 'var(--spotify-green)' : 'var(--spotify-light-grey)',
            borderBottom: activeTab === 'search' ? '2px solid var(--spotify-green)' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Search
        </button>
        <button
          onClick={() => {
            setActiveTab('library');
            setQuery('');
            setResults([]);
          }}
          style={{
            flex: 1,
            padding: '16px',
            background: 'none',
            border: 'none',
            color: activeTab === 'library' ? 'var(--spotify-green)' : 'var(--spotify-light-grey)',
            borderBottom: activeTab === 'library' ? '2px solid var(--spotify-green)' : '2px solid transparent',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          My Library
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'search' ? renderSearchTab() : renderLibraryTab()}
    </div>
  );
}

export default SearchModal;
