import React from 'react';

// Backend Song model uses: title, artist, albumArtUrl, netVotes, upvotes,
// downvotes, isLocked. (NOT name / artists / albumArt / votes.)
function QueueList({ queue }) {
  if (!queue || queue.length === 0) {
    return (
      <div className="player-queue">
        <div className="player-queue-title">Up Next</div>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '18px'
        }}>
          No songs in queue
        </div>
      </div>
    );
  }

  return (
    <div className="player-queue">
      <div className="player-queue-title">
        Up Next ({queue.length} {queue.length === 1 ? 'song' : 'songs'})
      </div>

      {queue.map((song, index) => {
        const artwork = song.albumArtUrl || song.albumArt || '/default-album.png';
        const title = song.title || song.name || 'Unknown Title';
        const artist = song.artist || song.artists || 'Unknown Artist';
        const netVotes = typeof song.netVotes === 'number'
          ? song.netVotes
          : (song.votes ?? 0);
        const locked = !!song.isLocked;

        return (
          <div
            key={song._id}
            className="player-queue-item"
            style={locked ? {
              // Highlight locked (next-up) song with a subtle green tint.
              background: 'rgba(29, 185, 84, 0.12)',
              border: '1px solid rgba(29, 185, 84, 0.45)',
              boxShadow: '0 0 0 1px rgba(29, 185, 84, 0.25)'
            } : undefined}
          >
            <img
              src={artwork}
              alt={song.album || title}
              className="player-queue-album-art"
              onError={(e) => {
                if (e.currentTarget.src !== window.location.origin + '/default-album.png') {
                  e.currentTarget.src = '/default-album.png';
                }
              }}
            />

            <div className="player-queue-info">
              <div
                className="player-queue-song-name"
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                {locked && (
                  <span
                    title="Locked — plays next"
                    style={{
                      fontSize: '20px',
                      filter: 'drop-shadow(0 0 6px rgba(29, 185, 84, 0.7))'
                    }}
                  >
                    🔒
                  </span>
                )}
                <span>{index + 1}. {title}</span>
              </div>
              <div className="player-queue-artist">
                {artist}
                {locked && (
                  <span style={{
                    marginLeft: '10px',
                    color: '#1DB954',
                    fontWeight: 600,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    • Up Next
                  </span>
                )}
              </div>
            </div>

            <div className="player-queue-votes">
              <div className="player-queue-vote-count">
                {netVotes > 0 ? '+' : ''}{netVotes}
              </div>
              <div className="player-queue-vote-label">
                {Math.abs(netVotes) === 1 ? 'vote' : 'votes'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default QueueList;
