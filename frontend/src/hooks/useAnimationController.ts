import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { createVRMAnimationClip, type VRMAnimation } from '@pixiv/three-vrm-animation';
import { ANIMATION_PATHS } from '@/config';
import { createVRMLoader } from '@/three/loader';

export type AnimationName = 'appearing' | 'waiting' | 'liked' | 'idle';

const CROSSFADE_SECONDS = 0.4;

export interface AnimationController {
  /** Plays a one-shot animation, then resumes the idle rotation. */
  playAnimation: (name: AnimationName) => void;
  /** Advances the animation mixer; call from useFrame. */
  update: (delta: number) => void;
}

/** Manages VRMA clip loading, crossfading, and idle-animation rotation for a VRM character. */
export function useAnimationController(vrm: VRM | null): AnimationController {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const clipCacheRef = useRef<Map<string, THREE.AnimationClip>>(new Map());
  const idleTimerRef = useRef<number | null>(null);
  const vrmRef = useRef<VRM | null>(null);

  useEffect(() => {
    vrmRef.current = vrm;
    if (!vrm) return;

    const mixer = new THREE.AnimationMixer(vrm.scene);
    mixerRef.current = mixer;
    clipCacheRef.current = new Map();
    currentActionRef.current = null;

    void playAnimation('appearing');

    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      mixer.stopAllAction();
      mixerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vrm]);

  async function loadClip(path: string): Promise<THREE.AnimationClip | null> {
    const cached = clipCacheRef.current.get(path);
    if (cached) return cached;

    const currentVrm = vrmRef.current;
    if (!currentVrm) return null;

    try {
      const loader = createVRMLoader();
      const gltf = await loader.loadAsync(path);
      const animations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
      const vrmAnimation = animations?.[0];
      if (!vrmAnimation) return null;

      const clip = createVRMAnimationClip(vrmAnimation, currentVrm);
      clipCacheRef.current.set(path, clip);
      return clip;
    } catch (error) {
      console.warn(`Failed to load animation: ${path}`, error);
      return null;
    }
  }

  function pickRandomIdlePath(): string {
    const idlePaths = ANIMATION_PATHS.idle;
    return idlePaths[Math.floor(Math.random() * idlePaths.length)];
  }

  function resolvePath(name: AnimationName): string {
    if (name === 'idle') return pickRandomIdlePath();
    return ANIMATION_PATHS[name];
  }

  async function playAnimation(name: AnimationName): Promise<void> {
    const mixer = mixerRef.current;
    if (!mixer) return;

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    const path = resolvePath(name);
    const clip = await loadClip(path);
    if (!clip || !mixerRef.current) return;

    const nextAction = mixer.clipAction(clip);
    nextAction.reset();
    nextAction.setLoop(THREE.LoopOnce, 1);
    nextAction.clampWhenFinished = true;

    const previousAction = currentActionRef.current;
    nextAction.play();
    if (previousAction && previousAction !== nextAction) {
      previousAction.crossFadeTo(nextAction, CROSSFADE_SECONDS, false);
    } else {
      nextAction.fadeIn(CROSSFADE_SECONDS);
    }
    currentActionRef.current = nextAction;

    const durationMs = Math.max((clip.duration - CROSSFADE_SECONDS) * 1000, 0);
    idleTimerRef.current = window.setTimeout(() => {
      void playAnimation('idle');
    }, durationMs);
  }

  function update(delta: number): void {
    mixerRef.current?.update(delta);
  }

  return { playAnimation: (name) => void playAnimation(name), update };
}
