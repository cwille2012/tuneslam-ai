import React from 'react';

function QueueList({ queue }) {
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (queue.length === 0) {
    return (
      <div className="tv-queue">
        <div className="tv-queue-header">
          <div className="tv-queue-title">Up Next</div>
          <div className="tv-queue-count">No songs queued</div>
        </div>
        <div className="tv-empty-state">
          <div className="tv-empty-icon">📱</div>
          <div className="tv-empty-text">
            Scan the QR code to add songs!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-queue">
      <div className="tv-queue-header">
        <div className="tv-queue-title">Up Next</div>
        <div className="tv-queue-count">{queue.length} songs in queue</div>
      </div>
      
      <div className={`tv-queue-list ${queue.length > 6 ? 'auto-scroll' : ''}`}>
        {queue.map((song, index) => (
          <div key={song._id} className="tv-queue-item">
            <div className="tv-queue-position">
              {song.isLocked ? (
                <span style={{ fontSize: '32px' }} title="Locked - Playing Next">🔒</span>
              ) : (
                `#${index + 1}`
              )}
            </div>
            
            <img
              src={song.albumArtUrl}
              alt={song.title}
              className="tv-queue-artwork"
            />
            
            <div className="tv-queue-info">
              <div className="tv-queue-song-title">
                {song.title}
                {song.isLocked && (
                  <span style={{
                    marginLeft: '12px',
                    fontSize: '16px',
                    color: '#1DB954',
                    background: 'rgba(29, 185, 84, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontWeight: '700'
                  }}>
                    NEXT UP
                  </span>
                )}
              </div>
              <div className="tv-queue-song-artist">{song.artist}</div>
            </div>
            
            <div className="tv-song-duration">
              {formatDuration(song.duration)}
            </div>
            
            <div className="tv-queue-votes">
              <div className="tv-vote-count">
                {song.netVotes > 0 ? '+' : ''}{song.netVotes}
              </div>
              <div className="tv-vote-breakdown">
                ↑{song.upvotes} ↓{song.downvotes}
              </div>
            </div>
          </div>
        ))}
        
        {/* Duplicate queue for smooth infinite scroll */}
        {queue.length > 6 && queue.map((song, index) => (
          <div key={`${song._id}-dup`} className="tv-queue-item">
            <div className="tv-queue-position">
              {song.isLocked ? (
                <span style={{ fontSize: '32px' }} title="Locked - Playing Next">🔒</span>
              ) : (
                `#${index + 1}`
              )}
            </div>
            <img src={song.albumArtUrl} alt={song.title} className="tv-queue-artwork" />
            <div className="tv-queue-info">
              <div className="tv-queue-song-title">
                {song.title}
                {song.isLocked && (
                  <span style={{
                    marginLeft: '12px',
                    fontSize: '16px',
                    color: '#1DB954',
                    background: 'rgba(29, 185, 84, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontWeight: '700'
                  }}>
                    NEXT UP
                  </span>
                )}
              </div>
              <div className="tv-queue-song-artist">{song.artist}</div>
            </div>
            <div className="tv-song-duration">{formatDuration(song.duration)}</div>
            <div className="tv-queue-votes">
              <div className="tv-vote-count">
                {song.netVotes > 0 ? '+' : ''}{song.netVotes}
              </div>
              <div className="tv-vote-breakdown">↑{song.upvotes} ↓{song.downvotes}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default QueueList;
