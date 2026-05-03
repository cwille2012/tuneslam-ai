import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionAPI, spotifyAPI } from '../services/api';
import Header from '../components/Header';

function SessionSettings() {
  const { sessionName } = useParams();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    downvoteThreshold: 3,
    maxSongDuration: 420,
    minSongPopularity: 0,
    songsPerHourLimit: null,
    allowReaddingRemovedSongs: false,
    autoFillMode: 'genre-search',
    autoFillMinimum: 3,
    customPlaylistId: null
  });
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSession();
  }, [sessionName]);

  const loadSession = async () => {
    try {
      const response = await sessionAPI.get(sessionName);
      const loadedSettings = response.data.session.settings || settings;
      setSettings(loadedSettings);
      
      // Auto-load playlists if custom-playlist mode is already selected
      if (loadedSettings.autoFillMode === 'custom-playlist') {
        loadPlaylists();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const response = await spotifyAPI.getPlaylists(sessionName);
      setPlaylists(response.data.playlists || []);
    } catch (err) {
      setError('Failed to load playlists. Make sure Spotify is linked.');
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // If changing to custom-playlist mode, load playlists
    if (name === 'autoFillMode' && value === 'custom-playlist') {
      loadPlaylists();
    }
    
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'select-one' ? value :  // Handle select dropdowns as strings
              (value === '' ? null : parseInt(value))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    
    // Validate custom playlist mode
    if (settings.autoFillMode === 'custom-playlist' && !settings.customPlaylistId) {
      setError('Please select a playlist for Custom Playlist mode');
      return;
    }
    
    setSaving(true);

    try {
      await sessionAPI.update(sessionName, { settings });
      setMessage('Settings updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update settings');
    } finally {
      setSaving(false);
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

  return (
    <div>
      <Header />
      
      <div className="container">
        <div className="card">
          <h1>Session Settings</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Configure settings for: {sessionName}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Downvote Threshold</label>
              <input
                type="number"
                name="downvoteThreshold"
                value={settings.downvoteThreshold}
                onChange={handleChange}
                min="1"
                max="20"
                disabled={saving}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Number of downvotes before a song is automatically removed from the queue
              </small>
            </div>

            <div className="form-group">
              <label>Max Song Duration (seconds)</label>
              <input
                type="number"
                name="maxSongDuration"
                value={settings.maxSongDuration || ''}
                onChange={handleChange}
                min="60"
                max="1800"
                placeholder="420 (7 minutes)"
                disabled={saving}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Maximum duration for songs that can be added to the queue (leave empty for no limit)
              </small>
            </div>

            <div className="form-group">
              <label>
                Minimum Song Popularity (0-100)
                <span className="info-tooltip">
                  ℹ️
                  <div className="info-tooltip-content">
                    <strong>Spotify Popularity Scale (0-100):</strong>
                    <ul>
                      <li><strong>0-20:</strong> Very obscure/indie tracks</li>
                      <li><strong>20-40:</strong> Lesser known songs</li>
                      <li><strong>40-60:</strong> Moderately popular</li>
                      <li><strong>60-80:</strong> Well-known hits</li>
                      <li><strong>80-100:</strong> Chart-topping mainstream hits</li>
                    </ul>
                  </div>
                </span>
              </label>
              <input
                type="number"
                name="minSongPopularity"
                value={settings.minSongPopularity || 0}
                onChange={handleChange}
                min="0"
                max="100"
                placeholder="0 (no minimum)"
                disabled={saving}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Only allow songs with this popularity or higher on Spotify's 0-100 scale (0 = no filter)
              </small>
            </div>

            <div className="form-group">
              <label>Songs Per Hour Limit</label>
              <input
                type="number"
                name="songsPerHourLimit"
                value={settings.songsPerHourLimit || ''}
                onChange={handleChange}
                min="1"
                max="100"
                placeholder="No limit"
                disabled={saving}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Maximum number of songs each user can add per hour (leave empty for unlimited)
              </small>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                name="allowReaddingRemovedSongs"
                checked={settings.allowReaddingRemovedSongs}
                onChange={handleChange}
                disabled={saving}
                style={{ width: 'auto' }}
              />
              <label style={{ margin: 0 }}>
                Allow re-adding songs that were removed by downvotes
              </label>
            </div>

            <div className="form-group">
              <label>Auto-Fill Mode</label>
              <select
                name="autoFillMode"
                value={settings.autoFillMode || 'genre-search'}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="genre-search">Genre Search (Recommended)</option>
                <option value="top-tracks">Your Top Tracks</option>
                <option value="related-artists">Related Artists</option>
                <option value="custom-playlist">Custom Playlist</option>
                <option value="off">Disabled</option>
              </select>
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Strategy for automatically filling the queue with AI-recommended songs when it gets low
              </small>
            </div>

            {settings.autoFillMode === 'custom-playlist' && (
              <div className="form-group">
                <label>Select Playlist</label>
                {loadingPlaylists ? (
                  <div style={{ padding: '12px', textAlign: 'center' }}>
                    <div className="spinner"></div>
                  </div>
                ) : (
                  <select
                    name="customPlaylistId"
                    value={settings.customPlaylistId || ''}
                    onChange={handleChange}
                    disabled={saving}
                  >
                    <option value="">-- Select a Playlist --</option>
                    {playlists.map(playlist => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.name} ({playlist.trackCount} tracks)
                      </option>
                    ))}
                  </select>
                )}
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                  Songs will be automatically added from this playlist when the queue is low
                </small>
              </div>
            )}

            <div className="form-group">
              <label>Auto-Fill Minimum Queue Size</label>
              <input
                type="number"
                name="autoFillMinimum"
                value={settings.autoFillMinimum || 3}
                onChange={handleChange}
                min="1"
                max="10"
                disabled={saving}
              />
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Maintain at least this many songs in the queue (only applies if Auto-Fill is enabled)
              </small>
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/session/${sessionName}`)}
                disabled={saving}
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

export default SessionSettings;
