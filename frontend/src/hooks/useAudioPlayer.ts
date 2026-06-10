import { useCallback, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useCharacterStore } from '@/store/characterStore';
import { startLipSync } from './useLipSync';

export interface AudioPlayer {
  /** Queues an audio URL for sequential playback. */
  enqueue: (url: string) => void;
  /** Stops playback and clears the queue. */
  stop: () => void;
}

/** Plays TTS audio chunks sequentially, driving lip-sync and the "liked" reaction animation. */
export function useAudioPlayer(): AudioPlayer {
  const queueRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  const playNext = useCallback(() => {
    if (isPlayingRef.current) return;
    const url = queueRef.current.shift();
    if (!url) return;

    isPlayingRef.current = true;
    const { volume, voiceSpeed } = useSettingsStore.getState();

    const audio = new Audio(url);
    audio.volume = volume;
    audio.playbackRate = voiceSpeed;
    audioRef.current = audio;

    const stopLipSync = startLipSync(audio);

    const finish = () => {
      stopLipSync();
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', finish);
      isPlayingRef.current = false;
      audioRef.current = null;
      playNext();
    };

    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    audio.play().catch(finish);
  }, []);

  const enqueue = useCallback((url: string) => {
    queueRef.current.push(url);
    playNext();
  }, [playNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    audioRef.current?.pause();
    audioRef.current = null;
    isPlayingRef.current = false;
    const controller = useCharacterStore.getState().controller;
    if (controller) controller.lipSyncWeightRef.current = 0;
  }, []);

  return { enqueue, stop };
}
