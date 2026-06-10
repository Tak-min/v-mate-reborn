import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Background } from './Background';
import { Character } from './Character';
import { useChatStore } from '@/store/chatStore';

/** Top-level 3D viewport: camera, lighting, background, and the active VRM character. */
export function Scene() {
  const currentCharacter = useChatStore((state) => state.currentCharacter);
  const modelUrl = currentCharacter ? `/models/${currentCharacter.model_file}` : '/models/default.vrm';

  return (
    <Canvas camera={{ position: [0, 1.35, 1.6], fov: 30 }} shadows>
      <ambientLight intensity={0.9} />
      <directionalLight position={[1, 2, 1]} intensity={1.2} castShadow />
      <directionalLight position={[-1, 1, -1]} intensity={0.4} />
      <Suspense fallback={null}>
        <Background />
        <Character key={modelUrl} modelUrl={modelUrl} />
      </Suspense>
      <OrbitControls target={[0, 1.0, 0]} enablePan={false} minDistance={0.8} maxDistance={4} />
    </Canvas>
  );
}
