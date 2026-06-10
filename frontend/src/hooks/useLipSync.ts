import { useCharacterStore } from '@/store/characterStore';

const FFT_SIZE = 256;
const SMOOTHING = 0.8;
const RELEVANT_BINS = 64;

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

/**
 * Connects an analyser to the playing audio element and continuously writes a
 * 0-1 mouth-open weight into the active character's lip-sync ref.
 * Returns a cleanup function that stops the analysis loop.
 */
export function startLipSync(audio: HTMLAudioElement): () => void {
  try {
    const audioContext = getAudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();

    const source = audioContext.createMediaElementSource(audio);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let frameId: number;

    const tick = () => {
      analyser.getByteFrequencyData(data);

      let sum = 0;
      const bins = Math.min(RELEVANT_BINS, data.length);
      for (let i = 0; i < bins; i += 1) sum += data[i];
      const weight = Math.min(1, sum / bins / 255);

      const controller = useCharacterStore.getState().controller;
      if (controller) controller.lipSyncWeightRef.current = weight;

      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      const controller = useCharacterStore.getState().controller;
      if (controller) controller.lipSyncWeightRef.current = 0;
      source.disconnect();
      analyser.disconnect();
    };
  } catch (error) {
    console.warn('Lip sync setup failed:', error);
    return () => {};
  }
}
