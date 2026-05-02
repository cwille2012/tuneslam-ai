import React, { useState, useEffect } from 'react';
import { queueAPI } from '../services/api';

function QueueItem({ song, index, sessionName, currentUserId, onVoteUpdate }) {
  const [userVote, setUserVote] = useState(null);
  const [voting, setVoting] = useState(false);
  
  // Check if this is the user's own song
  const isOwnSong = currentUserId && song.addedBy?._id === currentUserId;

  const handleVote = async (voteType) => {
    if (voting || isOwnSong || song.isLocked) return;
    
    setVoting(true);
    try {
      await queueAPI.vote(sessionName, song._id, voteType);
      
      // Toggle vote: if same vote, remove it; otherwise change it
      setUserVote(userVote === voteType ? null : voteType);
      
      if (onVoteUpdate) {
        onVoteUpdate();
      }
    } catch (error) {
      console.error('Vote error:', error);
      if (error.response?.data?.blocked) {
        alert('You have been blocked from this session');
      } else {
        alert(error.response?.data?.error || 'Failed to vote');
      }
    } finally {
      setVoting(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="song-item">
      <div className="song-position">
        {song.isLocked ? (
          <span style={{ fontSize: '20px' }} title="Locked - Playing Next">🔒</span>
        ) : (
          `#${index + 1}`
        )}
      </div>
      
      <img
        src={song.albumArtUrl}
        alt={song.title}
        className="song-artwork"
      />
      
      <div className="song-info">
        <div className="song-title">
          {song.title}
          {song.isLocked && (
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '12px',
              color: 'var(--spotify-green)',
              background: 'rgba(29, 185, 84, 0.1)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '600'
            }}>
              Next Up
            </span>
          )}
        </div>
        <div className="song-artist">
          {song.artist} • {formatDuration(song.duration)}
        </div>
      </div>
      
      <div className="song-votes">
        {isOwnSong ? (
          <div className="own-song-badge" style={{ 
            fontSize: '12px', 
            color: 'var(--primary-color)', 
            fontWeight: '600',
            padding: '4px 8px',
            background: 'rgba(29, 185, 84, 0.1)',
            borderRadius: '4px'
          }}>
            Your Song
          </div>
        ) : (
          <>
            <div className="vote-count">
              {song.netVotes > 0 ? '+' : ''}{song.netVotes}
            </div>
            <div className="vote-buttons">
              <button
                className={`vote-btn ${userVote === 'up' ? 'voted-up' : ''}`}
                onClick={() => handleVote('up')}
                disabled={voting}
                title="Upvote"
              >
                ↑
              </button>
              <button
                className={`vote-btn ${userVote === 'down' ? 'voted-down' : ''}`}
                onClick={() => handleVote('down')}
                disabled={voting}
                title="Downvote"
              >
                ↓
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default QueueItem;
