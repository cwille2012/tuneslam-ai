import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

export const initializeSocket = (httpServer) => {
  // Parse comma-separated CORS origins
  const allowedOrigins = [
    ...(process.env.ADMIN_URL?.split(',') || []),
    ...(process.env.USER_URL?.split(',') || []),
    ...(process.env.VIEWER_URL?.split(',') || [])
  ].filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  // Authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      // Allow anonymous connections for TV viewer
      socket.userId = null;
      socket.isAdmin = false;
      socket.isViewer = true;
      console.log('Anonymous viewer connection allowed');
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.isAdmin = decoded.isAdmin;
      socket.isViewer = false;
      next();
    } catch (error) {
      // Allow connection anyway as viewer if token is invalid
      socket.userId = null;
      socket.isAdmin = false;
      socket.isViewer = true;
      console.log('Invalid token, allowing as anonymous viewer');
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join session room
    socket.on('join-session', async (sessionName) => {
      socket.join(`session:${sessionName}`);
      console.log(`User ${socket.userId} joined session: ${sessionName}`);
      
      // Send current state to newly joined client
      try {
        const Session = (await import('../models/Session.js')).default;
        const Song = (await import('../models/Song.js')).default;
        const { getCurrentlyPlaying } = await import('../services/spotify.service.js');
        const { getTrackDetails } = await import('../services/spotify.service.js');
        
        const session = await Session.findOne({ name: sessionName });
        if (session) {
          // Check for currently playing song in DB
          let currentSong = await Song.findOne({
            sessionId: session._id,
            status: 'playing'
          });
          
          // If no queue song playing, check if external song is playing
          if (!currentSong && session.spotifyAccessToken) {
            const spotifyData = await getCurrentlyPlaying(session._id);
            if (spotifyData && spotifyData.trackId) {
              // Fetch external song details
              const trackDetails = await getTrackDetails(session._id, spotifyData.trackId);
              if (trackDetails) {
                currentSong = {
                  _id: `external-${spotifyData.trackId}`,
                  spotifyTrackId: trackDetails.spotifyTrackId,
                  title: trackDetails.title,
                  artist: trackDetails.artist,
                  album: trackDetails.album,
                  duration: trackDetails.duration,
                  albumArtUrl: trackDetails.albumArtUrl,
                  isExternal: true,
                  status: 'playing'
                };
              }
            }
          }
          
          // Send current state to this specific client
          socket.emit('now-playing-updated', { song: currentSong });
          console.log(`📤 Sent initial state to new client: ${currentSong ? currentSong.title : 'No song playing'}`);
        }
      } catch (error) {
        console.error('Error sending initial state:', error);
      }
    });

    // Leave session room
    socket.on('leave-session', (sessionName) => {
      socket.leave(`session:${sessionName}`);
      console.log(`User ${socket.userId} left session: ${sessionName}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Helper functions for emitting events
export const emitToSession = (sessionName, event, data) => {
  if (io) {
    const roomName = `session:${sessionName}`;
    const sockets = io.sockets.adapter.rooms.get(roomName);
    const clientCount = sockets ? sockets.size : 0;
    
    console.log(`📡 Emitting "${event}" to room "${roomName}" (${clientCount} clients)`);
    io.to(roomName).emit(event, data);
  }
};

export const emitToUser = (socketId, event, data) => {
  if (io) {
    io.to(socketId).emit(event, data);
  }
};
