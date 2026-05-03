import express from 'express';
import * as userSpotifyController from '../controllers/user-spotify.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Spotify callback - NO AUTH (Spotify redirects here without JWT token)
router.get('/callback', userSpotifyController.handleCallback);

// All other routes require authentication
router.get('/auth-url', authenticate, userSpotifyController.getAuthUrl);
router.get('/status', authenticate, userSpotifyController.getStatus);
router.get('/playlists', authenticate, userSpotifyController.getPlaylists);
router.get('/playlists/:playlistId/tracks', authenticate, userSpotifyController.getPlaylistTracks);
router.get('/saved-tracks', authenticate, userSpotifyController.getSavedTracks);
router.delete('/unlink', authenticate, userSpotifyController.unlinkSpotify);

export default router;
