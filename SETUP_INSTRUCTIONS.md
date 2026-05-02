# TuneSlam Setup Instructions

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (running locally or MongoDB Atlas account) - [Download](https://www.mongodb.com/try/download/community)
- **Redis** (running locally or Redis Cloud account) - [Download](https://redis.io/download)
- **Spotify Developer Account** - [Sign up](https://developer.spotify.com/)

## Step 1: MongoDB Setup

### Option A: Local MongoDB
1. Install MongoDB Community Edition
2. Start MongoDB service:
   ```bash
   # On Linux
   sudo systemctl start mongod
   
   # On macOS (using Homebrew)
   brew services start mongodb-community
   
   # On Windows
   net start MongoDB
   ```

### Option B: MongoDB Atlas (Cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Get your connection string

## Step 2: Redis Setup

### Option A: Local Redis
```bash
# On Linux
sudo apt-get install redis-server
sudo systemctl start redis

# On macOS (using Homebrew)
brew install redis
brew services start redis

# On Windows
# Download Redis from https://github.com/microsoftarchive/redis/releases
```

### Option B: Redis Cloud
1. Create account at [Redis Cloud](https://redis.com/try-free/)
2. Create a new database
3. Get your connection details

## Step 3: Spotify API Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an App"
3. Fill in app details:
   - App name: TuneSlam
   - App description: Collaborative music queue for parties
   - Redirect URI: `http://localhost:5000/api/spotify/callback`
4. Save your **Client ID** and **Client Secret**

## Step 4: Install Dependencies

```bash
cd tuneslam-ai
npm install
cd backend
npm install
```

## Step 5: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB (local)
MONGODB_URI=mongodb://localhost:27017/tuneslam
# OR MongoDB Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tuneslam

# Redis (local)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
# OR Redis Cloud
# REDIS_HOST=redis-xxxxx.cloud.redislabs.com
# REDIS_PORT=12345
# REDIS_PASSWORD=your-password

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Spotify API Credentials (from Step 3)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:5000/api/spotify/callback

# Frontend URLs (for CORS)
ADMIN_URL=http://localhost:5173
USER_URL=http://localhost:5174
VIEWER_URL=http://localhost:5175

# Session Configuration
SESSION_COOKIE_SECRET=your-session-cookie-secret
```

## Step 6: Start the Backend

```bash
cd backend
npm run dev
```

You should see:
```
✅ MongoDB connected
✅ Redis connected
✅ Socket.io initialized
🚀 Server running on port 5000
```

## Step 7: Test the API

### Health Check
```bash
curl http://localhost:5000/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-..."}
```

### Test Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "phoneNumber": "+1234567890",
    "password": "password123"
  }'
```

## Common Issues and Solutions

### MongoDB Connection Error
- **Issue**: `MongoServerError: connect ECONNREFUSED`
- **Solution**: Make sure MongoDB is running. Check with:
  ```bash
  # Check if MongoDB is running
  sudo systemctl status mongod  # Linux
  brew services list            # macOS
  ```

### Redis Connection Error
- **Issue**: `Error: connect ECONNREFUSED localhost:6379`
- **Solution**: Make sure Redis is running. Check with:
  ```bash
  redis-cli ping  # Should return "PONG"
  ```

### Port Already in Use
- **Issue**: `Error: listen EADDRINUSE: address already in use :::5000`
- **Solution**: Change the PORT in your `.env` file or kill the process using port 5000:
  ```bash
  # Find process using port 5000
  lsof -i :5000
  # Kill it
  kill -9 <PID>
  ```

### Spotify OAuth Not Working
- **Issue**: Redirect after Spotify auth fails
- **Solution**: 
  1. Make sure redirect URI in Spotify Dashboard matches exactly: `http://localhost:5000/api/spotify/callback`
  2. Check that SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are correct

## Next Steps

### Frontend Development
The backend is complete and ready. Next, you'll need to create the three frontend applications:

1. **Admin Dashboard** (`frontend/admin/`) - Port 5173
2. **User Interface** (`frontend/user/`) - Port 5174  
3. **TV Viewer** (`frontend/viewer/`) - Port 5175

Each will be built with React + Vite and connect to this backend API.

### Testing Endpoints
Use tools like:
- **Postman** - [Download](https://www.postman.com/downloads/)
- **Insomnia** - [Download](https://insomnia.rest/download)
- **Thunder Client** - VS Code extension

Import the API documentation from `backend/API_DOCUMENTATION.md` to test all endpoints.

## Production Deployment

For production deployment, you'll need to:

1. Set `NODE_ENV=production` in `.env`
2. Use a proper database (MongoDB Atlas)
3. Use a proper Redis instance (Redis Cloud or AWS ElastiCache)
4. Set up SSL/HTTPS
5. Use a process manager like PM2
6. Set up proper logging
7. Configure CORS for your production domains
8. Use environment-specific configuration

## Support

For issues or questions:
- Check the API documentation: `backend/API_DOCUMENTATION.md`
- Review the architecture plan in planning notes
- Check GitHub issues (if applicable)
