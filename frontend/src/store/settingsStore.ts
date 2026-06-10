import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SETTINGS } from '@/config';

interface SettingsState {
  background: string;
  customBackgroundUrl: string | null;
  volume: number;
  voiceSpeed: number;
  setBackground: (background: string, customUrl?: string | null) => void;
  setVolume: (volume: number) => void;
  setVoiceSpeed: (voiceSpeed: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      background: DEFAULT_SETTINGS.background,
      customBackgroundUrl: null,
      volume: DEFAULT_SETTINGS.volume,
      voiceSpeed: DEFAULT_SETTINGS.voiceSpeed,
      setBackground: (background, customUrl = null) => set({ background, customBackgroundUrl: customUrl }),
      setVolume: (volume) => set({ volume }),
      setVoiceSpeed: (voiceSpeed) => set({ voiceSpeed }),
    }),
    { name: 'vmate-settings' },
  ),
);
