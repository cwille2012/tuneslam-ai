import axios from 'axios';
import { spotifyConfig, SPOTIFY_API_BASE, SPOTIFY_ACCOUNTS_BASE } from '../config/spotify.js';
import Session from '../models/Session.js';

export const getAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: spotifyConfig.clientId,
    response_type: 'code',
    redirect_uri: spotifyConfig.redirectUri,
    scope: spotifyConfig.scopes,
    state: state
  });
  
  return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
};

export const exchangeCodeForTokens = async (code) => {
  try {
    const response = await axios.post(
      `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: spotifyConfig.redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            `${spotifyConfig.clientId}:${spotifyConfig.clientSecret}`
          ).toString('base64')
        }
      }
    );
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Spotify');
  }
};

export const refreshAccessToken = async (refreshToken) => {
  try {
    const response = await axios.post(
      `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            `${spotifyConfig.clientId}:${spotifyConfig.clientSecret}`
          ).toString('base64')
        }
      }
    );
    
    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in
    };
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    throw new Error('Failed to refresh Spotify token');
  }
};

export const getValidAccessToken = async (sessionId) => {
  const session = await Session.findById(sessionId);
  
  if (!session || !session.spotifyRefreshToken) {
    throw new Error('Session not authenticated with Spotify');
  }
  
  // Check if token is expired or about to expire (within 5 minutes)
  const now = new Date();
  const expiryBuffer = new Date(now.getTime() + 5 * 60 * 1000);
  
  if (!session.spotifyTokenExpiry || session.spotifyTokenExpiry < expiryBuffer) {
    // Refresh token
    const { accessToken, expiresIn } = await refreshAccessToken(session.spotifyRefreshToken);
    
    session.spotifyAccessToken = accessToken;
    session.spotifyTokenExpiry = new Date(now.getTime() + expiresIn * 1000);
    await session.save();
    
    return accessToken;
  }
  
  return session.spotifyAccessToken;
};

export const searchTracks = async (sessionId, query, limit = 20) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/search`, {
      params: {
        q: query,
        type: 'track',
        limit: limit
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data.tracks.items.map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      duration: Math.floor(track.duration_ms / 1000),
      albumArt: track.album.images[0]?.url || '',
      uri: track.uri
    }));
  } catch (error) {
    console.error('Error searching tracks:', error.response?.data || error.message);
    throw new Error('Failed to search tracks');
  }
};

export const getUserPlaylists = async (sessionId) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/me/playlists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return response.data.items.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      trackCount: playlist.tracks.total,
      imageUrl: playlist.images[0]?.url || ''
    }));
  } catch (error) {
    console.error('Error fetching playlists:', error.response?.data || error.message);
    throw new Error('Failed to fetch playlists');
  }
};

export const createOrGetTuneslamPlaylist = async (sessionId) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    // Get user's playlists
    const playlistsResponse = await axios.get(`${SPOTIFY_API_BASE}/me/playlists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Check if TuneSlam playlist exists
    let tuneslamPlaylist = playlistsResponse.data.items.find(p => p.name === 'TuneSlam');
    
    if (!tuneslamPlaylist) {
      // Get user ID
      const userResponse = await axios.get(`${SPOTIFY_API_BASE}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      // Create new playlist
      const createResponse = await axios.post(
        `${SPOTIFY_API_BASE}/users/${userResponse.data.id}/playlists`,
        {
          name: 'TuneSlam',
          description: 'Collaborative queue managed by TuneSlam',
          public: true
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      tuneslamPlaylist = createResponse.data;
    }
    
    return tuneslamPlaylist.id;
  } catch (error) {
    console.error('Error creating/getting TuneSlam playlist:', error.response?.data || error.message);
    throw new Error('Failed to manage TuneSlam playlist');
  }
};

export const updatePlaylistTracks = async (sessionId, playlistId, trackUris) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    // Clear existing tracks
    await axios.put(
      `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
      { uris: [] },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Add new tracks (Spotify API limit is 100 tracks per request)
    if (trackUris.length > 0) {
      for (let i = 0; i < trackUris.length; i += 100) {
        const batch = trackUris.slice(i, i + 100);
        await axios.post(
          `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
          { uris: batch },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating playlist:', error.response?.data || error.message);
    throw new Error('Failed to update playlist');
  }
};

export const getCurrentlyPlaying = async (sessionId) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.data || !response.data.item) {
      return null;
    }
    
    return {
      trackId: response.data.item.id,
      progress: response.data.progress_ms,
      duration: response.data.item.duration_ms,
      isPlaying: response.data.is_playing
    };
  } catch (error) {
    if (error.response?.status === 204) {
      return null; // Nothing playing
    }
    console.error('Error getting currently playing:', error.response?.data || error.message);
    return null;
  }
};

export const getAvailableGenres = async (sessionId) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    const response = await axios.get(
      `${SPOTIFY_API_BASE}/recommendations/available-genre-seeds`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    return response.data.genres;
  } catch (error) {
    console.error('Error fetching genres:', error.response?.data || error.message);
    throw new Error('Failed to fetch genres');
  }
};

export const getTrackDetails = async (sessionId, trackId) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    const response = await axios.get(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const track = response.data;
    return {
      spotifyTrackId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      duration: Math.floor(track.duration_ms / 1000),
      albumArtUrl: track.album.images[0]?.url || '',
      uri: track.uri
    };
  } catch (error) {
    console.error('Error getting track details:', error.response?.data || error.message);
    return null;
  }
};

export const startPlayback = async (sessionId, playlistId) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    await axios.put(
      `${SPOTIFY_API_BASE}/me/player/play`,
      {
        context_uri: `spotify:playlist:${playlistId}`
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`Started playback for playlist: ${playlistId}`);
    return true;
  } catch (error) {
    console.error('Error starting playback:', error.response?.data || error.message);
    return false;
  }
};

export const getRecommendations = async (sessionId, seedTracks, limit = 5) => {
  const accessToken = await getValidAccessToken(sessionId);
  
  try {
    // Spotify requires 1-5 seed tracks
    const seeds = seedTracks.slice(0, 5).join(',');
    
    if (!seeds) {
      console.log('No seed tracks provided for recommendations');
      return [];
    }
    
    const response = await axios.get(`${SPOTIFY_API_BASE}/recommendations`, {
      params: {
        seed_tracks: seeds,
        limit: limit,
        market: 'US'  // Required market parameter
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log(`✅ Got ${response.data.tracks.length} recommendations from Spotify`);
    
    return response.data.tracks.map(track => ({
      spotifyTrackId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      duration: Math.floor(track.duration_ms / 1000),
      albumArt: track.album.images[0]?.url || '',
      uri: track.uri
    }));
  } catch (error) {
    console.error('Error getting recommendations:', error.response?.data || error.message);
    console.error('Seed tracks used:', seedTracks);
    return [];
  }
};
