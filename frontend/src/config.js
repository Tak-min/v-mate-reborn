/** Central frontend config — change BACKEND_URL to your deployed URL. */
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000';

export const DEFAULT_SETTINGS = {
  character: 'Shiro.vrm',
  personality: 'shiro',
  background: 'sky.jpg',
  volume: 0.7,
  voiceSpeed: 1.0,
  memoryEnabled: true,
  use3DUI: true,
};

export const ANIMATION_PATHS = {
  appearing: './models/animation/appearing.vrma',
  waiting:   './models/animation/waiting.vrma',
  liked:     './models/animation/liked.vrma',
  idle: [
    './models/animation/idle_loop.vrma',
    './models/animation/idle2.vrma',
    './models/animation/idle3.vrma',
    './models/animation/idle4.vrma',
    './models/animation/waiting.vrma',
    './models/animation/liked.vrma',
  ],
};
