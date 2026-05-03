import express from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import passport from '../config/passport.js';

const router = express.Router();

// User registration
router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    validate
  ],
  authController.registerUser
);

// Admin registration
router.post('/register/admin',
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('businessName').trim().notEmpty().withMessage('Business name required'),
    body('address.street').trim().notEmpty().withMessage('Street address required'),
    body('address.city').trim().notEmpty().withMessage('City required'),
    body('address.state').trim().notEmpty().withMessage('State required'),
    body('address.zipCode').trim().notEmpty().withMessage('Zip code required'),
    body('address.country').trim().notEmpty().withMessage('Country required'),
    validate
  ],
  authController.registerAdmin
);

// Login
router.post('/login',
  [
    body('identifier').trim().notEmpty().withMessage('Email, username, or phone required'),
    body('password').notEmpty().withMessage('Password required'),
    validate
  ],
  authController.login
);

// Get current user
router.get('/me', authenticate, authController.getMe);

// Update user profile
router.put('/profile',
  authenticate,
  [
    body('username').optional().trim().isLength({ min: 3, max: 30 }),
    validate
  ],
  authController.updateProfile
);

// Update admin profile
router.put('/admin/profile',
  authenticate,
  requireAdmin,
  authController.updateAdminProfile
);

// Change password
router.put('/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    validate
  ],
  authController.changePassword
);

// OAuth Routes - Facebook
router.get('/facebook', (req, res, next) => {
  // Preserve state parameter (contains redirect URL)
  const state = req.query.state;
  
  passport.authenticate('facebook', { 
    scope: ['email', 'public_profile'],
    session: false,
    state: state // Pass through state
  })(req, res, next);
});

router.get('/facebook/callback',
  passport.authenticate('facebook', { 
    session: false,
    failureRedirect: `${process.env.USER_URL}/login?error=Facebook authentication failed`
  }),
  authController.facebookCallback
);

export default router;
