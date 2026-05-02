import express from 'express';
import * as spotifyController from '../controllers/spotify.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get Spotify auth URL
router.get('/auth', authenticate, requireAdmin, spotifyController.getAuthUrl);

// Spotify OAuth callback
router.get('/callback', spotifyController.callback);

// Search tracks
router.get('/search/:sessionName', authenticate, spotifyController.searchTracks);

// Get user playlists (admin only)
router.get('/playlists/:sessionName', authenticate, requireAdmin, spotifyController.getUserPlaylists);

// Get available genres (admin only)
router.get('/genres/:sessionName', authenticate, requireAdmin, spotifyController.getGenres);

export default router;
