import express from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get user stats
router.get('/me/stats', authenticate, userController.getUserStats);

// Get user profile by ID
router.get('/:userId', authenticate, userController.getUserProfile);

export default router;
