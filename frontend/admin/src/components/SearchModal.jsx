import React, { useState, useEffect } from 'react';
import { spotifyAPI, queueAPI, adminSpotifyAPI } from '../services/api';

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
  const [savedTracksHasMore, setSavedTracksHasMore] = useState(false);
  const [savedTracksOffset, setSavedTracksOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

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
      const response = await adminSpotifyAPI.getStatus();
      setSpotifyLinked(response.data.linked);
      if (response.data.linked) {
        loadLibrary();
      }
    } catch (error) {
      console.error('Check Spotify status error:', error);
      setSpotifyLinked(false);
    }
  };

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const [playlistsRes, savedRes] = await Promise.all([
        adminSpotifyAPI.getPlaylists(),
        adminSpotifyAPI.getSavedTracks(0, 50)
      ]);
      setPlaylists(playlistsRes.data.playlists);
      setSavedTracks(savedRes.data.tracks);
      setSavedTracksHasMore(savedRes.data.hasMore);
      setSavedTracksOffset(savedRes.data.offset);
    } catch (error) {
      console.error('Load library error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreSavedTracks = async () => {
    setLoadingMore(true);
    try {
      const response = await adminSpotifyAPI.getSavedTracks(savedTracksOffset, 50);
      setSavedTracks(prev => [...prev, ...response.data.tracks]);
      setSavedTracksHasMore(response.data.hasMore);
      setSavedTracksOffset(response.data.offset);
    } catch (error) {
      console.error('Load more saved tracks error:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadPlaylistTracks = async (playlistId) => {
    setLoading(true);
    setSelectedPlaylist(playlistId);
    try {
      const response = await adminSpotifyAPI.getPlaylistTracks(playlistId);
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
      
      setQuery('');
      setResults([]);
      onClose();
    } catch (error) {
      console.error('Add song error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to add song';
      
      // Check if this is a validation error (400 status)
      if (error.response?.status === 400) {
        // Show confirmation dialog for admin override
        const confirmed = window.confirm(
          `⚠️ ${errorMessage}\n\nAs admin, do you want to add this song anyway?`
        );
        
        if (confirmed) {
          try {
            // Retry with admin override
            await queueAPI.addSong(sessionName, trackData, { adminOverride: true });
            
            if (onSongAdded) {
              onSongAdded();
            }
            
            setQuery('');
            setResults([]);
            onClose();
            return;
          } catch (retryError) {
            alert(retryError.response?.data?.error || 'Failed to add song with override');
          }
        }
      } else {
        alert(errorMessage);
      }
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
    </>
  );

  const renderLibraryTab = () => {
    if (!spotifyLinked) {
      return (
        <>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <h2>My Library</h2>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
            <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Spotify Not Linked</h3>
            <p style={{ marginBottom: '24px', lineHeight: '1.5' }}>
              Your session's Spotify account will be used to browse your library. Please ensure Spotify is linked to your session.
            </p>
          </div>
        </>
      );
    }

    // Show tracks view if playlist/liked songs selected
    if (selectedPlaylist) {
      const playlist = playlists.find(p => p.id === selectedPlaylist);
      const isLikedSongs = selectedPlaylist === 'liked';
      const tracks = isLikedSongs ? savedTracks : playlistTracks;
      
      return (
        <>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setSelectedPlaylist(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                marginRight: '12px'
              }}
            >
              ←
            </button>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>
              {isLikedSongs ? 'Liked Songs' : (playlist?.name || 'Playlist')}
            </span>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px', marginLeft: '36px' }}>
              {tracks.length} songs{isLikedSongs && savedTracksHasMore && '+'}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
              </div>
            ) : (
              <>
                {tracks.map((track) => (
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

                {/* Load More button for Liked Songs */}
                {isLikedSongs && savedTracksHasMore && (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <button
                      onClick={loadMoreSavedTracks}
                      disabled={loadingMore}
                      className="btn btn-secondary"
                      style={{ width: '100%' }}
                    >
                      {loadingMore ? 'Loading...' : 'Load More Songs'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      );
    }

    // Show playlists list
    return (
      <>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
          <h2>My Library</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          ) : (
            <>
              {/* Liked Songs */}
              {savedTracks.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    gap: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '12px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => {
                    setPlaylistTracks(savedTracks);
                    setSelectedPlaylist('liked');
                  }}
                >
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #450af5, #c4efd9)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px'
                  }}>
                    💜
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Liked Songs</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {savedTracks.length} songs
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '20px' }}>→</div>
                </div>
              )}

              {/* Playlists */}
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    gap: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => loadPlaylistTracks(playlist.id)}
                >
                  {playlist.image ? (
                    <img
                      src={playlist.image}
                      alt={playlist.name}
                      style={{ width: '60px', height: '60px', borderRadius: '8px' }}
                    />
                  ) : (
                    <div style={{
                      width: '60px',
                      height: '60px',
                      background: 'var(--bg-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '28px'
                    }}>
                      🎵
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{playlist.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {playlist.trackCount} songs
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '20px' }}>→</div>
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
        
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
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
              borderBottom: activeTab === 'search' ? '3px solid var(--primary-color)' : '3px solid transparent',
              fontSize: '16px',
              fontWeight: '600',
              color: activeTab === 'search' ? 'var(--primary-color)' : 'var(--text-secondary)',
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
              borderBottom: activeTab === 'library' ? '3px solid var(--primary-color)' : '3px solid transparent',
              fontSize: '16px',
              fontWeight: '600',
              color: activeTab === 'library' ? 'var(--primary-color)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            My Library
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'search' ? renderSearchTab() : renderLibraryTab()}

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
