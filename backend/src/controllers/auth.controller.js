import * as authService from '../services/auth.service.js';
import jwt from 'jsonwebtoken';

export const registerUser = async (req, res) => {
  try {
    const { username, email, phoneNumber, password } = req.body;
    
    const { user, token } = await authService.registerUser({
      username,
      email,
      phoneNumber,
      password
    });
    
    res.status(201).json({
      success: true,
      user: user.toPublicJSON(),
      token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

export const registerAdmin = async (req, res) => {
  try {
    const { username, email, phoneNumber, password, businessName, address } = req.body;
    
    const { user, token } = await authService.registerAdmin({
      username,
      email,
      phoneNumber,
      password,
      businessName,
      address
    });
    
    res.status(201).json({
      success: true,
      user: user.toAdminJSON(),
      token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    const { user, token } = await authService.loginUser(identifier, password);
    
    const userJSON = user.isAdmin ? user.toAdminJSON() : user.toPublicJSON();
    
    res.json({
      success: true,
      user: userJSON,
      token
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const userJSON = user.isAdmin ? user.toAdminJSON() : user.toPublicJSON();
    
    res.json({
      success: true,
      user: userJSON
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    
    const { user, token } = await authService.updateUserProfile(req.userId, { username });
    
    res.json({
      success: true,
      user: user.toPublicJSON(),
      token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    const { user, token } = await authService.updateAdminProfile(req.userId, updates);
    
    res.json({
      success: true,
      user: user.toAdminJSON(),
      token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    await authService.changePassword(req.userId, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// OAuth Callbacks
export const facebookCallback = async (req, res) => {
  try {
    // User is attached by passport after successful auth
    const user = req.user;
    
    if (!user) {
      return res.redirect(`${process.env.USER_URL}/login?error=Authentication failed`);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Extract state parameter (contains redirect URL)
    const state = req.query.state;
    
    // Redirect to user frontend with token and optional redirect
    let redirectUrl = `${process.env.USER_URL}/oauth-callback?token=${token}`;
    if (state) {
      redirectUrl += `&redirect=${encodeURIComponent(state)}`;
    }
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Facebook callback error:', error);
    res.redirect(`${process.env.USER_URL}/login?error=Authentication failed`);
  }
};

