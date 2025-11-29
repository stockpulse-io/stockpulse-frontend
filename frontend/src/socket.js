import { io } from 'socket.io-client';

// Initialize socket connection once
export const socket = io('http://localhost:4000', {
  transports: ['websocket'], // Force websocket only
});