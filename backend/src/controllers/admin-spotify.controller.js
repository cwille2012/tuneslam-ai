import axios from 'axios';
import Session from '../models/Session.js';

// Refresh session's Spotify token if expired
const refreshToken = async (session) => {
  if (!session.spotifyRefreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: session.spotifyRefreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, expires_in, refresh_token } = response.data;

    session.spotifyAccessToken = access_token;
    session.spotifyTokenExpiry = new Date(Date.now() + expires_in * 1000);
    
    // Spotify might return a new refresh token
    if (refresh_token) {
      session.spotifyRefreshToken = refresh_token;
    }

    await session.save();
    return access_token;
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw new Error('Failed to refresh Spotify token');
  }
};

// Get valid access token (refresh if needed)
const getValidToken = async (session) => {
  if (!session.spotifyAccessToken) {
    throw new Error('Spotify not linked to session');
  }

  // Check if token is expired or about to expire (within 5 minutes)
  if (session.spotifyTokenExpiry && session.spotifyTokenExpiry <= new Date(Date.now() + 5 * 60 * 1000)) {
    return await refreshToken(session);
  }

  return session.spotifyAccessToken;
};

// Get user's active session (admin must have a session)
const getAdminSession = async (userId) => {
  const session = await Session.findOne({ 
    ownerId: userId,
    spotifyAccessToken: { $exists: true, $ne: null }
  }).sort({ createdAt: -1 });
  
  if (!session) {
    throw new Error('No active session with Spotify linked');
  }
  
  return session;
};

// Check if admin has Spotify linked (via session)
export const getStatus = async (req, res) => {
  try {
    const session = await Session.findOne({ 
      ownerId: req.userId,
      spotifyAccessToken: { $exists: true, $ne: null }
    });

    res.json({
      success: true,
      linked: !!session,
      sessionName: session?.name || null
    });
  } catch (error) {
    console.error('Get admin Spotify status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Spotify status'
    });
  }
};

// Get admin's playlists (from session's Spotify)
export const getPlaylists = async (req, res) => {
  try {
    const session = await getAdminSession(req.userId);
    const accessToken = await getValidToken(session);

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
    console.error('Get admin playlists error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch playlists'
    });
  }
};

// Get tracks from a specific playlist
export const getPlaylistTracks = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const session = await getAdminSession(req.userId);
    const accessToken = await getValidToken(session);

    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { limit: 100 }
    });

    const tracks = response.data.items
      .filter(item => item.track && !item.track.is_local)
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
    console.error('Get admin playlist tracks error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch playlist tracks'
    });
  }
};

// Get admin's saved tracks (liked songs) with pagination
export const getSavedTracks = async (req, res) => {
  try {
    const session = await getAdminSession(req.userId);
    const accessToken = await getValidToken(session);

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
    console.error('Get admin saved tracks error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch saved tracks'
    });
  }
};
