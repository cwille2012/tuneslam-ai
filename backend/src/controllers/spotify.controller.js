import * as spotifyService from '../services/spotify.service.js';
import Session from '../models/Session.js';

export const getAuthUrl = async (req, res) => {
  try {
    const { sessionName } = req.query;
    
    if (!sessionName) {
      return res.status(400).json({
        success: false,
        error: 'Session name is required'
      });
    }
    
    const state = Buffer.from(JSON.stringify({
      sessionName,
      userId: req.userId
    })).toString('base64');
    
    const authUrl = spotifyService.getAuthUrl(state);
    
    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const callback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect(`${process.env.ADMIN_URL}/error?message=Authentication failed`);
    }
    
    const { sessionName } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    const tokens = await spotifyService.exchangeCodeForTokens(code);
    
    // Find session and update tokens
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.redirect(`${process.env.ADMIN_URL}/error?message=Session not found`);
    }
    
    session.spotifyAccessToken = tokens.accessToken;
    session.spotifyRefreshToken = tokens.refreshToken;
    session.spotifyTokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);
    
    // IMPORTANT: Save tokens to database BEFORE creating playlist
    // because createOrGetTuneslamPlaylist needs to read tokens from DB
    await session.save();
    
    // Create or get TuneSlam playlist (this will find tokens in database)
    const playlistId = await spotifyService.createOrGetTuneslamPlaylist(session._id);
    session.tuneslamPlaylistId = playlistId;
    
    // Save again with playlist ID
    await session.save();
    
    res.redirect(`${process.env.ADMIN_URL}/session/${sessionName}?spotify=linked`);
  } catch (error) {
    console.error('Spotify callback error:', error);
    res.redirect(`${process.env.ADMIN_URL}/error?message=Failed to link Spotify`);
  }
};

export const searchTracks = async (req, res) => {
  try {
    const { sessionName } = req.params;
    const { query, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const tracks = await spotifyService.searchTracks(
      session._id,
      query,
      limit ? parseInt(limit) : 20
    );
    
    res.json({
      success: true,
      tracks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getUserPlaylists = async (req, res) => {
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
        error: 'Only session owner can access playlists'
      });
    }
    
    const playlists = await spotifyService.getUserPlaylists(session._id);
    
    res.json({
      success: true,
      playlists
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getGenres = async (req, res) => {
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
        error: 'Only session owner can access genres'
      });
    }
    
    const genres = await spotifyService.getAvailableGenres(session._id);
    
    res.json({
      success: true,
      genres
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
