export const DEFAULT_SETTINGS = {
  background: 'gradient-blue',
  volume: 0.7,
  voiceSpeed: 1.0,
} as const;

export const ANIMATION_PATHS = {
  appearing: '/animations/appearing.vrma',
  waiting: '/animations/waiting.vrma',
  liked: '/animations/liked.vrma',
  idle: [
    '/animations/idle_01.vrma',
    '/animations/idle_02.vrma',
    '/animations/idle_03.vrma',
    '/animations/idle_04.vrma',
  ],
} as const;

export type Emotion = 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry';

export interface BackgroundPreset {
  top: string;
  bottom: string;
}

export const BACKGROUND_PRESETS: Record<string, BackgroundPreset> = {
  'gradient-blue': { top: '#3b6fd6', bottom: '#dceeff' },
  'gradient-sunset': { top: '#ff8a65', bottom: '#ffe0b2' },
  'gradient-night': { top: '#1a1f3c', bottom: '#4a5b8c' },
  'gradient-mint': { top: '#34c2a3', bottom: '#e0fff5' },
};
