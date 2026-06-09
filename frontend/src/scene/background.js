/** Background sphere management. */
import * as THREE from 'three';
import { BACKEND_URL } from '../config.js';

export class BackgroundManager {
  constructor(scene) {
    this._scene = scene;
    this._mesh  = null;
  }

  async load(value, localUrl = null) {
    if (this._mesh) {
      this._scene.remove(this._mesh);
      this._mesh = null;
    }
    if (!value || value === 'none') return;

    const url = localUrl ?? `${BACKEND_URL}/backgrounds/${value}`;
    const loader = new THREE.TextureLoader();
    try {
      const tex = await loader.loadAsync(url);
      tex.mapping  = THREE.EquirectangularReflectionMapping;
      tex.encoding = THREE.sRGBEncoding;

      const geo = new THREE.SphereGeometry(10, 64, 32, Math.PI/4, Math.PI/2, Math.PI/6, Math.PI/2);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, depthTest: false });
      this._mesh = new THREE.Mesh(geo, mat);
      this._mesh.position.set(0, 1.5, 0);
      this._mesh.renderOrder = -1;
      this._scene.add(this._mesh);
    } catch (err) {
      console.warn('Background load failed:', err);
    }
  }
}
