# 🎵 TuneSlam - Collaborative Music Queue System

A real-time collaborative music queue application for parties and bars, built with Node.js, React, and Spotify API.

## 🚀 Features

### For Admins
- Create and manage sessions with URL-friendly names
- Link Spotify account for seamless playlist integration
- Real-time queue monitoring and control
- User management (block/unblock participants)
- Configurable settings (downvote threshold, song duration limits, rate limiting)
- TV display for public viewing with QR codes
- Add/remove songs manually from queue via admin dashboard
- Session enable/disable toggle

### For Users
- Scan QR code or visit URL to join sessions
- Search and add songs using Spotify
- Vote on songs (upvote/downvote)
- Earn karma points for popular song choices
- View personal statistics
- Mobile-optimized Spotify-styled interface
- Real-time queue updates
- Profile management

### TV Display
- Fullscreen dark mode interface
- Now playing with album art and progress bar
- Live queue with vote counts
- QR code and session URL display
- Auto-scrolling for long queues
- Optimized for viewing from a distance

## 🏗️ Architecture

### Backend (Port 5000)
- **Node.js + Express** - RESTful API server
- **MongoDB** - User, session, song, and vote data
- **Redis** - Caching, rate limiting, vote tracking
- **Socket.io** - Real-time updates across all clients
- **Spotify Web API** - Music search and playlist management
- **bcrypt** - Secure password hashing
- **JWT** - Token-based authentication

### Frontend - Three Separate Apps
1. **Admin Dashboard (Port 5173)** - React + Vite for session management
2. **User Interface (Port 5174)** - React + Vite with Spotify styling
3. **TV Viewer (Port 5175)** - React + Vite with dark mode

## 📦 Tech Stack

- **Backend**: Node.js, Express, MongoDB, Redis, Socket.io
- **Frontend**: React 18, Vite, React Router v6
- **APIs**: Spotify Web API
- **Authentication**: JWT, bcrypt
- **Real-time**: Socket.io
- **QR Codes**: qrcode package
- **Validation**: express-validator

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (running)
- Redis (running)
- Spotify Developer Account

### Installation

1. **Clone and install dependencies:**
```bash
npm install
cd backend && npm install
cd ../frontend/admin && npm install
cd ../frontend/user && npm install
cd ../frontend/viewer && npm install
```

2. **Setup environment:**
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB, Redis, and Spotify credentials
```

3. **Start all services:**

**Option A - Use startup script (Linux with gnome-terminal):**
```bash
./start-all.sh
```

**Option B - Start manually in 4 terminals:**
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Admin Dashboard
cd frontend/admin && npm run dev

# Terminal 3: User Interface
cd frontend/user && npm run dev

# Terminal 4: TV Viewer
cd frontend/viewer && npm run dev
```

### Access the Apps

- **Admin Dashboard**: http://localhost:5173
- **User Interface**: http://localhost:5174/session/{sessionName}
- **TV Viewer**: http://localhost:5175/viewer/{sessionName}
- **API**: http://localhost:5000/api

## 📖 Documentation

- **[SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)** - Detailed setup guide
- **[COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md)** - Complete implementation guide
- **[backend/API_DOCUMENTATION.md](./backend/API_DOCUMENTATION.md)** - API reference
- **[FRONTEND_STATUS.md](./FRONTEND_STATUS.md)** - Frontend development notes

## 🎯 Usage Flow

### For Bar/Venue Owners:

1. Register admin account with business details
2. Create a new session (e.g., "tacotuesday")
3. Link your Spotify account
4. Open TV viewer on a display screen
5. Share session URL or QR code with guests
6. Manage queue, block users, adjust settings
7. Toggle session off when event ends

### For Attendees:

1. Scan QR code or visit session URL
2. Create account (username, email, phone, password)
3. Browse the current queue
4. Search for songs and add them
5. Vote on your favorite songs
6. Earn karma points when your songs get upvoted
7. Track your statistics

## 🌟 Key Features Implemented

### ✅ Authentication & Authorization
- Separate admin (with address) and user registration
- JWT-based secure authentication
- Password hashing with bcrypt
- Profile management (username, email, phone, address for admins)
- Password change functionality

### ✅ Session Management
- URL-friendly session names
- One active session per admin
- Enable/disable sessions
- QR code generation
- Spotify OAuth integration
- Real-time participant tracking

### ✅ Queue System
- Add songs via Spotify search
- Voting (upvote/downvote)
- Auto-remove songs at downvote threshold (configurable)
- Prevent duplicate songs
- Song duration limits (configurable)
- Admin can remove any song
- Real-time queue synchronization

### ✅ User Management
- Track all participants per session
- Block/unblock users
- View user statistics
- Karma points system
- Rate limiting per user

### ✅ Real-time Updates
- Socket.io for instant updates
- Queue changes broadcast to all clients
- Vote counts update live
- Session status changes
- User blocking notifications

### ✅ TV Display
- Dark mode optimized for TVs
- Split view: now playing + queue
- Large, readable text
- QR code and URL display
- Auto-scrolling queue
- Real-time synchronization

## 🔒 Security Features

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with expiration
- Environment variables for sensitive data
- Input validation on all endpoints
- Rate limiting to prevent abuse
- CORS configured for specific origins
- SQL injection prevention (using Mongoose)
- XSS protection

## 📱 Responsive Design

- **Admin Dashboard**: Desktop & mobile responsive
- **User Interface**: Mobile-first, optimized for phones
- **TV Viewer**: Fullscreen for large displays

## 🎨 Design Philosophy

- **Admin**: Clean, functional, easy to use
- **User**: Match Spotify mobile app aesthetics
- **Viewer**: Dark mode, large text, high contrast

## 🔄 Real-time Features

All changes are instantly reflected across all connected clients:
- Queue updates
- Vote changes
- Song additions/removals
- Session status changes
- User blocks/unblocks

## 📊 User Statistics

Track for each user:
- Karma points (upvotes - downvotes on their songs)
- Songs added count
- Songs played count
- Upvotes received
- Downvotes received

## 🛠️ Development

### Project Structure
```
tuneslam-ai/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── config/         # Database, Redis, Socket, Spotify config
│   │   ├── models/         # MongoDB schemas
│   │   ├── services/       # Business logic
│   │   ├── controllers/    # Route handlers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Auth, validation, rate limiting
│   │   └── utils/          # Helper functions
│   └── package.json
├── frontend/
│   ├── admin/              # Admin dashboard (React + Vite)
│   ├── user/               # User interface (React + Vite)
│   └── viewer/             # TV display (React + Vite)
└── start-all.sh            # Startup script
```

### Backend Modules
- **Models**: User, Session, Song, Vote
- **Services**: Auth, Spotify, Queue, Voting
- **Controllers**: Auth, Session, Queue, User, Spotify
- **Middleware**: Authentication, Validation, Rate Limiting

### Frontend Components
Each frontend app is modular with:
- **Pages**: Route-level components
- **Components**: Reusable UI elements
- **Context**: Global state management
- **Hooks**: Custom hooks (useSocket, useAuth)
- **Services**: API integration layer

## 🔑 Environment Variables

See `backend/.env.example` for all required environment variables:
- MongoDB connection string
- Redis connection details
- Spotify API credentials (Client ID, Client Secret, Redirect URI)
- JWT secret
- Frontend URLs for CORS

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping  # Should return "PONG"

# Start Redis
sudo systemctl start redis
```

### Port Already in Use
If a port is already in use, either:
- Kill the process using that port: `lsof -i :<port>` then `kill -9 <PID>`
- Change the port in the respective config file

## 📝 License

This project is proprietary software. All rights reserved.

## 🤝 Contributing

This is a private project. Contact the repository owner for contribution guidelines.

## 📧 Support

For questions or issues, refer to the documentation files or contact support.

---

**Built with ❤️ for music lovers and party enthusiasts**

🎵 TuneSlam - Where the crowd controls the vibe! 🎉
