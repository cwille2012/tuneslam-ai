// Use getter functions instead of direct object to avoid capturing undefined values at import time
export const spotifyConfig = {
  get clientId() {
    return process.env.SPOTIFY_CLIENT_ID;
  },
  get clientSecret() {
    return process.env.SPOTIFY_CLIENT_SECRET;
  },
  get redirectUri() {
    return process.env.SPOTIFY_REDIRECT_ADMIN_URI;
  },
  get scopes() {
    return [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'user-top-read',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private'
    ].join(' ');
  }
};

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
export const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';
