// Load environment variables FIRST before any other imports
import dotenv from 'dotenv-flow';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - dotenv-flow automatically loads the right file
// .env.development when NODE_ENV=development
// .env.production when NODE_ENV=production
// .env as fallback
dotenv.config({ path: __dirname + '/..' });

// Log Spotify config to verify it loaded (remove in production)
console.log('🔍 Spotify Config Check:', {
  hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
  hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
  hasAdminRedirectUri: !!process.env.SPOTIFY_REDIRECT_ADMIN_URI,
  hasUserRedirectUri: !!process.env.SPOTIFY_REDIRECT_USER_URI,
  adminRedirectUri: process.env.SPOTIFY_REDIRECT_ADMIN_URI,
  userRedirectUri: process.env.SPOTIFY_REDIRECT_USER_URI
});

// Log Facebook config to verify it loaded
console.log('🔍 Facebook Config Check:', {
  hasAppId: !!process.env.FACEBOOK_APP_ID,
  hasAppSecret: !!process.env.FACEBOOK_APP_SECRET,
  hasCallbackUrl: !!process.env.FACEBOOK_CALLBACK_URL,
  callbackUrl: process.env.FACEBOOK_CALLBACK_URL
});

// NOW import everything else
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { initializeSocket } from './config/socket.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import sessionRoutes from './routes/session.routes.js';
import queueRoutes from './routes/queue.routes.js';
import userRoutes from './routes/user.routes.js';
import spotifyRoutes from './routes/spotify.routes.js';
import userSpotifyRoutes from './routes/user-spotify.routes.js';
import adminSpotifyRoutes from './routes/admin-spotify.routes.js';

// Import services
import { startPlaybackMonitoring } from './services/playback.service.js';

// Import passport and initialization function
import passport, { initializePassport } from './config/passport.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());

// Parse comma-separated CORS origins
const allowedOrigins = [
  ...(process.env.ADMIN_URL?.split(',') || []),
  ...(process.env.USER_URL?.split(',') || []),
  ...(process.env.VIEWER_URL?.split(',') || [])
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions', queueRoutes);
app.use('/api/users', userRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/user/spotify', userSpotifyRoutes);
app.use('/api/admin/spotify', adminSpotifyRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Initialize connections and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ MongoDB connected');

    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected');

    // Initialize Socket.io
    initializeSocket(httpServer);
    console.log('✅ Socket.io initialized');

    // Initialize Passport strategies (after env vars are loaded)
    initializePassport();

    // Start playback monitoring
    startPlaybackMonitoring();
    console.log('✅ Playback monitoring started');

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV}`);
      console.log(`   API: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
