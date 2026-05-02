import User from '../models/User.js';

export const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: user.toPublicJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      stats: {
        karma: user.karma,
        songsAddedCount: user.stats.songsAddedCount,
        songsPlayedCount: user.stats.songsPlayedCount,
        upvotesReceived: user.stats.upvotesReceived,
        downvotesReceived: user.stats.downvotesReceived
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
