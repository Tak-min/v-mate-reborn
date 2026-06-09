/** Socket.IO wrapper — single connection shared across the app. */
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../config.js';
import { authService } from '../api/auth.js';

let _socket = null;

export function getSocket() { return _socket; }

export function connect(handlers = {}) {
  const opts = {
    path: '/socket.io',
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20_000,
  };
  const token = authService.getAccessToken();
  if (token) opts.query = { token };

  _socket = io(BACKEND_URL, opts);

  _socket.on('connect',              ()  => handlers.onConnect?.());
  _socket.on('disconnect',           ()  => handlers.onDisconnect?.());
  _socket.on('connected',            (d) => handlers.onReady?.(d));
  _socket.on('message_response',     (d) => handlers.onMessage?.(d));
  _socket.on('message_chunk',        (d) => handlers.onChunk?.(d));
  _socket.on('streaming_complete',   (d) => handlers.onStreamDone?.(d));
  _socket.on('error',                (d) => handlers.onError?.(d));

  return _socket;
}

export function sendMessage(payload) { _socket?.emit('send_message', payload); }
export function sendAudio(payload)   { _socket?.emit('send_audio', payload); }
