# TuneSlam Web Player - Remaining Implementation

## ✅ Completed

### Frontend Player App
- [x] Created `frontend/player/` directory structure
- [x] Package.json, vite.config.js, wrangler.toml
- [x] React app structure (App.jsx, main.jsx)
- [x] Styling (index.css, App.css)
- [x] API service with player endpoints
- [x] useSocket hook
- [x] **useSpotifyPlayer hook** (Spotify Web Playback SDK integration)
- [x] NowPlaying component
- [x] QueueList component
- [x] **PlayerPage** (main player logic)

### Backend
- [x] User model updated with `spotifyPremium` and `spotifyAccountType` fields

---

## 🚧 TODO: Backend Implementation

### 1. Update Session Model
**File:** `backend/src/models/Session.js`

Add player tracking:
```javascript
activePlayerId: {
  type: String,
  default: null
},
playerConnected: {
  type: Boolean,
  default: false
},
playerDeviceId: {
  type: String,
  default: null
}
```

### 2. Create Player Routes
**File:** `backend/src/routes/player.routes.js`

```javascript
import express from 'express';
import { authenticateAdmin } from '../middleware/auth.middleware.js';
import * as playerController from '../controllers/player.controller.js';

const router = express.Router();

// Get Spotify token for player
router.get('/:sessionName/player-token', authenticateAdmin, playerController.getPlayerToken);

// Register/unregister player
router.post('/:sessionName/register-player', authenticateAdmin, playerController.registerPlayer);
router.delete('/:sessionName/register-player', authenticateAdmin, playerController.unregisterPlayer);

// Playback controls (from admin dashboard)
router.post('/:sessionName/playback/play', authenticateAdmin, playerController.playControl);
router.post('/:sessionName/playback/pause', authenticateAdmin, playerController.pauseControl);
router.post('/:sessionName/playback/skip', authenticateAdmin, playerController.skipControl);

export default router;
```

### 3. Create Player Controller
**File:** `backend/src/controllers/player.controller.js`

Key functions needed:
- `getPlayerToken()` - Returns admin's Spotify access token
- `registerPlayer()` - Marks session as having active player
- `unregisterPlayer()` - Clears active player
- `playControl()` - Sends play command via socket
- `pauseControl()` - Sends pause command via socket
- `skipControl()` - Moves to next song

### 4. Update Spotify Controller
**File:** `backend/src/controllers/admin-spotify.controller.js`

In the callback after linking Spotify, check Premium status:

```javascript
// Get user profile to check Premium
const profileResponse = await axios.get('https://api.spotify.com/v1/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

const profile = profileResponse.data;

// Update user with Premium status
user.spotifyPremium = profile.product === 'premium' || profile.product === 'business';
user.spotifyAccountType = profile.product || 'free';
```

### 5. Update Socket Events
**File:** `backend/src/config/socket.js`

Add new events:
```javascript
// Player events
socket.on('player-connected', (data) => {
  // Mark session as having active player
  // Broadcast to admin dashboard
});

socket.on('player-disconnected', () => {
  // Clear active player from session
  // Revert to external device
});

socket.on('playback-state-changed', (data) => {
  // Broadcast player state to admin dashboard  
  // Update viewer if paused
});

socket.on('player-skip-requested', () => {
  // Move to next song
});

socket.on('player-song-ended', () => {
  // Auto-advance to next song
});
```

### 6. Add Player Token Generation
**File:** `backend/src/services/auth.service.js`

```javascript
export const generatePlayerToken = (userId, sessionId) => {
  return jwt.sign(
    { userId, sessionId, type: 'player' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' } // Player sessions last longer
  );
};
```

### 7. Register Player Routes
**File:** `backend/src/server.js`

```javascript
import playerRoutes from './routes/player.routes.js';

app.use('/api/sessions', playerRoutes);
```

---

## 🚧 TODO: Frontend Integration

### 1. Update Admin Dashboard - Add Player Button
**File:** `frontend/admin/src/pages/ManageSession.jsx`

Add to the top of the page:

```jsx
const handleOpenPlayer = () => {
  // Generate temporary token
  const playerUrl = `${window.location.protocol}//player.${window.location.host}/session/${sessionName}?token=${playerToken}`;
  window.open(playerUrl, '_blank', 'width=1200,height=800');
};

// In render:
<button onClick={handleOpenPlayer} className="btn-primary">
  🎵 Open Web Player
</button>

{session?.playerConnected && (
  <div className="player-status">
    ✅ Web Player Active
  </div>
)}
```

### 2. Add Playback Controls to Admin Dashboard
**File:** `frontend/admin/src/pages/ManageSession.jsx`

```jsx
const handlePlay = async () => {
  await fetch(`/api/sessions/${sessionName}/playback/play`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};

const handlePause = async () => {
  await fetch(`/api/sessions/${sessionName}/playback/pause`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};

const handleSkip = async () => {
  await fetch(`/api/sessions/${sessionName}/playback/skip`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
};

// In render:
<div className="playback-controls">
  <button onClick={handlePlay}>▶️ Play</button>
  <button onClick={handlePause}>⏸️ Pause</button>
  <button onClick={handleSkip}>⏭️ Skip</button>
</div>
```

### 3. Update Viewer - Show Pause Status
**File:** `frontend/viewer/src/pages/TVDisplay.jsx`

Add state for player status:
```jsx
const [playerPaused, setPlayerPaused] = useState(false);

// In socket handlers:
socket.on('playback-state-changed', (data) => {
  setPlayerPaused(data.isPaused);
});

// In NowPlaying component:
{playerPaused && currentlyPlaying && (
  <div className="pause-overlay">
    ⏸️ Music Paused
  </div>
)}
```

---

## 🚧 TODO: Installation & Testing

### 1. Install Player Dependencies
```bash
cd frontend/player
npm install
```

### 2. Create Environment Files
```bash
# frontend/player/.env.development
echo "VITE_API_URL=http://192.168.0.4:5000" > .env.development

# frontend/player/.env.production
echo "VITE_API_URL=https://api.tuneslam.com" > .env.production
```

### 3. Test Locally
```bash
# Start player
cd frontend/player
npm run dev
# Access: http://localhost:5176/session/testsession
```

### 4. Build and Deploy
```bash
# Build
cd frontend/player
npm run build

# Deploy to Cloudflare
npm run deploy
```

---

## 📋 Integration Checklist

### Backend
- [ ] Update Session model with player fields
- [ ] Create player.routes.js
- [ ] Create player.controller.js
- [ ] Update admin-spotify.controller.js (Premium check)
- [ ] Update socket.js (player events)
- [ ] Add player token generation
- [ ] Register player routes in server.js

### Frontend - Player
- [ ] Install npm dependencies
- [ ] Create .env.development
- [ ] Create .env.production
- [ ] Test locally

### Frontend - Admin Dashboard
- [ ] Add "Open Player" button
- [ ] Add playback controls (play/pause/skip)
- [ ] Show player connection status
- [ ] Show Premium status on account page

### Frontend - Viewer
- [ ] Add pause overlay for player
- [ ] Listen to playback-state-changed event

### Deployment
- [ ] Build player frontend
- [ ] Deploy to Cloudflare Pages (player.tuneslam.com)
- [ ] Update BUILD.md with player instructions
- [ ] Test end-to-end

---

## 🎯 Key Features Summary

### Player Functionality
- ✅ Spotify Web Playback SDK integration
- ✅ Auto-login from admin dashboard
- ✅ Queue sync via Socket.io
- ✅ Premium requirement check
- ✅ One player per session
- ✅ Closes = immediate stop

### Admin Controls
- Play/Pause/Skip from dashboard
- Player status indicator
- One-click player opening

### Automatic Playback
- Player plays songs from queue
- Auto-advances on song end
- Falls back to external device if player closed

---

## 📝 Notes

### Spotify API Considerations
- Web Playback SDK requires **Spotify Premium or Business**
- Access token must be from the ADMIN's Spotify account
- Player creates a "TuneSlam Web Player" device in Spotify

### Security
- Player tokens are short-lived (24h)
- Token passed via URL parameter, then stored in localStorage
- Only admin can open player for their sessions

### Browser Compatibility
- Requires modern browsers (Chrome, Firefox, Edge, Safari)
- Web Playback SDK may not work on mobile browsers (iOS Safari limited)
- Best used on desktop/laptop

---

## 🚀 Deployment URLs

- **Admin:** admin.tuneslam.com
- **User:** tuneslam.com
- **Viewer:** viewer.tuneslam.com
- **Player:** player.tuneslam.com ← NEW!
- **API:** api.tuneslam.com (AWS)

---

**Status:** Frontend complete, backend implementation needed.
**Estimated completion time:** 2-3 hours for backend + integration
