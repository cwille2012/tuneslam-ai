import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  songId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  voteType: {
    type: String,
    enum: ['up', 'down'],
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure one vote per user per song
voteSchema.index({ userId: 1, songId: 1 }, { unique: true });
voteSchema.index({ songId: 1 });
voteSchema.index({ sessionId: 1 });

const Vote = mongoose.model('Vote', voteSchema);

export default Vote;
