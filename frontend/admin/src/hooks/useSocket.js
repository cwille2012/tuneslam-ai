import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL;

export const useSocket = (sessionName) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('tuneslam_admin_token');
    
    if (!token || !sessionName) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      socketRef.current.emit('join-session', sessionName);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-session', sessionName);
        socketRef.current.disconnect();
      }
    };
  }, [sessionName]);

  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  const emit = (event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  };

  return { socket: socketRef.current, connected, on, off, emit };
};
