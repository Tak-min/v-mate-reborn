import { create } from 'zustand';
import type { VMateSocket } from '@/ws/client';

interface SocketState {
  socket: VMateSocket | null;
  setSocket: (socket: VMateSocket | null) => void;
}

/** Holds the active chat WebSocket so any component can send messages or audio. */
export const useSocketStore = create<SocketState>((set) => ({
  socket: null,
  setSocket: (socket) => set({ socket }),
}));
