import React, { useState, useEffect, useRef } from 'react';

function NowPlaying({ song, progress }) {
  const [localProgress, setLocalProgress] = useState(0);
  const lastUpdateRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Smooth progress animation between backend updates
  useEffect(() => {
    if (!progress) return;
    
    // Record the update time and progress
    lastUpdateRef.current = {
      progress: progress.progress,
      timestamp: Date.now()
    };
    
    // Initialize local progress
    setLocalProgress(progress.progress);
    
    // Animate progress smoothly every 200ms
    const interval = setInterval(() => {
      if (lastUpdateRef.current) {
        const elapsedSeconds = (Date.now() - lastUpdateRef.current.timestamp) / 1000;
        const newProgress = lastUpdateRef.current.progress + elapsedSeconds;
        
        // Don't exceed song duration
        const maxProgress = progress.duration || song?.duration || 0;
        if (newProgress <= maxProgress) {
          setLocalProgress(newProgress);
        }
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [progress, song]);

  if (!song) {
    return (
      <div className="tv-now-playing">
        <div className="tv-empty-state">
          <div className="tv-empty-icon">🎵</div>
          <div className="tv-empty-text">
            No song currently playing
            <br />
            Queue will start soon!
          </div>
        </div>
      </div>
    );
  }

  // Use interpolated local progress for smooth animation
  const totalDuration = progress?.duration || song.duration;
  const percentage = totalDuration > 0 ? (localProgress / totalDuration) * 100 : 0;

  return (
    <div className="tv-now-playing">
      <img
        src={song.albumArtUrl}
        alt={song.title}
        className="tv-album-art"
      />
      
      <div className="tv-track-info">
        <div className="tv-track-title">{song.title}</div>
        <div className="tv-track-artist">{song.artist}</div>
        
        <div className="tv-progress-bar">
          <div
            className="tv-progress-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="tv-time">
          <span>{formatTime(Math.floor(localProgress))}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}

export default NowPlaying;
