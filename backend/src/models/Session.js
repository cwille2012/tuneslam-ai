import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  songsAddedCount: {
    type: Number,
    default: 0
  },
  songsAdded: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  isBlocked: {
    type: Boolean,
    default: false
  }
});

const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    // URL-friendly format
    match: /^[a-z0-9-]+$/
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Encrypted Spotify tokens
  spotifyAccessToken: String,
  spotifyRefreshToken: String,
  spotifyTokenExpiry: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    downvoteThreshold: {
      type: Number,
      default: 3
    },
    allowRemovedSongReAdd: {
      type: Boolean,
      default: false
    },
    maxSongDuration: {
      type: Number,
      default: 420 // 7 minutes in seconds
    },
    songsPerHourLimit: {
      type: Number,
      default: null // null = unlimited
    },
    backupMode: {
      type: String,
      enum: ['playlist', 'genre', null],
      default: null
    },
    backupPlaylistId: String,
    backupGenre: String,
    autoFillMode: {
      type: String,
      enum: ['top-tracks', 'related-artists', 'genre-search', 'off'],
      default: 'genre-search'
    },
    autoFillMinimum: {
      type: Number,
      default: 3
    }
  },
  blacklist: [{
    type: String // Spotify track IDs
  }],
  tuneslamPlaylistId: String,
  needsPlaylistSwitch: {
    type: Boolean,
    default: false
  },
  currentlyPlaying: {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song'
    },
    startedAt: Date,
    lockedNextSongId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song'
    }
  },
  participants: [participantSchema],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Indexes
sessionSchema.index({ name: 1 });
sessionSchema.index({ ownerId: 1 });
sessionSchema.index({ isActive: 1 });

// Method to check if user is blocked
sessionSchema.methods.isUserBlocked = function(userId) {
  return this.blockedUsers.some(id => id.toString() === userId.toString());
};

// Method to add participant
sessionSchema.methods.addParticipant = function(userId, username) {
  const existing = this.participants.find(p => p.userId.toString() === userId.toString());
  if (!existing) {
    this.participants.push({
      userId,
      username,
      joinedAt: new Date(),
      songsAddedCount: 0,
      songsAdded: [],
      isBlocked: false
    });
  }
  return this.save();
};

// Method to get participant
sessionSchema.methods.getParticipant = function(userId) {
  return this.participants.find(p => p.userId.toString() === userId.toString());
};

const Session = mongoose.model('Session', sessionSchema);

export default Session;
