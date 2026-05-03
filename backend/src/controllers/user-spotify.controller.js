import axios from 'axios';
import User from '../models/User.js';

// Generate Spotify authorization URL for user
export const getAuthUrl = (req, res) => {
  const scopes = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read'
  ];

  const authUrl = 'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.SPOTIFY_REDIRECT_USER_URI,
      scope: scopes.join(' '),
      state: req.userId // Pass user ID to identify after OAuth
    }).toString();

  res.json({ success: true, authUrl });
};

// Handle Spotify OAuth callback
export const handleCallback = async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code) {
    return res.redirect(`${process.env.USER_URL}/profile?error=No authorization code received`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_USER_URI,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get Spotify user info
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const spotifyUserId = userResponse.data.id;

    // Update user with Spotify credentials
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect(`${process.env.USER_URL}/profile?error=User not found`);
    }

    user.spotifyAccessToken = access_token;
    user.spotifyRefreshToken = refresh_token;
    user.spotifyUserId = spotifyUserId;
    user.spotifyLinkedAt = new Date();
    user.spotifyTokenExpires = new Date(Date.now() + expires_in * 1000);
    await user.save();

    res.redirect(`${process.env.USER_URL}/profile?spotify=linked`);
  } catch (error) {
    console.error('Spotify callback error:', error.response?.data || error.message);
    res.redirect(`${process.env.USER_URL}/profile?error=Failed to link Spotify`);
  }
};

// Refresh user's Spotify token if expired
const refreshToken = async (user) => {
  if (!user.spotifyRefreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.spotifyRefreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, expires_in, refresh_token } = response.data;

    user.spotifyAccessToken = access_token;
    user.spotifyTokenExpires = new Date(Date.now() + expires_in * 1000);
    
    // Spotify might return a new refresh token
    if (refresh_token) {
      user.spotifyRefreshToken = refresh_token;
    }

    await user.save();
    return access_token;
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw new Error('Failed to refresh Spotify token');
  }
};

// Get valid access token (refresh if needed)
const getValidToken = async (user) => {
  if (!user.spotifyAccessToken) {
    throw new Error('Spotify not linked');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  if (user.spotifyTokenExpires && user.spotifyTokenExpires <= new Date(Date.now() + 5 * 60 * 1000)) {
    return await refreshToken(user);
  }

  return user.spotifyAccessToken;
};

// Get user's playlists
export const getPlaylists = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user || !user.spotifyAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'Spotify not linked. Please link your Spotify account first.'
      });
    }

    const accessToken = await getValidToken(user);

    const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { limit: 50 }
    });

    const playlists = response.data.items.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      image: playlist.images[0]?.url || null,
      trackCount: playlist.tracks.total,
      owner: playlist.owner.display_name
    }));

    res.json({ success: true, playlists });
  } catch (error) {
    console.error('Get playlists error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch playlists'
    });
  }
};

// Get tracks from a specific playlist
export const getPlaylistTracks = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const user = await User.findById(req.userId);
    
    if (!user || !user.spotifyAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'Spotify not linked'
      });
    }

    const accessToken = await getValidToken(user);

    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { limit: 100 }
    });

    const tracks = response.data.items
      .filter(item => item.track && !item.track.is_local) // Filter out local files
      .map(item => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map(a => a.name).join(', '),
        album: item.track.album.name,
        albumArt: item.track.album.images[0]?.url || null,
        duration: Math.floor(item.track.duration_ms / 1000),
        popularity: item.track.popularity
      }));

    res.json({ success: true, tracks });
  } catch (error) {
    console.error('Get playlist tracks error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch playlist tracks'
    });
  }
};

// Get user's saved tracks (liked songs)
export const getSavedTracks = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user || !user.spotifyAccessToken) {
      return res.status(400).json({
        success: false,
        error: 'Spotify not linked'
      });
    }

    const accessToken = await getValidToken(user);

    // Get pagination params from query
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const response = await axios.get('https://api.spotify.com/v1/me/tracks', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { limit, offset }
    });

    const tracks = response.data.items.map(item => ({
      id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      album: item.track.album.name,
      albumArt: item.track.album.images[0]?.url || null,
      duration: Math.floor(item.track.duration_ms / 1000),
      popularity: item.track.popularity
    }));

    res.json({ 
      success: true, 
      tracks,
      total: response.data.total,
      hasMore: response.data.next !== null,
      offset: offset + tracks.length
    });
  } catch (error) {
    console.error('Get saved tracks error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved tracks'
    });
  }
};

// Unlink Spotify account
export const unlinkSpotify = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Clear Spotify credentials
    user.spotifyAccessToken = undefined;
    user.spotifyRefreshToken = undefined;
    user.spotifyUserId = undefined;
    user.spotifyLinkedAt = undefined;
    user.spotifyTokenExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Spotify account unlinked successfully'
    });
  } catch (error) {
    console.error('Unlink Spotify error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink Spotify'
    });
  }
};

// Check if user has Spotify linked
export const getStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      linked: !!user.spotifyAccessToken,
      spotifyUserId: user.spotifyUserId || null,
      linkedAt: user.spotifyLinkedAt || null
    });
  } catch (error) {
    console.error('Get Spotify status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Spotify status'
    });
  }
};
