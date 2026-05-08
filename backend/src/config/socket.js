import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;
const connectedUsers = new Map(); // sessionName -> Set of userIds

export const initializeSocket = (httpServer) => {
  // Parse comma-separated CORS origins
  const allowedOrigins = [
    ...(process.env.ADMIN_URL?.split(',') || []),
    ...(process.env.USER_URL?.split(',') || []),
    ...(process.env.VIEWER_URL?.split(',') || []),
    ...(process.env.PLAYER_URL?.split(',') || [])
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
      socket.currentSession = sessionName;
      console.log(`User ${socket.userId} joined session: ${sessionName}`);
      
      // Track connected user (all authenticated users including admins, but not anonymous viewers)
      if (socket.userId && !socket.isViewer) {
        if (!connectedUsers.has(sessionName)) {
          connectedUsers.set(sessionName, new Set());
        }
        connectedUsers.get(sessionName).add(socket.userId);
        
        // Emit participant status update to everyone in this session
        const connectedUserIds = Array.from(connectedUsers.get(sessionName));
        io.to(`session:${sessionName}`).emit('participants-status', { 
          connectedUsers: connectedUserIds 
        });
        console.log(`📡 User ${socket.userId} connected to session ${sessionName}. Total: ${connectedUserIds.length}`);
      }
      
      // Send current participant status to newly joined socket (for admins viewing user management)
      if (connectedUsers.has(sessionName)) {
        const connectedUserIds = Array.from(connectedUsers.get(sessionName));
        socket.emit('participants-status', { 
          connectedUsers: connectedUserIds 
        });
        console.log(`📤 Sent current participant status to new joiner: ${connectedUserIds.length} users online`);
      } else {
        // No users tracked yet, send empty array
        socket.emit('participants-status', { 
          connectedUsers: [] 
        });
        console.log(`📤 Sent empty participant status to new joiner (no users online yet)`);
      }
      
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

    // Player events
    socket.on('player-connected', async (data) => {
      if (socket.currentSession) {
        console.log(`🎵 Player connected for session: ${socket.currentSession}`);
        // Remember this socket as THE player socket for this session, so that
        // if the browser tab is closed (without a graceful unmount/HTTP
        // unregister) we can still clear the session's player state from the
        // `disconnect` handler below.
        socket.isPlayer = true;
        socket.playerSessionName = socket.currentSession;
        socket.playerDeviceId = data?.deviceId || null;

        io.to(`session:${socket.currentSession}`).emit('player-connected', {
          playerActive: true,
          deviceId: data.deviceId,
          timestamp: new Date()
        });
      }
    });

    socket.on('player-disconnected', async () => {
      if (socket.currentSession) {
        console.log(`🎵 Player disconnected from session: ${socket.currentSession}`);
        socket.isPlayer = false;

        // Clear server-side player state so the admin UI reflects reality
        try {
          const Session = (await import('../models/Session.js')).default;
          const session = await Session.findOne({ name: socket.currentSession });
          if (session && session.playerConnected) {
            session.playerConnected = false;
            session.activePlayerId = null;
            session.playerDeviceId = null;
            session.playerPaused = false;
            await session.save();
          }
        } catch (err) {
          console.error('Error clearing player state on player-disconnected:', err);
        }

        io.to(`session:${socket.currentSession}`).emit('player-disconnected', {
          playerActive: false,
          timestamp: new Date()
        });
      }
    });

    socket.on('playback-state-changed', (data) => {
      if (socket.currentSession) {
        io.to(`session:${socket.currentSession}`).emit('playback-state-changed', {
          isPaused: data.isPaused,
          position: data.position,
          track: data.track,
          timestamp: new Date()
        });
        
        if (data.isPaused) {
          io.to(`session:${socket.currentSession}`).emit('player-paused', {
            paused: true,
            timestamp: new Date()
          });
        }
      }
    });

    socket.on('player-skip-requested', () => {
      if (socket.currentSession) {
        console.log(`⏭️ Skip requested from player`);
        io.to(`session:${socket.currentSession}`).emit('skip-to-next');
      }
    });

    socket.on('player-song-ended', () => {
      if (socket.currentSession) {
        console.log(`✅ Song ended in player`);
        io.to(`session:${socket.currentSession}`).emit('song-ended-auto-advance');
      }
    });

    // Leave session room
    socket.on('leave-session', (sessionName) => {
      socket.leave(`session:${sessionName}`);
      
      // Remove from connected users (all authenticated users, not anonymous viewers)
      if (socket.userId && !socket.isViewer && connectedUsers.has(sessionName)) {
        connectedUsers.get(sessionName).delete(socket.userId);
        const connectedUserIds = Array.from(connectedUsers.get(sessionName));
        io.to(`session:${sessionName}`).emit('participants-status', { 
          connectedUsers: connectedUserIds 
        });
        console.log(`📡 User ${socket.userId} disconnected from session ${sessionName}. Total: ${connectedUserIds.length}`);
      }
      
      console.log(`User ${socket.userId} left session: ${sessionName}`);
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.userId} (isAdmin: ${socket.isAdmin})`);

      // If this socket was the active player (e.g. admin closed the player
      // tab/window without a graceful React unmount), clear the session's
      // player state and notify everyone so the admin UI hides its controls.
      if (socket.isPlayer && socket.playerSessionName) {
        const sessionName = socket.playerSessionName;
        console.log(`🎵 Player socket disconnected for session: ${sessionName}`);
        try {
          const Session = (await import('../models/Session.js')).default;
          const session = await Session.findOne({ name: sessionName });
          if (session && session.playerConnected) {
            session.playerConnected = false;
            session.activePlayerId = null;
            session.playerDeviceId = null;
            session.playerPaused = false;
            await session.save();
          }
        } catch (err) {
          console.error('Error clearing player state on disconnect:', err);
        }
        io.to(`session:${sessionName}`).emit('player-disconnected', {
          playerActive: false,
          timestamp: new Date()
        });
      }

      // Remove from all connected sessions (all authenticated users, not anonymous viewers)
      if (socket.userId && !socket.isViewer && socket.currentSession) {
        const sessionName = socket.currentSession;
        if (connectedUsers.has(sessionName)) {
          connectedUsers.get(sessionName).delete(socket.userId);
          const connectedUserIds = Array.from(connectedUsers.get(sessionName));
          io.to(`session:${sessionName}`).emit('participants-status', { 
            connectedUsers: connectedUserIds 
          });
          console.log(`📡 User ${socket.userId} disconnected from session ${sessionName}. Total: ${connectedUserIds.length}`);
        }
      }
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
