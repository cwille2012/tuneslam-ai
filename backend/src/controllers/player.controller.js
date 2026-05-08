import axios from 'axios';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { getIO, emitToSession } from '../config/socket.js';
import { getValidAccessToken } from '../services/spotify.service.js';

// Get Spotify access token for player
// NOTE: The admin's Spotify account is linked at the SESSION level
// (see spotify.controller.js callback -> session.spotifyAccessToken).
// The User.spotifyAccessToken field is only used for regular end-users
// who link their personal library via the passport-spotify flow, so we
// must read the token from the Session here, not the User.
export const getPlayerToken = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;

    // Get session
    const session = await Session.findOne({ name: sessionName });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Verify user owns this session
    if (session.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Only session owner can access player' });
    }

    // Ensure the session has Spotify linked
    if (!session.spotifyAccessToken || !session.spotifyRefreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Spotify is not linked to this session. Please link Spotify from the Manage Session page.'
      });
    }

    // Get a fresh (auto-refreshed) access token scoped to this session
    let accessToken;
    try {
      accessToken = await getValidAccessToken(session._id);
    } catch (tokenErr) {
      console.error('Failed to get/refresh session Spotify token:', tokenErr);
      return res.status(400).json({
        success: false,
        error: 'Spotify token is invalid or expired. Please re-link Spotify from the Manage Session page.'
      });
    }

    // Verify Premium status (and streaming scope availability) in real time
    // by calling /v1/me. This self-heals the stored user.spotifyPremium flag
    // in case the admin linked Spotify before the Premium check was added.
    let profile;
    try {
      const profileResponse = await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      profile = profileResponse.data;
    } catch (profileErr) {
      const status = profileErr.response?.status;
      console.error('Failed to verify Spotify profile for player:', status, profileErr.response?.data || profileErr.message);
      if (status === 401 || status === 403) {
        return res.status(400).json({
          success: false,
          error: 'Spotify authorization failed. Please re-link Spotify from the Manage Session page (the required "streaming" scope may be missing).'
        });
      }
      return res.status(502).json({
        success: false,
        error: 'Unable to verify Spotify account. Please try again in a moment.'
      });
    }

    // Update cached Premium status on the User for consistency with the UI
    const owner = await User.findById(userId);
    const isPremium = !!profile.product && profile.product !== 'free';
    if (owner) {
      owner.spotifyPremium = isPremium;
      owner.spotifyAccountType = profile.product || 'free';
      await owner.save();
    }

    if (!isPremium) {
      return res.status(403).json({
        success: false,
        error: 'Spotify Premium or Business account is required for the web player.',
        accountType: profile.product || 'free'
      });
    }

    return res.json({
      success: true,
      accessToken,
      accountType: profile.product
    });
  } catch (error) {
    console.error('Error getting player token:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Register player as active
export const registerPlayer = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;

    const session = await Session.findOne({ name: sessionName });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Verify ownership
    if (session.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Only session owner can register player' });
    }

    // Mark player as connected
    session.playerConnected = true;
    session.activePlayerId = userId.toString();
    session.playerPaused = false;
    await session.save();

    // Emit to all clients in session (correct room is "session:<name>")
    emitToSession(sessionName, 'player-connected', {
      playerActive: true,
      timestamp: new Date()
    });

    console.log(`✅ Player registered for session: ${sessionName}`);

    res.json({
      success: true,
      message: 'Player registered successfully'
    });
  } catch (error) {
    console.error('Error registering player:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Unregister player
export const unregisterPlayer = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;

    const session = await Session.findOne({ name: sessionName });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Verify ownership
    if (session.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    // Clear player
    session.playerConnected = false;
    session.activePlayerId = null;
    session.playerDeviceId = null;
    session.playerPaused = false;
    await session.save();

    // Emit to all clients (correct room is "session:<name>")
    emitToSession(sessionName, 'player-disconnected', {
      playerActive: false,
      timestamp: new Date()
    });

    console.log(`❌ Player unregistered from session: ${sessionName}`);

    res.json({
      success: true,
      message: 'Player unregistered successfully'
    });
  } catch (error) {
    console.error('Error unregistering player:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Send play command to player
export const playControl = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;

    const session = await Session.findOne({ name: sessionName });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!session.playerConnected) {
      return res.status(400).json({ 
        success: false, 
        error: 'No active player connected' 
      });
    }

    // Update state
    session.playerPaused = false;
    await session.save();

    // Send play command via socket (correct room is "session:<name>")
    emitToSession(sessionName, 'playback-control', {
      action: 'play',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Play command sent'
    });
  } catch (error) {
    console.error('Error sending play command:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Send pause command to player
export const pauseControl = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;

    const session = await Session.findOne({ name: sessionName });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!session.playerConnected) {
      return res.status(400).json({ 
        success: false, 
        error: 'No active player connected' 
      });
    }

    // Update state
    session.playerPaused = true;
    await session.save();

    // Send pause command via socket (correct room is "session:<name>")
    emitToSession(sessionName, 'playback-control', {
      action: 'pause',
      timestamp: new Date()
    });

    // Also notify viewer about pause
    emitToSession(sessionName, 'player-paused', {
      paused: true,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Pause command sent'
    });
  } catch (error) {
    console.error('Error sending pause command:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Send skip command to player
export const skipControl = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;

    const session = await Session.findOne({ name: sessionName });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.ownerId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!session.playerConnected) {
      return res.status(400).json({ 
        success: false, 
        error: 'No active player connected' 
      });
    }

    // Send skip command via socket (correct room is "session:<name>")
    emitToSession(sessionName, 'playback-control', {
      action: 'skip',
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Skip command sent'
    });
  } catch (error) {
    console.error('Error sending skip command:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
