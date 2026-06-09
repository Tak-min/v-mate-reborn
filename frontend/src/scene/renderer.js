/** THREE.js WebGL + CSS3D renderer setup. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

export function buildRenderers(container) {
  const w = window.innerWidth, h = window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:absolute;z-index:0;';
  container.appendChild(renderer.domElement);

  const css3d = new CSS3DRenderer();
  css3d.setSize(w, h);
  css3d.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1;';
  container.appendChild(css3d.domElement);

  const scene    = new THREE.Scene();
  const css3dScene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 20);
  camera.position.set(0, 0.9, -3.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableRotate = false;
  controls.enableZoom   = false;
  controls.enablePan    = false;
  controls.update();

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dir = new THREE.DirectionalLight(0xffffff, 3.0);
  dir.position.set(1, 1, 1);
  dir.castShadow = true;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-1, 0.5, -1);
  scene.add(fill);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 5),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    css3d.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return { renderer, css3d, scene, css3dScene, camera, controls };
}
