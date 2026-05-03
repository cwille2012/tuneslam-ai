import mongoose from 'mongoose';

const songSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  spotifyTrackId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  artist: {
    type: String,
    required: true
  },
  album: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true // Duration in seconds
  },
  albumArtUrl: {
    type: String,
    required: true
  },
  popularity: {
    type: Number,
    min: 0,
    max: 100,
    default: 0  // Spotify popularity rating 0-100
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false  // Not required for system-added songs
  },
  isSystemAdded: {
    type: Boolean,
    default: false
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  position: {
    type: Number,
    default: 0
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  netVotes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['queued', 'playing', 'played', 'removed'],
    default: 'queued'
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: Date,
  hasPlayed: {
    type: Boolean,
    default: false
  },
  playedAt: Date,
  removedAt: Date,
  removedReason: String // 'downvotes', 'admin', 'blacklist'
}, {
  timestamps: true
});

// Indexes for efficient queries
songSchema.index({ sessionId: 1, status: 1 });
songSchema.index({ sessionId: 1, spotifyTrackId: 1 });
songSchema.index({ sessionId: 1, netVotes: -1 });
songSchema.index({ addedBy: 1 });

// Method to calculate net votes
songSchema.methods.calculateNetVotes = function() {
  this.netVotes = this.upvotes - this.downvotes;
  return this.netVotes;
};

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const Song = mongoose.model('Song', songSchema);

export default Song;
