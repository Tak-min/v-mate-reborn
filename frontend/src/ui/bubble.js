/** AR speech bubble anchored to the VRM character's head. */
import * as THREE from 'three';

export class SpeechBubble {
  constructor() {
    this._el = document.createElement('div');
    this._el.className = 'ar-speech-bubble';
    this._el.innerHTML = '<div class="ar-speech-bubble-text"></div>';
    document.body.appendChild(this._el);
    this._visible = false;
    this._hideTimer = null;
  }

  /** Show `text` near the character's head. Call every frame for position tracking. */
  show(text) {
    clearTimeout(this._hideTimer);
    this._el.querySelector('.ar-speech-bubble-text').textContent = text;
    this._el.classList.add('show');
    this._visible = true;
    this._hideTimer = setTimeout(() => this.hide(), 8000);
  }

  hide() {
    this._el.classList.remove('show');
    this._visible = false;
  }

  /** Update screen position each frame. Pass VRM and camera. */
  trackHead(vrm, camera) {
    if (!this._visible || !vrm) return;
    const bone = vrm.humanoid?.getBoneNode('head');
    if (!bone) return;
    const world = new THREE.Vector3();
    bone.getWorldPosition(world);
    world.y += 0.3;
    world.project(camera);
    const x = (world.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(world.y * 0.5 - 0.5)) * window.innerHeight - 60;
    this._el.style.left = `${x}px`;
    this._el.style.top  = `${y}px`;
  }
}
