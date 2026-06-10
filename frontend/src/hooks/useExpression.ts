import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { VRM } from '@pixiv/three-vrm';
import type { Emotion } from '@/config';

const BLINK_DURATION_SECONDS = 0.15;
const BLINK_INTERVAL_MIN_SECONDS = 2;
const BLINK_INTERVAL_MAX_SECONDS = 6;

interface BlinkState {
  isBlinking: boolean;
  elapsed: number;
  nextBlinkIn: number;
}

export interface ExpressionController {
  /** Advances blink and lip-sync state; call from useFrame. */
  update: (delta: number) => void;
  /** Mutable 0-1 mouth-open weight, written by the lip-sync hook. */
  lipSyncWeightRef: MutableRefObject<number>;
}

function randomBlinkInterval(): number {
  return BLINK_INTERVAL_MIN_SECONDS + Math.random() * (BLINK_INTERVAL_MAX_SECONDS - BLINK_INTERVAL_MIN_SECONDS);
}

/** Drives VRM facial expressions: emotion-based base pose, idle blinking, and lip-sync. */
export function useExpression(vrm: VRM | null, emotion: Emotion): ExpressionController {
  const lipSyncWeightRef = useRef(0);
  const blinkRef = useRef<BlinkState>({ isBlinking: false, elapsed: 0, nextBlinkIn: randomBlinkInterval() });

  useEffect(() => {
    const expressionManager = vrm?.expressionManager;
    if (!expressionManager) return;

    for (const key of ['happy', 'sad', 'surprised', 'angry', 'relaxed']) {
      expressionManager.setValue(key, 0);
    }

    switch (emotion) {
      case 'happy':
        expressionManager.setValue('happy', 0.3);
        expressionManager.setValue('relaxed', 1.0);
        break;
      case 'sad':
        expressionManager.setValue('sad', 0.6);
        break;
      case 'angry':
        expressionManager.setValue('angry', 0.65);
        break;
      case 'surprised':
        expressionManager.setValue('surprised', 1.0);
        break;
      default:
        expressionManager.setValue('relaxed', 1.0);
        break;
    }

    blinkRef.current = { isBlinking: false, elapsed: 0, nextBlinkIn: randomBlinkInterval() };
  }, [vrm, emotion]);

  function update(delta: number): void {
    const expressionManager = vrm?.expressionManager;
    if (!expressionManager) return;

    const blink = blinkRef.current;
    const maxBlinkValue = emotion === 'happy' ? 0.6 : 1.0;

    if (blink.isBlinking) {
      blink.elapsed += delta;
      const progress = blink.elapsed / BLINK_DURATION_SECONDS;

      if (progress < 0.5) {
        expressionManager.setValue('blink', Math.min(progress * 2, maxBlinkValue));
      } else if (progress < 1.0) {
        expressionManager.setValue('blink', Math.min((1 - progress) * 2, maxBlinkValue));
      } else {
        expressionManager.setValue('blink', 0);
        blink.isBlinking = false;
        blink.elapsed = 0;
        blink.nextBlinkIn = randomBlinkInterval();
      }
    } else {
      blink.nextBlinkIn -= delta;
      if (blink.nextBlinkIn <= 0) {
        blink.isBlinking = true;
        blink.elapsed = 0;
      }
    }

    const weight = lipSyncWeightRef.current;
    expressionManager.setValue('aa', weight);
    expressionManager.setValue('ih', weight * 0.7);
    expressionManager.setValue('ou', weight * 0.8);

    if (emotion === 'happy') {
      expressionManager.setValue('happy', Math.max(0.8 - weight * 0.3, 0));
    } else if (emotion === 'sad') {
      expressionManager.setValue('sad', Math.max(0.6 - weight * 0.2, 0));
    }
  }

  return { update, lipSyncWeightRef };
}
