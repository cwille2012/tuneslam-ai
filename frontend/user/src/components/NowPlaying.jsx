import React from 'react';

function NowPlaying({ song }) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!song) {
    return (
      <div className="now-playing-empty">
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎵</div>
        <div style={{ color: 'var(--spotify-light-grey)', fontSize: '14px' }}>
          No song playing yet
        </div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="now-playing-header">Now Playing</div>
      <div className="now-playing-content">
        <img
          src={song.albumArtUrl}
          alt={song.title}
          className="now-playing-artwork"
        />
        <div className="now-playing-info">
          <div className="now-playing-title">{song.title}</div>
          <div className="now-playing-artist">{song.artist}</div>
        </div>
      </div>
    </div>
  );
}

export default NowPlaying;
