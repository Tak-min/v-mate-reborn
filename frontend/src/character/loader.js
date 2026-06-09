/** VRM model loader — one function, no duplication. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';

/**
 * Load a VRM file and add it to the scene (initially hidden).
 * @param {THREE.Scene} scene
 * @param {string} url
 * @param {string} [modelName]
 * @returns {{ vrm, mixer }}
 */
export async function loadVRM(scene, url, modelName = '') {
  const loader = new GLTFLoader();
  loader.register(p => new VRMLoaderPlugin(p));
  loader.register(p => new VRMAnimationLoaderPlugin(p));

  const gltf = await loader.loadAsync(url);
  const vrm  = gltf.userData.vrm;

  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.removeUnnecessaryJoints(vrm.scene);

  vrm.scene.traverse(obj => {
    obj.frustumCulled = false;
    obj.castShadow    = true;
    obj.receiveShadow = true;
  });

  const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
  proxy.name  = 'lookAtQuaternionProxy';
  vrm.scene.add(proxy);

  // haruka needs a 180° flip
  vrm.scene.rotation.y = modelName === 'haruka.vrm' ? Math.PI : 0;

  if (vrm.humanoid) vrm.humanoid.resetNormalizedPose();

  vrm.scene.visible = false;
  scene.add(vrm.scene);

  const mixer = new THREE.AnimationMixer(vrm.scene);
  return { vrm, mixer };
}
