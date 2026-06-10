import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVRM } from '@/hooks/useVRM';
import { useAnimationController } from '@/hooks/useAnimationController';
import { useExpression } from '@/hooks/useExpression';
import { useChatStore } from '@/store/chatStore';
import { useCharacterStore } from '@/store/characterStore';

interface CharacterProps {
  modelUrl: string;
}

/** Renders the active VRM avatar and drives its animation, expression, and lip-sync each frame. */
export function Character({ modelUrl }: CharacterProps) {
  const { vrm } = useVRM(modelUrl);
  const { update: updateAnimation, playAnimation } = useAnimationController(vrm);
  const emotion = useChatStore((state) => state.emotion);
  const { update: updateExpression, lipSyncWeightRef } = useExpression(vrm, emotion);
  const setController = useCharacterStore((state) => state.setController);

  useEffect(() => {
    setController({ lipSyncWeightRef, playAnimation });
    return () => setController(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vrm]);

  useFrame((_, delta) => {
    updateAnimation(delta);
    updateExpression(delta);
    vrm?.update(delta);
  });

  if (!vrm) return null;
  return <primitive object={vrm.scene} />;
}
