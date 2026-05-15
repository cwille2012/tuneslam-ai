import dotenv from 'dotenv';
import path from 'path';

const NODE_ENV = process.env.NODE_ENV || 'development';

// Load env file based on NODE_ENV. Beanstalk/production typically injects vars
// directly so .env.production is just a template; we still try to load it.
//
// Both paths are resolved relative to __dirname (i.e. the compiled file's
// location) rather than process.cwd(), so it doesn't matter whether the
// service is launched from the repo root, `backend/`, or anywhere else.
// systemd's WorkingDirectory= for example is the repo root, so a bare
// `dotenv.config()` would look at `<repo>/.env` and miss the real file
// at `backend/.env` entirely. Don't go back to a cwd-relative path.
const envPath = path.resolve(__dirname, '..', '..', `.env.${NODE_ENV}`);
dotenv.config({ path: envPath });

// Also allow `backend/.env` to override (useful for local secrets you
// don't want in source-controlled .env.development / .env.production).
//
// `override: true` is critical: dotenv's default behavior is to skip
// any var that's already set in process.env, including ones we *just*
// loaded from .env.production with empty placeholders (e.g.
// `MONGO_URI=`). Without override, those empty strings would shadow
// the real values in `backend/.env` and the required() check below
// would fail. With override, `backend/.env` always wins, which matches
// the intent.
const secretsPath = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: secretsPath, override: true });



function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function csv(name: string): string[] {
  return optional(name)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  isDev: NODE_ENV !== 'production',
  PORT: parseInt(optional('PORT', '4000'), 10),
  // Default to loopback. The backend is fronted by Cloudflare Tunnel
  // in production (cloudflared connects out to Cloudflare and forwards
  // traffic to the local Node process), so the listener only needs to
  // be reachable from the same host. Defaulting to 127.0.0.1 means a
  // mis-configured deploy can't accidentally expose the API to the
  // public Internet — set HOST=0.0.0.0 explicitly if you really do
  // want a LAN-exposed listener.
  HOST: optional('HOST', '127.0.0.1'),


  MONGO_URI: required('MONGO_URI', 'mongodb://127.0.0.1:27017/tuneslam'),

  PUBLIC_API_BASE_URL: required('PUBLIC_API_BASE_URL', 'http://192.168.0.4:4000'),
  ADMIN_URL: required('ADMIN_URL', 'http://192.168.0.4:5173'),
  USER_URL: required('USER_URL', 'http://192.168.0.4:5174'),
  PLAYER_URL: required('PLAYER_URL', 'http://192.168.0.4:5175'),
  CORS_ORIGINS: csv('CORS_ORIGINS'),

  JWT_SECRET: required('JWT_SECRET', 'dev-secret-change-me'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  TOKEN_ENC_KEY: required(
    'TOKEN_ENC_KEY',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ),

  SPOTIFY_CLIENT_ID: optional('SPOTIFY_CLIENT_ID'),
  SPOTIFY_CLIENT_SECRET: optional('SPOTIFY_CLIENT_SECRET'),
  SPOTIFY_REDIRECT_URI: optional(
    'SPOTIFY_REDIRECT_URI',
    'http://192.168.0.4:4000/api/auth/spotify/callback',
  ),

  FACEBOOK_APP_ID: optional('FACEBOOK_APP_ID'),
  FACEBOOK_APP_SECRET: optional('FACEBOOK_APP_SECRET'),
  FACEBOOK_REDIRECT_URI: optional(
    'FACEBOOK_REDIRECT_URI',
    'http://192.168.0.4:4000/api/auth/facebook/callback',
  ),

  LOG_LEVEL: optional('LOG_LEVEL', NODE_ENV === 'production' ? 'info' : 'debug'),
};

export const spotifyConfigured = (): boolean =>
  Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);

export const facebookConfigured = (): boolean =>
  Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
