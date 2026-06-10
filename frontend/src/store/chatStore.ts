import { create } from 'zustand';
import type { Emotion } from '@/config';

export interface Character {
  id: string;
  slug: string;
  name: string;
  color: string;
  model_file: string;
  voice_id: string;
}

interface ChatState {
  characters: Character[];
  currentCharacter: Character | null;
  isProcessing: boolean;
  bubbleText: string | null;
  emotion: Emotion;
  setCharacters: (characters: Character[]) => void;
  setCurrentCharacter: (character: Character) => void;
  setProcessing: (isProcessing: boolean) => void;
  showBubble: (text: string) => void;
  hideBubble: () => void;
  setEmotion: (emotion: Emotion) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  characters: [],
  currentCharacter: null,
  isProcessing: false,
  bubbleText: null,
  emotion: 'neutral',
  setCharacters: (characters) => set({ characters }),
  setCurrentCharacter: (currentCharacter) => set({ currentCharacter }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  showBubble: (bubbleText) => set({ bubbleText }),
  hideBubble: () => set({ bubbleText: null }),
  setEmotion: (emotion) => set({ emotion }),
}));
