# TuneSlam AI

Collaborative, real-time, community-driven Spotify queues for venues, parties
and any space that wants the crowd to control the music.

This monorepo contains:

| Workspace                | Path                  | Description                                              |
| ------------------------ | --------------------- | -------------------------------------------------------- |
| `@tuneslam/shared`       | `shared/`             | Shared TypeScript types, slug helpers and constants.     |
| `backend`                | `backend/`            | Express + Mongoose + Socket.IO API + queue + autofill.   |
| `@tuneslam/admin`        | `frontends/admin/`    | Venue / admin dashboard (sessions, settings, history).   |
| `@tuneslam/user`         | `frontends/user/`     | Patron app (join `/<slug>`, search, add, vote).          |
| `@tuneslam/player`       | `frontends/player/`   | Spotify Web Playback player + crowd-facing now-playing.  |

## Local development (binds to `192.168.0.4`)

The dev environment is configured for an LAN IP of `192.168.0.4` so devices
on the same Wi-Fi (phones, tablets, smart-displays) can hit the backend and
all three frontends.

### Prereqs

* Node.js 20+
* MongoDB running locally (`mongodb://127.0.0.1:27017`)
* A Spotify Developer app
* A Facebook Developer app (optional — only required for FB login)

The Spotify app must whitelist `http://192.168.0.4:4000/api/auth/spotify/callback`.
The Facebook app must whitelist `http://192.168.0.4:4000/api/auth/facebook/callback`.

### One-time setup

```sh
npm install
cp backend/.env.development backend/.env   # optional, for local secret overrides
# edit backend/.env (or backend/.env.development) and fill in:
#   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
#   FACEBOOK_APP_ID, FACEBOOK_APP_SECRET (optional)
```

### Run everything

```sh
npm run dev
```

This starts:

* **Backend**  — http://192.168.0.4:4000
* **Admin**    — http://192.168.0.4:5173
* **User**     — http://192.168.0.4:5174
* **Player**   — http://192.168.0.4:5175

Open the admin app in a browser, register an admin, link Spotify, create a
session, then visit the **user** app at `/your-slug` from a phone on the
same Wi-Fi.

> If `192.168.0.4` is not your machine's LAN IP, change every occurrence in
> the env files (`backend/.env.development` and `frontends/*/.env.development`)
> as well as `vite.config.ts` ports if you need to.

## Production deployment

* **Backend** → AWS Elastic Beanstalk (Docker platform). See
  [`deploy/beanstalk/`](./deploy/beanstalk/).
* **Frontends** → Cloudflare Pages (one project per frontend). See
  [`deploy/cloudflare/README.md`](./deploy/cloudflare/README.md).

### Build everything locally

```sh
npm run build
```

### Deploy backend to Beanstalk

```sh
# from repo root, with the Dockerfile in deploy/beanstalk/Dockerfile.
# AWS EB CLI must be installed and configured.
eb init                       # one-time
cp deploy/beanstalk/Dockerfile .            # EB CLI uploads from cwd
cp deploy/beanstalk/Dockerrun.aws.json .
cp -r deploy/beanstalk/.ebextensions .
eb deploy
```

Set every required environment variable on the EB environment
(`MONGO_URI`, `JWT_SECRET`, `TOKEN_ENC_KEY`, `SPOTIFY_*`, etc).

### Deploy frontends to Cloudflare Pages

For each frontend, create a Cloudflare Pages project, set the build command
and output directory listed in `deploy/cloudflare/README.md`, set the
`VITE_*` environment variables for production, and bind a custom domain.

## Architecture notes

* **Sessions** are owned by a single admin and identified by a URL slug
  (e.g. `tuneslam.com/the-tap-room`).
* **Queue** is sorted by net votes; the **top item is locked** as soon as
  the now-playing song crosses 50% so people can't vote-bomb the next pick.
* **Autofill** keeps the queue alive when nobody is around: the admin
  configures a "fallback" Spotify playlist, and the backend pulls songs from
  it when the queue length drops below the configured threshold.
* **Stats** track how many songs each user has added/played and crowd
  approval (karma).
* **Realtime updates** travel over Socket.IO (`queue:update`,
  `nowPlaying:update`, `user:blocked`, `player:command`).
* **Spotify tokens** are encrypted at rest with `TOKEN_ENC_KEY`
  (AES-256-GCM, see `backend/src/utils/crypto.ts`).
* **Player tabs** identify themselves with a per-tab `instanceId`. Opening
  a new player tab steals the role from the previous one (the old tab is
  notified via heartbeat 409 and stops).
