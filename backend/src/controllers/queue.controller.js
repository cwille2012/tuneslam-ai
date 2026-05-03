import Session from '../models/Session.js';
import Song from '../models/Song.js';
import * as queueService from '../services/queue.service.js';
import * as votingService from '../services/voting.service.js';

export const getQueue = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId; // From auth middleware
    
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const queue = await queueService.getQueue(session._id, userId);
    
    res.json({
      success: true,
      queue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const addSong = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const { trackData, adminOverride } = req.body;
    const userId = req.userId;
    
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const song = await queueService.addSongToQueue(session._id, userId, trackData, adminOverride);
    
    res.status(201).json({
      success: true,
      song
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

export const removeSong = async (req, res) => {
  try {
    const { sessionName, songId } = req.params;
    
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Verify ownership
    if (session.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only session owner can remove songs'
      });
    }
    
    const song = await queueService.removeSongFromQueue(session._id, songId, 'admin');
    
    res.json({
      success: true,
      song
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

export const voteSong = async (req, res) => {
  try {
    const { sessionName, songId } = req.params;
    const { voteType } = req.body;
    const userId = req.userId;
    
    if (!['up', 'down'].includes(voteType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vote type. Must be "up" or "down"'
      });
    }
    
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const { song, vote } = await votingService.castVote(session._id, songId, userId, voteType);
    
    res.json({
      success: true,
      song,
      vote
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

export const getUserVote = async (req, res) => {
  try {
    const { songId } = req.params;
    const userId = req.userId;
    
    const voteType = await votingService.getUserVoteForSong(userId, songId);
    
    res.json({
      success: true,
      voteType
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getHistory = async (req, res) => {
  try {
    const { sessionName } = req.params;
    
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Check if user is session owner
    if (session.ownerId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Only session owner can view history'
      });
    }
    
    // Get played and removed songs
    const history = await Song.find({
      sessionId: session._id,
      status: { $in: ['played', 'removed'] }
    })
    .populate('addedBy', 'username')
    .sort({ playedAt: -1, removedAt: -1, createdAt: -1 })
    .limit(50);
    
    res.json({
      success: true,
      history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
