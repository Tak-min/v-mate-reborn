import { create } from 'zustand';
import type { MutableRefObject } from 'react';
import type { AnimationName } from '@/hooks/useAnimationController';

export interface CharacterController {
  lipSyncWeightRef: MutableRefObject<number>;
  playAnimation: (name: AnimationName) => void;
}

interface CharacterControllerState {
  controller: CharacterController | null;
  setController: (controller: CharacterController | null) => void;
}

/** Exposes the active VRM character's runtime controls (lip-sync, animations) to the rest of the UI. */
export const useCharacterStore = create<CharacterControllerState>((set) => ({
  controller: null,
  setController: (controller) => set({ controller }),
}));
