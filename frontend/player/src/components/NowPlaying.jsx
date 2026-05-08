import React from 'react';

function NowPlaying({ track, position, duration, isPaused }) {
  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  if (!track) {
    return (
      <div className="player-now-playing">
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎵</div>
        <div style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.5)' }}>
          No track playing
        </div>
      </div>
    );
  }

  return (
    <div className="player-now-playing">
      {isPaused && (
        <div className="player-status player-status-paused">
          ⏸️ Paused
        </div>
      )}
      
      <img
        src={track.albumArt || '/default-album.png'}
        alt={track.album}
        className="player-album-art"
      />
      
      <div className="player-track-info">
        <div className="player-track-name">{track.name}</div>
        <div className="player-track-artist">{track.artists}</div>
        
        <div className="player-progress">
          <div className="player-progress-bar">
            <div 
              className="player-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="player-progress-time">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NowPlaying;
