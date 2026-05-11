# Cloudflare Pages Deployment

Each of the three frontends (`admin`, `user`, `player`) is deployed as a
separate Cloudflare Pages project so they can each get their own custom
domain. They all read from `frontends/<name>/.env.production` at build time.

## Per-project settings

| Project name        | Repo path              | Build command                                                            | Output dir | Environment vars (production)                                                                                                                  |
| ------------------- | ---------------------- | ------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `tuneslam-admin`    | `/`                    | `npm ci && npm --workspace shared run build && npm --workspace @tuneslam/admin run build`  | `frontends/admin/dist`  | `VITE_API_BASE_URL`, `VITE_ADMIN_URL`, `VITE_USER_URL`, `VITE_PLAYER_URL` |
| `tuneslam-user`     | `/`                    | `npm ci && npm --workspace shared run build && npm --workspace @tuneslam/user run build`   | `frontends/user/dist`   | same as above                                                              |
| `tuneslam-player`   | `/`                    | `npm ci && npm --workspace shared run build && npm --workspace @tuneslam/player run build` | `frontends/player/dist` | same as above                                                              |

(Cloudflare Pages does not understand npm workspaces by itself, so we run
`npm ci` from the repo root and then build the relevant workspace.)

## SPA redirect rule

Each frontend ships a `public/_redirects` file containing:

```
/* /index.html 200
```

That makes Cloudflare Pages serve `index.html` for any unknown route, which
is needed because the user app uses dynamic `/<slug>` routes.

## Custom domains

Suggested mapping:

* `admin.tuneslam.com` → `tuneslam-admin`
* `tuneslam.com` (apex) and `www.tuneslam.com` → `tuneslam-user`
* `player.tuneslam.com` → `tuneslam-player`

Bind these in the Pages dashboard. CORS_ORIGINS on the backend must list
all three.

## Backend (api.tuneslam.com)

The backend is **not** deployed to Cloudflare Pages — it runs on AWS
Elastic Beanstalk (see `deploy/beanstalk/`). Point an `api` CNAME (proxied
through Cloudflare) at the Beanstalk environment URL.

Make sure WebSockets are enabled in the Cloudflare proxy (they are by
default on the orange-cloud).
