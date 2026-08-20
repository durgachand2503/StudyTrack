/* StudyTrack - Socket.io Client */
import { io } from 'socket.io-client';
import { getAccessToken, showToast } from './utils.js';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

function connectSocket() {
  const token = getAccessToken();
  if (!token) return null;

  if (socket && socket.connected) return socket;

  const socketUrl = import.meta.env?.VITE_SOCKET_URL || (import.meta.env?.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : window.location.origin);

  socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    reconnectAttempts = 0;
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    reconnectAttempts++;
    if (reconnectAttempts >= MAX_RECONNECT) {
      console.warn('Max reconnection attempts reached');
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
}

function getSocket() {
  return socket;
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Room management
function joinRoom(type, id) {
  if (socket && id) {
    socket.emit(`join-${type}`, id);
  }
}

function leaveRoom(type, id) {
  if (socket && id) {
    socket.emit(`leave-${type}`, id);
  }
}

function sendMessage(type, roomId, content) {
  if (socket && roomId && content) {
    socket.emit(`${type}-message`, { [`${type}Id`]: roomId, content });
  }
}

export {
  connectSocket, getSocket, disconnectSocket,
  joinRoom, leaveRoom, sendMessage
};
