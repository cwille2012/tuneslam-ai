import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import * as playerController from '../controllers/player.controller.js';

const router = express.Router({ mergeParams: true });

// Get Spotify token for player (admin only)
router.get('/:sessionName/player-token', authenticate, requireAdmin, playerController.getPlayerToken);

// Register/unregister player (admin only)
router.post('/:sessionName/register-player', authenticate, requireAdmin, playerController.registerPlayer);
router.delete('/:sessionName/register-player', authenticate, requireAdmin, playerController.unregisterPlayer);

// Playback controls from admin dashboard
router.post('/:sessionName/playback/play', authenticate, requireAdmin, playerController.playControl);
router.post('/:sessionName/playback/pause', authenticate, requireAdmin, playerController.pauseControl);
router.post('/:sessionName/playback/skip', authenticate, requireAdmin, playerController.skipControl);

export default router;
