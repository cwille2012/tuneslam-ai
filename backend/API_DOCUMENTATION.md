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
