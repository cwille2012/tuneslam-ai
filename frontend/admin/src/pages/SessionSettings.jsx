import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionAPI } from '../services/api';
import Header from '../components/Header';

function SessionSettings() {
  const { sessionName } = useParams();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    downvoteThreshold: 3,
    maxSongDuration: 420,
    songsPerHourLimit: null,
    allowReaddingRemovedSongs: false,
    autoFillMode: 'genre-search',
    autoFillMinimum: 3
  });
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
      setSettings(response.data.session.settings || settings);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
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
                <option value="off">Disabled</option>
              </select>
              <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                Strategy for automatically filling the queue with AI-recommended songs when it gets low
              </small>
            </div>

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
