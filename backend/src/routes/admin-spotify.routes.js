import express from 'express';
import * as adminSpotifyController from '../controllers/admin-spotify.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.get('/status', authenticate, adminSpotifyController.getStatus);
router.get('/playlists', authenticate, adminSpotifyController.getPlaylists);
router.get('/playlists/:playlistId/tracks', authenticate, adminSpotifyController.getPlaylistTracks);
router.get('/saved-tracks', authenticate, adminSpotifyController.getSavedTracks);

export default router;
