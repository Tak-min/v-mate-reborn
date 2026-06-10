import { useEffect, useState } from 'react';
import { VRM, VRMUtils } from '@pixiv/three-vrm';
import { createVRMLoader } from '@/three/loader';

interface UseVRMResult {
  vrm: VRM | null;
  isLoading: boolean;
  error: string | null;
}

/** Loads a VRM character model and prepares it for rendering and animation. */
export function useVRM(modelUrl: string): UseVRMResult {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const loader = createVRMLoader();
    loader.loadAsync(modelUrl)
      .then((gltf) => {
        if (cancelled) return;
        const loadedVrm = gltf.userData.vrm as VRM;

        VRMUtils.removeUnnecessaryVertices(loadedVrm.scene);
        VRMUtils.removeUnnecessaryJoints(loadedVrm.scene);
        loadedVrm.scene.traverse((object) => {
          object.frustumCulled = false;
        });

        setVrm(loadedVrm);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load VRM model');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      setVrm((current) => {
        if (current) VRMUtils.deepDispose(current.scene);
        return null;
      });
    };
  }, [modelUrl]);

  return { vrm, isLoading, error };
}
