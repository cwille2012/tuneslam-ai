import dotenv from 'dotenv';
import path from 'path';

const NODE_ENV = process.env.NODE_ENV || 'development';

// Load env file based on NODE_ENV. Beanstalk/production typically injects vars
// directly so .env.production is just a template; we still try to load it.
const envPath = path.resolve(__dirname, '..', '..', `.env.${NODE_ENV}`);
dotenv.config({ path: envPath });
// Also allow a .env to override (useful for local secrets you don't want in
// source-controlled .env.development).
dotenv.config();

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
  HOST: optional('HOST', '0.0.0.0'),

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
