import express from 'express';
import { body } from 'express-validator';
import * as queueController from '../controllers/queue.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { checkSongAddRateLimit, checkBlockedUser } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

// Get queue for session (public for TV viewer)
router.get('/:sessionName/queue',
  optionalAuth,
  queueController.getQueue
);

// Add song to queue
router.post('/:sessionName/queue',
  authenticate,
  checkBlockedUser,
  checkSongAddRateLimit,
  [
    body('trackData').isObject().withMessage('Track data required'),
    body('trackData.spotifyTrackId').notEmpty().withMessage('Spotify track ID required'),
    body('trackData.title').notEmpty().withMessage('Track title required'),
    body('trackData.artist').notEmpty().withMessage('Artist required'),
    body('trackData.album').notEmpty().withMessage('Album required'),
    body('trackData.duration').isNumeric().withMessage('Duration required'),
    body('trackData.albumArt').notEmpty().withMessage('Album art URL required'),
    validate
  ],
  queueController.addSong
);

// Remove song from queue (admin only)
router.delete('/:sessionName/queue/:songId',
  authenticate,
  queueController.removeSong
);

// Vote on song
router.post('/:sessionName/queue/:songId/vote',
  authenticate,
  checkBlockedUser,
  [
    body('voteType').isIn(['up', 'down']).withMessage('Vote type must be "up" or "down"'),
    validate
  ],
  queueController.voteSong
);

// Get user's vote for a song
router.get('/:sessionName/queue/:songId/vote',
  authenticate,
  queueController.getUserVote
);

export default router;
