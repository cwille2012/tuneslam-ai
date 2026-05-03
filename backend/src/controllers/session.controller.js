import Session from '../models/Session.js';
import Song from '../models/Song.js';
import { getRedisClient } from '../config/redis.js';
import { emitToSession } from '../config/socket.js';
import { sanitizeSessionName } from '../middleware/validation.middleware.js';
import { generateQRCode } from '../utils/qrcode.util.js';
import { createOrGetTuneslamPlaylist } from '../services/spotify.service.js';

export const getMySessions = async (req, res) => {
  try {
    const sessions = await Session.find({ ownerId: req.userId })
      .sort({ isActive: -1, updatedAt: -1 })
      .lean();
    
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const createSession = async (req, res) => {
  try {
    const { name, settings } = req.body;
    const ownerId = req.userId;
    
    // Check if user already has an active session
    const existingSession = await Session.findOne({ ownerId, isActive: true });
    if (existingSession) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active session. Please close it first.'
      });
    }
    
    // Sanitize session name
    const sanitizedName = sanitizeSessionName(name);
    
    // Check if session name exists
    const nameExists = await Session.findOne({ name: sanitizedName });
    if (nameExists) {
      return res.status(400).json({
        success: false,
        error: 'Session name already taken'
      });
    }
    
    const session = new Session({
      name: sanitizedName,
      ownerId,
      isActive: true,
      settings: settings || {}
    });
    
    await session.save();
    
    res.status(201).json({
      success: true,
      session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getSession = async (req, res) => {
  try {
    const { sessionName } = req.params;
    
    const session = await Session.findOne({ name: sessionName })
      .populate('ownerId', 'username businessName')
      .lean();
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Generate QR code
    const sessionUrl = `${process.env.USER_URL}/session/${sessionName}`;
    const qrCode = await generateQRCode(sessionUrl);
    
    // Get current queue
    const queue = await Song.find({
      sessionId: session._id,
      status: { $in: ['queued', 'playing'] }
    })
      .populate('addedBy', 'username karma')
      .sort({ status: -1, netVotes: -1, addedAt: 1 });
    
    res.json({
      success: true,
      session: {
        ...session,
        qrCode,
        sessionUrl
      },
      queue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const updateSession = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const { settings } = req.body;
    
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
        error: 'You do not own this session'
      });
    }
    
    // Update settings
    if (settings) {
      session.settings = { ...session.settings, ...settings };
    }
    
    await session.save();
    
    emitToSession(sessionName, 'session-updated', { session });
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const toggleSession = async (req, res) => {
  try {
    const { sessionName } = req.params;
    
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
        error: 'You do not own this session'
      });
    }
    
    session.isActive = !session.isActive;
    await session.save();
    
    emitToSession(sessionName, 'session-status-changed', { isActive: session.isActive });
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const { sessionName } = req.params;
    
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
        error: 'You do not own this session'
      });
    }
    
    // Delete all songs in session
    await Song.deleteMany({ sessionId: session._id });
    
    // Delete session
    await Session.deleteOne({ _id: session._id });
    
    // Clear Redis cache
    const redis = getRedisClient();
    await redis.del(`queue:${session._id}`);
    await redis.del(`session:${sessionName}`);
    await redis.del(`blockedusers:${sessionName}`);
    
    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const linkSpotify = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const { accessToken, refreshToken, expiresIn } = req.body;
    
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
        error: 'You do not own this session'
      });
    }
    
    session.spotifyAccessToken = accessToken;
    session.spotifyRefreshToken = refreshToken;
    session.spotifyTokenExpiry = new Date(Date.now() + expiresIn * 1000);
    
    // Create or get TuneSlam playlist
    const playlistId = await createOrGetTuneslamPlaylist(session._id);
    session.tuneslamPlaylistId = playlistId;
    
    await session.save();
    
    res.json({
      success: true,
      message: 'Spotify linked successfully',
      session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getParticipants = async (req, res) => {
  try {
    const { sessionName } = req.params;
    
    const session = await Session.findOne({ name: sessionName })
      .populate('participants.userId', 'username karma stats isAdmin');
    
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
        error: 'You do not own this session'
      });
    }
    
    res.json({
      success: true,
      participants: session.participants
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { sessionName, userId } = req.params;
    
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
        error: 'You do not own this session'
      });
    }
    
    // Add to blocked users
    if (!session.blockedUsers.includes(userId)) {
      session.blockedUsers.push(userId);
    }
    
    // Update participant status
    const participant = session.participants.find(p => p.userId.toString() === userId);
    if (participant) {
      participant.isBlocked = true;
    }
    
    await session.save();
    
    // Update Redis cache
    const redis = getRedisClient();
    await redis.sAdd(`blockedusers:${sessionName}`, userId);
    
    // Emit event to user
    emitToSession(sessionName, 'user-blocked', { userId });
    
    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { sessionName, userId } = req.params;
    
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
        error: 'You do not own this session'
      });
    }
    
    // Remove from blocked users
    session.blockedUsers = session.blockedUsers.filter(id => id.toString() !== userId);
    
    // Update participant status
    const participant = session.participants.find(p => p.userId.toString() === userId);
    if (participant) {
      participant.isBlocked = false;
    }
    
    await session.save();
    
    // Update Redis cache
    const redis = getRedisClient();
    await redis.sRem(`blockedusers:${sessionName}`, userId);
    
    // Emit event to user
    emitToSession(sessionName, 'user-unblocked', { userId });
    
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const addToBlacklist = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const { trackId } = req.body;
    
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
        error: 'You do not own this session'
      });
    }
    
    if (!session.blacklist.includes(trackId)) {
      session.blacklist.push(trackId);
      await session.save();
      
      // Update Redis cache
      const redis = getRedisClient();
      await redis.sAdd(`blacklist:${session._id}`, trackId);
    }
    
    res.json({
      success: true,
      message: 'Track added to blacklist'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const removeFromBlacklist = async (req, res) => {
  try {
    const { sessionName, trackId } = req.params;
    
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
        error: 'You do not own this session'
      });
    }
    
    session.blacklist = session.blacklist.filter(id => id !== trackId);
    await session.save();
    
    // Update Redis cache
    const redis = getRedisClient();
    await redis.sRem(`blacklist:${session._id}`, trackId);
    
    res.json({
      success: true,
      message: 'Track removed from blacklist'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const resetSession = async (req, res) => {
  try {
    const { sessionName } = req.params;
    
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
        error: 'You do not have permission to reset this session'
      });
    }
    
    const { resetSessionQueue } = await import('../services/queue.service.js');
    const result = await resetSessionQueue(session._id);
    
    res.json({
      success: true,
      message: `Session reset successfully. ${result.songsCleared} songs cleared.`,
      songsCleared: result.songsCleared
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
