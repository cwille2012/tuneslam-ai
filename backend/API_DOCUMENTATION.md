# TuneSlam API Documentation

## Base URL
`http://localhost:5000/api`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "phoneNumber": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "user": { /* user object */ },
  "token": "jwt-token"
}
```

### Register Admin
**POST** `/auth/register/admin`

Register a new admin account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "phoneNumber": "string",
  "password": "string",
  "businessName": "string",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string"
  }
}
```

### Login
**POST** `/auth/login`

Login with email, username, or phone number.

**Request Body:**
```json
{
  "identifier": "string",
  "password": "string"
}
```

### Get Current User
**GET** `/auth/me`

Get currently authenticated user information.

### Update Profile
**PUT** `/auth/profile`

Update user profile (username only for regular users).

**Request Body:**
```json
{
  "username": "string"
}
```

### Update Admin Profile
**PUT** `/auth/admin/profile`

Update admin profile (admin only).

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "phoneNumber": "string",
  "businessName": "string",
  "address": { /* address object */ }
}
```

### Change Password
**PUT** `/auth/password`

Change user password.

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### OAuth Login - Facebook
**GET** `/auth/facebook?state=<redirect_url>`

Initiates Facebook OAuth login flow. Users are redirected to Facebook for authentication.

**Query Parameters:**
- `state` (optional): URL to redirect to after successful login

**Behavior:**
- Creates new user account if first time
- Links to existing account with matching email (non-admin only)
- Auto-populates profile with Facebook data

**Response:**
Redirects to `<USER_URL>/oauth-callback?token=<jwt>&redirect=<state>`

### OAuth Callback - Facebook
**GET** `/auth/facebook/callback`

Handles Facebook OAuth callback (automatic redirect from Facebook).

### OAuth Login - Spotify
**GET** `/auth/spotify?state=<redirect_url>`

Initiates Spotify OAuth login flow with automatic library linking. Users are redirected to Spotify for authentication.

**Query Parameters:**
- `state` (optional): URL to redirect to after successful login

**Scopes Requested:**
- `user-read-email` - Read user email
- `playlist-read-private` - Access private playlists
- `playlist-read-collaborative` - Access collaborative playlists  
- `user-library-read` - Access liked songs

**Behavior:**
- Creates new user account if first time
- Links to existing **non-admin** account with matching email
- **Blocks** linking to admin accounts (security feature)
- Automatically links Spotify library for browsing
- Stores access/refresh tokens for library access

**Response:**
Redirects to `<USER_URL>/oauth-callback?token=<jwt>&redirect=<state>`

### OAuth Callback - Spotify
**GET** `/auth/spotify/callback`

Handles Spotify OAuth callback (automatic redirect from Spotify).

---

## User Spotify Library Endpoints

### Link Spotify Library
**POST** `/user/spotify/link`

Manually link user's personal Spotify account for library browsing.

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.spotify.com/authorize?..."
}
```

User must visit the `authUrl` to authorize.

### Check Library Link Status
**GET** `/user/spotify/check`

Check if user has linked their Spotify library.

**Response:**
```json
{
  "success": true,
  "linked": true,
  "linkedAt": "2024-01-01T00:00:00.000Z",
  "spotifyUserId": "user123"
}
```

### Get User Playlists
**GET** `/user/spotify/playlists`

Get user's personal Spotify playlists (requires linked library).

**Response:**
```json
{
  "success": true,
  "playlists": [
    {
      "id": "playlist_id",
      "name": "My Playlist",
      "image": "https://...",
      "trackCount": 42
    }
  ]
}
```

### Get Playlist Tracks
**GET** `/user/spotify/playlists/:playlistId/tracks`

Get tracks from a specific user playlist.

**Response:**
```json
{
  "success": true,
  "tracks": [
    {
      "id": "track_id",
      "name": "Song Name",
      "artist": "Artist Name",
      "album": "Album Name",
      "duration": 240000,
      "image": "https://...",
      "uri": "spotify:track:..."
    }
  ]
}
```

### Get Liked Songs
**GET** `/user/spotify/liked-songs`

Get user's liked songs from Spotify (requires linked library).

**Response:**
```json
{
  "success": true,
  "tracks": [
    {
      "id": "track_id",
      "name": "Song Name",
      "artist": "Artist Name",
      "album": "Album Name",
      "duration": 240000,
      "image": "https://...",
      "uri": "spotify:track:..."
    }
  ]
}
```

### Unlink Spotify Library
**DELETE** `/user/spotify/unlink`

Unlink user's personal Spotify library.

**Response:**
```json
{
  "success": true,
  "message": "Spotify account unlinked successfully"
}
```

---

## Session Endpoints

### Create Session
**POST** `/sessions`

Create a new session (admin only).

**Request Body:**
```json
{
  "name": "session-name",
  "settings": {
    "downvoteThreshold": 3,
    "maxSongDuration": 420,
    "songsPerHourLimit": null
  }
}
```

### Get Session
**GET** `/sessions/:sessionName`

Get session details including QR code and current queue.

### Update Session
**PUT** `/sessions/:sessionName`

Update session settings (admin only).

### Toggle Session
**POST** `/sessions/:sessionName/toggle`

Enable/disable session (admin only).

### Delete Session
**DELETE** `/sessions/:sessionName`

Delete a session (admin only).

### Link Spotify
**POST** `/sessions/:sessionName/spotify`

Link Spotify account to session (admin only).

### Get Participants
**GET** `/sessions/:sessionName/participants`

Get list of session participants (admin only).

### Block User
**POST** `/sessions/:sessionName/participants/:userId/block`

Block a user from the session (admin only).

### Unblock User
**POST** `/sessions/:sessionName/participants/:userId/unblock`

Unblock a user from the session (admin only).

### Add to Blacklist
**POST** `/sessions/:sessionName/blacklist`

Add a song to the session blacklist (admin only).

**Request Body:**
```json
{
  "trackId": "spotify-track-id"
}
```

### Remove from Blacklist
**DELETE** `/sessions/:sessionName/blacklist/:trackId`

Remove a song from the blacklist (admin only).

---

## Queue Endpoints

### Get Queue
**GET** `/sessions/:sessionName/queue`

Get current queue for a session.

### Add Song
**POST** `/sessions/:sessionName/queue`

Add a song to the queue.

**Request Body:**
```json
{
  "trackData": {
    "spotifyTrackId": "string",
    "title": "string",
    "artist": "string",
    "album": "string",
    "duration": 180,
    "albumArt": "url"
  }
}
```

### Remove Song
**DELETE** `/sessions/:sessionName/queue/:songId`

Remove a song from the queue (admin only).

### Vote on Song
**POST** `/sessions/:sessionName/queue/:songId/vote`

Cast a vote on a song.

**Request Body:**
```json
{
  "voteType": "up" | "down"
}
```

### Get User Vote
**GET** `/sessions/:sessionName/queue/:songId/vote`

Get user's current vote for a song.

---

## Spotify Endpoints

### Get Auth URL
**GET** `/spotify/auth?sessionName=session-name`

Get Spotify OAuth URL (admin only).

### OAuth Callback
**GET** `/spotify/callback?code=xxx&state=xxx`

Spotify OAuth callback (handled automatically).

### Search Tracks
**GET** `/spotify/search/:sessionName?query=search-term&limit=20`

Search for tracks using session owner's Spotify account.

### Get User Playlists
**GET** `/spotify/playlists/:sessionName`

Get session owner's Spotify playlists (admin only).

### Get Genres
**GET** `/spotify/genres/:sessionName`

Get available Spotify genres (admin only).

---

## User Endpoints

### Get User Stats
**GET** `/users/me/stats`

Get current user's statistics.

### Get User Profile
**GET** `/users/:userId`

Get a user's public profile.

---

## WebSocket Events

### Client → Server
- `join-session` - Join a session room
- `leave-session` - Leave a session room

### Server → Client
- `song-added` - New song added to queue
- `song-removed` - Song removed from queue
- `votes-changed` - Vote count changed
- `queue-updated` - Queue reordered
- `session-status-changed` - Session enabled/disabled
- `user-blocked` - User has been blocked
- `user-unblocked` - User has been unblocked
- `session-updated` - Session settings updated
- `now-playing-updated` - Currently playing song changed
- `next-song-locked` - Next song locked for smooth transition

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "details": [] // Optional validation errors
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
