# 🎵 TuneSlam - Collaborative/Community Driven Playlists

## Intended Use
TuneSlam is intended to be used by bars. A bar can display a TuneSlam window on a TV, then bar patrons can see what is currently playing and what is upcoming. Then, using a QR code on that TV the users can join that bars "queue" and add songs, upvote songs and downvote songs. Songs that get more upvotes will play sooner and songs that get downvotes will be moved down in the queue (and eventually removed if they fall below a threshold).
TuneSlam could also be used at parties or other enviornments. There could potentially be many sessions of TuneSlam going at once.
This is a real-time use app, when something happens it should be updated everywhere immediatley (when a user up-votes a song, vote counts across all devices should be updated).
TuneSlam is intended to be used with Spotify (it will not work without it).

## Code Stack
Tuneslam will use the following languages and databases. Use best coding practices modularity. React components should be used (each song in a list should be its own component, then the list itself should be a different component). Ensure that this app is secure and all endpoints are protected (especially ones that trigger external API calls).
- **Node.js**
- **TypeScript**
- **MongoDB**
- **Redis** (only if needed)
- **React**
- **Vite**
- **Express**
- **Socket.io**

## APIs
Note that for APIs in development Ngrok will be used for callbacks.
- **Spotify**
- **Facebook**

## Application Parts
TuneSlam will be made up of three different frontends and a single backend. There is a possibility that more frontends will be added later.

### Backend
The core of TuneSlam is the backend, this will most likley be deployed on AWS Beanstalk.

#### The Queue
##### Queue operation
Note: The queue can also be referred to as the session, the queue is the list of songs manipulated by users, the session is the queue plus the user data and settings associated with it.
The main job on the backend (besides auth/user management)is managing the queue. Each admin gets one queue that users can join and manipulate by adding songs, voting up songs or voting down songs. The queue should be stored somewhere, being retained until an admin resets the queue. The queue should not be stored inside session, queues should probably be their own collection so manipulation stays much cleaner.
Each song enters the queue with 0 votes, then users can add or subract a vote from each song (a song with 3 up-votes and one down-vote would show in the queue with 2 votes). Songs in the queue are ordered by votes and re-organized each time a song is added or a vote is applied. If a song goes below the admin set threshold votes (default is -3) it is removed from the queue (a song with one up-vote and 4 down-votes would be removed from the queue).
Users and admin cannot vote on their own songs. When a user (or admin) adds a song to the queue, they should see "your song" instead of the vote up/down buttons.
When a user (or admin) up-votes a song, the up-vote button on that song should remain in its "active" state so the user can see what they have voted on. If a user down-votes a song they have voted on it should cancel out their up-vote. Then the user could down-vote the same song again to down-vote it. The same logic applies in reverse to down-voting.
If two users vote on the same song at the same time, both votes are applied to the song.
Duplicate songs cannot be added to the queue, and if a song has been played in the same session it cannot be aded again.
The queue plays top down, as the top song plays it is removed from the queue (marked as now playing). Player logic is defined in the frontend.
Queue tie breaker: Songs next in the queue with the same net votes should play in the order that they were added to the queue.
##### Queue Auto-Fill
When the queue gets low (no users or admin have added songs in a while), the queue should be autmoatically filled in. The admin has a setting for the minimum number of songs that should be in the queue. As a song is played and removed from the queue, if the queue length is less than the admin minimum setting, another song should be added. The admin can choose from several auto-fill options:
1. Admin defined playlist. When this option is selected, a secondary dropdown appears for the admin to choose from one of their library playlists. This playlist will be used to seed the queue.
2. Related songs. Songs related to the queue history will be played.
3. Genre select. Admin can select a genre from a secondary dropdown that seeds the queue with popular songs from the selected genre.
4. More options to be determined.
Auto filled songs should be shown as added to the queue by user "Recommended" and auto-filled songs can still be voted on or removed/blocked by admin. If an auto-filled song is removed and no users/admin add a new song to the queue (and the queue is now shorter than the minimum threshold), the queue should be auto-filled with another song.

### Admin 
The admin dashboard is for the owner/creator of the queue/session (think bar managers or party hosts).

#### Functionality Needed
- [x] Admin registration with name, full address, phone number, email, business name (optional)
- [x] Login/logout
- [x] Change password, name, etc
- [x] Dashboard home page
- [x] Create new session (one session per admin)
- [x] Manage existing session
- [x] View and manage queue (can see what user added what song and Spotify popularity)
- [x] Add songs to a blacklist
- [x] Link Spotify (required before enabling session) (premium, premium family or business required)
- [x] Add Spotify songs to queue manually via search
- [x] Add songs from their linked Spotify library
- [x] Currently playing song
- [x] Player controls: Play/pause/skip current song (player described below)
- [x] Admin can add songs that would normally be blocked (popup confirming first if blocked)
- [x] Vote songs up or down in the queue (admin/users cannot vote on their own songs, one vote per song)
- [x] Remove songs from queue
- [x] View queue history
- [x] Reset queue (resets played songs and the queue)
- [x] Toggle session active/inactive (idea is when bar closes the session should be toggled to inactive)
- [x] User management page (view participants, block/unblock, show active/inactive users)
- [x] Session settings configuration
- [x] Account settings (edit profile, change password)
- [x] Open TV viewer in new window
- [x] Real-time updates
- [x] Desktop and mobile responsive

#### Admin Settings Needed
- [x] Popularity threshold (only songs above a certain Spotify rating can be added, default 0 no threshold)
- [x] Maximum song length that can be added
- [x] Lock-ahead song duration
- [x] Auto-fill options (when queue length is 0 how should it be filled)
- [x] Auto-fill minimum (minimum songs that can be in the queue, default 3)
- [x] Max songs a user can add per hour (default 0 no maximum, does not apply to admin)
- [x] Max votes a user can cast per hour (default 0 no maximum, does not apply to admin)
- [x] Downvote threshold (songs with x downvotes will be removed, default 3)
- [x] Allow removed songs to be re-added (default false)
- [x] Downvote Behavior

##### Auto Fill Options and Behavior
Add autofill options and behavior here

##### Downvote Behavior Options and Behavior
This dropdown affects the way the queue behaves with regard to downvotes from users and admin.
Note that these settings only affect the users/admin in the current session. Other sessions can have different downvote behavior.
Options:
1. Standard. This is the default option and the queue operates as described in this document.
2. No downvotes. This disables all downvoting and only allows users to upvote songs. The downvote option should be hidden and blocked in the backend.
3. Downvotes don't affect order. When this option is selected song downvotes do not show in the queue (only positive votes count towards the total vote count) but the downvote threshold is still in effect. If the song meets the downvote threshold it is removed from the queue.

Note for voting limits:
Counting policy: every successful press counts as 1 (whether it's a new vote, a flip, or a cancel). Matches "one tap = one use", and prevents the toggle-spam-to-cheat case.

### User
The user view is for users to join and interact with a queue. Note that users will be primarily using mobile devices. Users are not required to link Spotify, song search and playback will all be handled using the admins Spotify account. An account is required for all users.

#### Functionality Needed
- [x] User registration (username, email, phone)
- [x] Login/logout
- [x] Change password, username, etc (if not using Facebook or Spotify login)
- [x] Login with facebook (users only, not admin)
- [x] Login with Spotify (users only, not admin)
- [x] Link Spotify (if user creates account or uses facebook they should still be able to link Spotify to see their library)
- [x] Logging in with spotify automatically links spotify
- [x] View Spotify link status
- [x] Unlink spotify
- [x] Join sessions via URL
- [x] View live queue
- [x] See currently playing song
- [x] Search for songs to add to queue (uses admins Spotify API auth, Spotify API)
- [x] Add songs from their personal library (if they have linked spotify, Spotify API)
- [x] Vote on songs (upvote/downvote, cannot vote on own songs added, one vote per song)
- [x] Change or remove votes
- [x] Profile settings page
- [x] View karma and statistics (will elaborate below)
- [x] Spotify-styled dark theme
- [x] Mobile-first responsive design
- [x] Touch-optimized interface
- [x] Real-time queue updates
- [x] Blocked user handling (shows overlay if user is blocked)
- [x] Blocked user can no longer manipulate the queue (a user is blocked on a per session basis, they can still join other sessions that they are not blocked in)
- [x] Inactive session message (shows if the session they are in is disabled)

#### User Tracking
Keep track of the following information for each user (admin included). A user could interact with multiple sessions over time, eventually this data will be used to tailor suggestions to the user.
- [x] Songs added to queue
- [x] Songs they have upvoted
- [x] Songs thay have downvoted
- [x] Songs played (songs that user added to a queue that actually made it to the top and got played)
- [x] Karma (number of upvotes their songs have received minus number of downvotes they have received. Add one for each played song.)
- [x] Last login
- [x] Sessions joined

#### User Main Page
This is the main page users will be interacting with, most use will come from mobile devices.

##### Queue

##### Add Song

##### Activity
This is a popup that is shown when users click an "Activity" button. This button/popup should only be enabled if either songs per hour or votes per hour threshold is set by the admin for the session.
This popup shows the amount of songs/votes the user has remaining for the hour. A countdown clock is also shown counting down until the user will receive more songs/votes (only show the clock if the user has 0 songs or votes remaining). The clock for songs and votes should be synced.

#### User Profile Page
This page shows user settings as well as a list of sessions the user has joined.
This session list shows the users karma stats and ranking for each session when clicked.

### Player
This is what will be displayed on a central TV for everyone to see. This will also handle audio output using the Spotify Web Playback API.

#### Functionality Needed
- [x] Dark mode optimized for displays
- [x] Only admin can access
- [x] Only one player can be open per admin/session
- [x] Fullscreen interface
- [x] Display QR code
- [x] Display session URL
- [x] Now playing section (left side)
- [x] Large album art display
- [x] Song title and artist
- [x] Progress bar for current song
- [x] Time display (current/total)
- [x] Queue list (right side)
- [x] Queue position numbers
- [x] Album art thumbnails
- [x] Song details (title, artist, duration)
- [x] Vote counts display
- [x] Real-time synchronization
- [x] Inactive session message
- [x] Scrolling ticker showing user interactions
- [x] Karma leaderboard

#### Spotify Web Playback API
The queue will be played by the Spotify Web Playback API. When the player is open (and the admin has hit play) the number one song in the queue should be played and moved to now playing (when this song moves to the now playing section it shopuld be removed from the queue and the number two song advances to the number one spot). As the number one song finishes, use the lock-ahead duration in admin settings to "lock" the next song. When the current song has less than the lock-ahead duration remaining, the next song should be "locked" in the queue so that even if a song below it is up-voted it no longer takes the place of the next up song. The Spotify Web Playback API should play that locked song next. That song should be removed from the queue and added to now playing and this process repeats. Once the current track reaches 50% progress, it should be marked as played. If playback is paused, closed, or restarted after that point, the song should not return to the queue.

#### Other Player Notes
If the player is closed the queue should be immediatley paused. If a player becomes de-authenticated the queue shoud be paused. If a new player is opened, the admin should be alerted and asked if they wish to transfer playback to the new player (only one player at a time per admin). An admin opening the player from their dashboard should be automatically authenticated, however an admin navigating to the player url (player.tuneslam.com/session-same) should be prompted to login.

#### Karma Leaderboard
This section should take over the queue with a nice transition (same size and same place as queue, rotates in). This should display for 5 seconds every at the start of each song then rotate out. The leaderboard should only include people from the session attached to the player.

### URLs
Users should be able to join a queue simply by navigating to the queue URL. The queue url should be simple for users (tuneslam.com/session-name-here), which means session names need to be URL safe and unique. Session names also cannot be common route names (api, admin, about, settings, dashboard... etc). Even if a route is not used now it could be used later, so a blacklist for session names should be implemented in the code that can be easily added to.
Backend code should be on its own port for development, and will be on its own URL for deployent (api.tuneslam.com).
See local vs deployment for other URL notes.

## Technical Requirements
- [x] Modular code structure
- [x] React components for reusability
- [x] Separate folders for each interface
- [x] API keys in .env file
- [x] .gitignore configured
- [x] Good coding practices

## Local vs Deployed
This will be tested locally then deployed periodically. Use .env.development and .env.production to separate variables (also create .env.example). When running locally this will use a locally hosted MongoDB and Redis (if needed), when deployed these databases will be in the cloud.
Front end services will be deployed on CloudFlare pages using Wrangler:
admin - admin.tuneslam.com (Cloudflare page name = "admin")
user - tuneslam.com (Cloudflare page name = "user")
player - player.tuneslam.com (Cloudflare page name = "player")
Backend will be deployed using AWS Elastic Beanstalk:
backend - api.tuneslam.com
When running locally these should each be on a different port.


# Implementation Plan


# TuneSlam Implementation Plan

## 1. Repository layout (npm workspaces monorepo)

```
tuneslam-ai/
├── backend/                    # Express + Socket.io + Mongoose API (port 4000)
├── frontends/
│   ├── admin/                  # Vite/React (port 5173)  → admin.tuneslam.com
│   ├── user/                   # Vite/React (port 5174)  → tuneslam.com
│   └── player/                 # Vite/React (port 5175)  → player.tuneslam.com
├── shared/                     # Types, reserved-route list, small utils
├── docker-compose.yml          # Mongo + Redis for local dev
├── .env.example                # Top-level reference of all env vars
├── package.json                # workspaces + concurrent scripts
├── README.md                   # local + deploy instructions
└── deploy/
    ├── beanstalk/              # Dockerrun.aws.json + .ebextensions
    └── cloudflare/             # wrangler.toml per frontend
```

A single root `npm run dev` will start Mongo/Redis (docker), backend, and all three frontends bound to `0.0.0.0` so they're reachable on `http://192.168.0.4:<port>`.

## 2. Backend (Node 20 + TypeScript + Express + Socket.io)

**Stack:** Express, Socket.io, Mongoose, Zod, JWT (bearer tokens, no cookies → trivially works across subdomains/ports), bcrypt, helmet, cors, express-rate-limit, axios, qrcode (server-side optional), passport-facebook + custom Spotify OAuth client.

**Models**
- `Admin` – email, passwordHash, name, address, phone, businessName, spotify tokens (encrypted)
- `User` – username, email, phone, passwordHash?, facebookId?, spotifyId?, spotify tokens?, karma counters, lastLogin, sessionsJoined[]
- `Session` – slug (URL-safe, unique, validated against reserved list), adminId, active, currentTrack, lockedNextTrackId, settings (popularityThreshold, maxSongLengthMs, lockAheadSec, autofillMode + payload, autofillMin, maxSongsPerHourPerUser, downvoteThreshold, allowReadd), blockedUserIds[]
- `QueueItem` – sessionId, track snapshot (id, name, artists, durationMs, popularity, art), addedBy (userId or `"recommended"`), votes Map<userId, +1|-1>, netVotes, locked, addedAt
- `PlayedSong` – sessionId, trackId, addedByUserId, playedAt
- `BlacklistedTrack` – adminId, trackId

**Route groups (all protected with appropriate middleware)**
- `/api/auth/admin/{register, login, me}`
- `/api/auth/user/{register, login, me}`, `/api/auth/facebook/...`, `/api/auth/spotify/{link,callback,unlink}` (works for both)
- `/api/admin/account`, `/sessions`, `/sessions/:id/{settings, queue, queue/vote, queue/:itemId, blacklist, participants, history, reset, active, player/{play,pause,skip}}`, `/spotify/{search,playlists,genres}`
- Public-ish session: `/api/sessions/:slug`, `/queue`, `/queue/add`, `/queue/vote`, `/spotify/search` (uses admin's token), `/spotify/library` (uses user's own token if linked)
- `/api/user/stats`
- `/api/player/sessions/:slug/state`, `/api/player/spotify/playback-token`
- `/api/health`

**Realtime (Socket.io):** rooms per session slug. JWT auth on connect. Events:
`queue:update`, `nowplaying:update`, `session:active`, `user:blocked`, `player:command`, `player:claim` (handles "another player opened, transfer?"), `autofill:added`.

**Queue service (pure functions, well-unit-testable):**
addSong (dedupe vs queue + played list, popularity/length/blacklist/per-user-rate checks), castVote (toggle/cancel/flip rules from spec), recomputeOrder (net votes desc, addedAt asc; locked item pinned to position 1), pruneByDownvoteThreshold, autofill (playlist | related | genre), lockNextIfNeeded (when current progress within `lockAheadSec`), markPlayed (≥50%), advance.

**Spotify service:** auth code + refresh handling, encrypted token storage (AES from `TOKEN_ENC_KEY`), search/playlists/recommendations/genre-seeds wrappers, Web-Playback access-token endpoint for player.

**Security:** helmet, CORS allowlist from env, rate-limit on auth and any route that calls Spotify, zod validation on every body/param, role middleware (`requireAdmin`, `requireUser`, `requireSessionMember`, `notBlocked`), reserved-route check on session slug creation.

## 3. Frontends (React 18 + Vite + TS + Tailwind)

Each app has its own router, axios client with bearer-token interceptor, `useSocket` hook scoped to a session, and a small shared theme (Spotify-dark for user/player; clean dark for admin).

**Admin** (`frontends/admin`)
- Pages: Login, Register, Dashboard, Session (Queue, Now Playing, Search, Library), Blacklist, Participants, History, Settings, Account, Spotify-Callback
- Components: `QueueList`, `QueueItem`, `NowPlaying`, `PlayerControls`, `SongSearchBox`, `LibraryPicker`, `BlacklistTable`, `ParticipantRow`, `SettingsForm`, `OpenPlayerButton` (opens player URL in new window with one-time token)
- Reusable hooks: `useAuth`, `useSession`, `useQueue`, `useSocket`

**User** (`frontends/user`)
- Mobile-first, dark
- Pages: Landing/Login, Register, Facebook-Callback, Spotify-Callback, Profile, Stats, `/:slug` (Queue + NowPlaying + Search + LibraryIfLinked), Blocked overlay, Inactive-session screen
- Joining a queue is just navigating to `/:slug` (auth-gated; redirect to login then back)

**Player** (`frontends/player`)
- Pages: Login (admin), `/:slug`
- Fullscreen layout: left = album art / title / artist / progress / time; right = queue list with thumbnails, vote counts, position numbers; bottom-right = QR code + session URL
- Spotify Web Playback SDK; obtains token from backend; emits progress to server; receives `player:command`
- Hard rule: only one active player per admin → claim/transfer flow

## 4. Auth model that works across subdomains AND across local ports
JWT bearer tokens in `localStorage` (per-app). `Authorization: Bearer <jwt>` on REST and `auth: { token }` on socket connect. Avoids the cookie-domain headaches between `localhost:5173` and `192.168.0.4:5174`, and works as-is across `*.tuneslam.com`.

## 5. Local dev on 192.168.0.4
- `docker-compose.yml` exposes Mongo `27017` and Redis `6379` on the host
- All Vite servers configured with `server.host = '0.0.0.0'` and explicit ports (5173/5174/5175)
- `.env.development`:
  - `API_BASE_URL=http://192.168.0.4:4000`
  - `ADMIN_URL=http://192.168.0.4:5173`, `USER_URL=http://192.168.0.4:5174`, `PLAYER_URL=http://192.168.0.4:5175`
  - `CORS_ORIGINS=` the three URLs above
  - `SPOTIFY_REDIRECT_URI` defaults to the Ngrok URL placeholder; you fill it in
- Root `npm run dev` uses `concurrently` to run all four
- `npm run dev:db` brings up docker-compose

## 6. Deployment artifacts
- **Backend → Elastic Beanstalk:** `Dockerfile` (multi-stage), `Dockerrun.aws.json`, `.ebextensions/01-env.config`, GitHub Actions workflow stub `deploy-backend.yml`
- **Frontends → Cloudflare Pages:** `wrangler.toml` per app (project names `admin`, `user`, `player`), `_redirects` for SPA fallback, build command `npm run build`, output `dist`
- `.env.production` per frontend points at `https://api.tuneslam.com`

## 7. Explicitly out of scope (per doc's Future Development)
Crossfade, ticker, rolling passcode, location-based access, developer dashboard, Spotify rolling rate limit, autofill algorithm switching, "skip voting for admin-added", disable downvotes toggle.

## 8. What I'll deliver in Act mode (in this order)
1. Workspace skeleton + tooling + `docker-compose.yml` + env files + README
2. Backend: config, models, auth, sessions/queue, Spotify, sockets, blacklist, history, settings, player, autofill
3. Shared types package
4. Admin frontend (full)
5. User frontend (full)
6. Player frontend (full + Web Playback SDK)
7. Deployment configs (Beanstalk + Wrangler + GH Actions)
8. README with local-on-192.168.0.4 + deploy steps

A few quick assumptions I'll make unless you object — please confirm or override:
- **Auth tokens:** JWT bearer in `localStorage` (works across ports & subdomains; simpler than shared-cookie domain).
- **Admin & User are separate Mongo collections** with their own JWT audiences (`adm` vs `usr`). The spec separates registration flows and Facebook/Spotify-only login is users-only, which strongly suggests this.
- **Spotify integration:** Auth-Code-with-PKCE for users, classic Auth-Code (with refresh) for admins; tokens encrypted at rest with `TOKEN_ENC_KEY` env var.
- **Session slugs:** lowercase URL-safe (`[a-z0-9-]{3,40}`), checked against an extensible reserved list (`api`, `admin`, `about`, `settings`, `dashboard`, `login`, `register`, `player`, `developer`, `auth`, `account`, `assets`, `static`, `health`, etc.).
- **Real-time transport:** Socket.io with JWT auth on handshake; one room per session slug.
- **Styling:** Tailwind in all three frontends with a shared dark palette (Spotify-style for user/player).
- **Tests:** I'll add a small Jest suite for the queue service (the trickiest logic) but won't aim for full coverage.


Got it — dropping Docker entirely. Updated plan:

## Changes from previous plan
- ❌ No `docker-compose.yml`, no Dockerfile for local dev
- ✅ Backend just connects to local Mongo/Redis directly via env vars:
  - `MONGO_URI=mongodb://127.0.0.1:27017/tuneslam`
  - `REDIS_URL=redis://127.0.0.1:6379` (only if I end up needing Redis — see below)
- ✅ Root `npm run dev` runs `concurrently` for backend + 3 frontends only
- ✅ README: "Prerequisites: Node 20, MongoDB running on 27017, Redis running on 6379" instead of docker steps

## Do we actually need Redis?
The spec says **"only if needed"**. Looking at the requirements:
- Realtime fan-out: Socket.io alone handles this fine within a single backend process. Redis adapter only matters if we scale the backend horizontally — not needed for now.
- Queue state: lives in MongoDB (it must be persistent until admin reset).
- Rate limiting: `express-rate-limit` defaults to in-memory, which is fine for a single-instance backend.
- Sessions/JWT: stateless bearer tokens, no Redis needed.

**My recommendation: skip Redis entirely for now.** I'll keep `REDIS_URL` plumbed through env (commented out in `.env.example`) so it's trivial to bolt on later — for instance if we deploy multiple Beanstalk instances and need the Socket.io Redis adapter. If you'd rather I wire it in now (e.g. for shared rate limiting or socket adapter from day one), I can.

## For deployment (Beanstalk)
Backend deploy still uses a `Dockerfile` (Beanstalk's Docker platform is the cleanest path). That's only used during deployment, not locally. If you'd prefer the Node.js Beanstalk platform with a `Procfile` instead, I can do that — but Docker on Beanstalk gives you reproducible builds and is no harder to set up.

Everything else from the previous plan stands:
- Monorepo (npm workspaces): `backend/`, `frontends/admin|user|player/`, `shared/`
- Backend: Express + TS + Socket.io + Mongoose + JWT (bearer in `localStorage`) + Zod
- Three Vite/React/TS/Tailwind frontends, each bound to `0.0.0.0` with explicit ports (5173/5174/5175); backend on 4000, all reachable at `192.168.0.4:<port>`
- Spotify (auth-code w/ refresh for admin, PKCE for users) + Facebook OAuth for users
- Reserved-route blacklist for session slugs
- `.env.development` / `.env.production` / `.env.example`
- Cloudflare Pages `wrangler.toml` per frontend, Beanstalk Docker config for backend
- Out of scope: everything under "Future Development"

## Two quick decisions I need from you
1. **Redis: skip for now (recommended)** or **wire it in now** for socket adapter / rate limit?
2. **Beanstalk: Docker platform (recommended)** or **Node.js platform with Procfile**?

If you're happy with the recommended defaults (skip Redis, Docker on Beanstalk), just **toggle to Act mode** and I'll start building.

Skip Redis and use Docker on Beanstalk


Implemented the full TuneSlam AI plan (everything in `WEBAPP_SUMMARY.md` outside the future-development section). The monorepo now contains:

- **`shared/`** – TypeScript types, slug helpers, reserved-word list, constants.
- **`backend/`** – Express + Mongoose + Socket.IO API with JWT auth (admin & user), Spotify OAuth + token encryption, Facebook OAuth, full session/queue/voting service, vote-locking, half-played play-tracking, autofill from a fallback playlist, player heartbeat/replacement, blacklist, history, stats, and rate-limited auth endpoints.
- **`frontends/admin/`** – Login, register, dashboard (create/manage sessions, copy join URL, open player), settings, blacklist, history, participants, account, Spotify-link callback.
- **`frontends/user/`** – Landing (slug lookup), register, login (incl. Facebook), account + stats, and the live `/<slug>` session view (now-playing with progress, voted/locked queue, Spotify search, real-time updates over Socket.IO).
- **`frontends/player/`** – Spotify Web Playback SDK player with token capture from query string, claim/heartbeat/replacement logic, server-side progress sync, end-of-track advance, queue-side panel and a QR code / URL for joining the session.
- **`deploy/beanstalk/`** – Multi-stage Dockerfile for the API, `Dockerrun.aws.json` and `.ebextensions/01-env.config` for AWS Elastic Beanstalk.
- **`deploy/cloudflare/`** – Per-frontend build / output / env-var instructions for Cloudflare Pages.
- **`README.md`** – Local-dev (`192.168.0.4`) instructions, build, and deploy instructions.

Local dev is wired to `192.168.0.4`: backend on `:4000`, admin `:5173`, user `:5174`, player `:5175` (all bound to `0.0.0.0`, env files preconfigured). The full monorepo builds cleanly (`npm run build`).

Before running locally, fill in `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` (and optional Facebook creds) in `backend/.env.development`, ensure MongoDB is running, then `npm install && npm run dev`.




# Notes

To kill running app if it becomes separated:
sudo fuser -k 4000/tcp 5173/tcp 5174/tcp 5175/tcp

Needed for spotify player in Chrome:
--unsafely-treat-insecure-origin-as-secure=<player base url here>


To build each frontend and put in dist (run from /tuneslam-ai$):
(Builds use .env.production in each folder, they must all match)
npm ci && npm --workspace shared run build && npm --workspace @tuneslam/admin run build
npm ci && npm --workspace shared run build && npm --workspace @tuneslam/user run build
npm ci && npm --workspace shared run build && npm --workspace @tuneslam/player run build

wrangler login (only needed on first deploy, different command needed for headless)

wrangler pages deploy frontends/admin/dist  --project-name=admin  --branch=main
wrangler pages deploy frontends/user/dist   --project-name=user   --branch=main
wrangler pages deploy frontends/player/dist --project-name=player --branch=main

Note:
After the first deploy: Open the Cloudflare dashboard → Pages → `player` → __Custom domains__ and bind `player.tuneslam.com` (DNS records auto-create if `tuneslam.com` is on your Cloudflare account).

Note:
The frontends will fail until the backend (API) is up at `api.tuneslam.com` and its `CORS_ORIGINS` includes all three frontend origins. The backend itself is __not__ deployed to Cloudflare Pages — it goes to AWS Elastic Beanstalk (`deploy/beanstalk/`). Cloudflare proxies `api.tuneslam.com` (orange-cloud) to the Beanstalk URL via a CNAME. WebSockets work through the orange-cloud by default.


Backend building for running locally (Cloudflare tunnel):

Build:
npm ci
npm --workspace shared run build
npm --workspace backend run build

Run:
NODE_ENV=production npm --workspace backend run start
Or as a service:
sudo systemctl start tuneslam-backend
sudo systemctl restart tuneslam-backend

Also need running:
cloudflared tunnel run tuneslam-api-tunnel
Or as service:
sudo systemctl start cloudflared

Cloudflare tunnel logs (for when it is a service):
sudo journalctl -u cloudflared -f


Remove create account gate:
grep -rn "assertInviteAllowed\|utils/invite" backend/src