import express from 'express';
import { body, param } from 'express-validator';
import * as sessionController from '../controllers/session.controller.js';
import { authenticate, requireAdmin, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';

const router = express.Router();

// Get my sessions (admin only)
router.get('/my-sessions',
  authenticate,
  requireAdmin,
  sessionController.getMySessions
);

// Create session (admin only)
router.post('/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Session name required'),
    validate
  ],
  sessionController.createSession
);

// Get session details
router.get('/:sessionName',
  optionalAuth,
  sessionController.getSession
);

// Update session settings (admin only)
router.put('/:sessionName',
  authenticate,
  requireAdmin,
  sessionController.updateSession
);

// Toggle session active status (admin only)
router.post('/:sessionName/toggle',
  authenticate,
  requireAdmin,
  sessionController.toggleSession
);

// Delete session (admin only)
router.delete('/:sessionName',
  authenticate,
  requireAdmin,
  sessionController.deleteSession
);

// Link Spotify account (admin only)
router.post('/:sessionName/spotify',
  authenticate,
  requireAdmin,
  sessionController.linkSpotify
);

// Get session participants (admin only)
router.get('/:sessionName/participants',
  authenticate,
  requireAdmin,
  sessionController.getParticipants
);

// Block user (admin only)
router.post('/:sessionName/participants/:userId/block',
  authenticate,
  requireAdmin,
  sessionController.blockUser
);

// Unblock user (admin only)
router.post('/:sessionName/participants/:userId/unblock',
  authenticate,
  requireAdmin,
  sessionController.unblockUser
);

// Add song to blacklist (admin only)
router.post('/:sessionName/blacklist',
  authenticate,
  requireAdmin,
  [
    body('trackId').notEmpty().withMessage('Track ID required'),
    validate
  ],
  sessionController.addToBlacklist
);

// Remove song from blacklist (admin only)
router.delete('/:sessionName/blacklist/:trackId',
  authenticate,
  requireAdmin,
  sessionController.removeFromBlacklist
);

export default router;
