import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      req.isAdmin = decoded.isAdmin;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
