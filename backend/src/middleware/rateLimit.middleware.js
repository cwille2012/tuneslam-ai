import { getRedisClient } from '../config/redis.js';
import Session from '../models/Session.js';

export const checkSongAddRateLimit = async (req, res, next) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;
    
    // Get session settings
    const session = await Session.findOne({ name: sessionName });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // If unlimited, skip rate limiting
    if (!session.settings.songsPerHourLimit) {
      return next();
    }
    
    const redis = getRedisClient();
    const key = `ratelimit:${userId}:${session._id}`;
    
    // Get current count
    const count = await redis.get(key);
    const currentCount = count ? parseInt(count) : 0;
    
    if (currentCount >= session.settings.songsPerHourLimit) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Maximum ${session.settings.songsPerHourLimit} songs per hour.`
      });
    }
    
    // Increment counter
    await redis.incr(key);
    
    // Set expiry if this is the first song
    if (currentCount === 0) {
      await redis.expire(key, 3600); // 1 hour
    }
    
    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    // Don't block request on rate limit error
    next();
  }
};

export const checkBlockedUser = async (req, res, next) => {
  try {
    const { sessionName } = req.params;
    const userId = req.userId;
    
    const redis = getRedisClient();
    const key = `blockedusers:${sessionName}`;
    
    // Check Redis cache first
    const isBlocked = await redis.sIsMember(key, userId.toString());
    
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'You have been blocked from this session',
        blocked: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Blocked user check error:', error);
    // Continue on error
    next();
  }
};
