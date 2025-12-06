import { io } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL; 
// Example: http://localhost:4000

export const socket = io(API_URL, {
  transports: ['websocket'], // Force WebSocket only
});