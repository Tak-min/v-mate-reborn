/** Animation state machine: appearing → waiting → idle rotation. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { ANIMATION_PATHS } from '../config.js';

export class AnimationController {
  constructor(vrm, mixer) {
    this._vrm    = vrm;
    this._mixer  = mixer;
    this._last   = null;   // last idle path — avoid repeating
    this._busy   = false;  // prevent concurrent scheduleNext calls
  }

  /** Boot sequence: appearing → waiting → idle loop. */
  async boot() {
    const appeared = await this._play(ANIMATION_PATHS.appearing, false, () => this._onAppeared());
    if (!appeared) this._startIdle();
  }

  async _onAppeared() {
    await this._play(ANIMATION_PATHS.waiting, false, () => this._startIdle());
  }

  async _startIdle() {
    if (this._busy) return;
    this._busy = true;
    try { await this._play(await this._nextIdlePath(), false, () => this._startIdle()); }
    finally { this._busy = false; }
  }

  /** Play any path immediately (crossfades from current). Called externally for reaction anims. */
  async react(path) {
    await this._play(path, false, () => this._startIdle());
  }

  // ── internals ──────────────────────────────────────────────────────────

  async _play(path, loop, onDone) {
    if (!this._vrm || !this._mixer) return false;
    const data = await this._load(path);
    if (!data) return false;

    const newAction = data.action;
    newAction.reset();
    newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    newAction.clampWhenFinished = true;

    const running = this._mixer._actions.filter(a => a.isRunning());
    if (running.length) {
      running.forEach(a => a.crossFadeTo(newAction, 0.2, false));
    } else {
      this._mixer.stopAllAction();
    }
    newAction.play();

    if (!loop && onDone) {
      const cb = () => { this._mixer.removeEventListener('finished', cb); onDone(); };
      this._mixer.addEventListener('finished', cb);
    }
    return true;
  }

  async _load(path) {
    if (!path) return null;
    try {
      const ok = await fetch(path, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
      if (!ok) return null;
      const loader = new GLTFLoader();
      loader.register(p => new VRMAnimationLoaderPlugin(p));
      const gltf = await loader.loadAsync(path);
      const anim = gltf.userData.vrmAnimations?.[0];
      if (!anim) return null;
      const clip   = createVRMAnimationClip(anim, this._vrm);
      const action = this._mixer.clipAction(clip);
      return { action, clip };
    } catch {
      return null;
    }
  }

  async _nextIdlePath() {
    const pool = ANIMATION_PATHS.idle.filter(p => p !== this._last);
    const pick = pool.length ? pool : ANIMATION_PATHS.idle;
    const path = pick[Math.floor(Math.random() * pick.length)];
    this._last = path;
    return path;
  }

  show() { if (this._vrm) this._vrm.scene.visible = true; }

  update(dt) { this._mixer?.update(dt); }
}
