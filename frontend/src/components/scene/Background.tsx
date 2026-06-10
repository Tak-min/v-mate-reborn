import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useSettingsStore } from '@/store/settingsStore';
import { BACKGROUND_PRESETS } from '@/config';

const VERTEX_SHADER = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAGMENT_SHADER = `
varying vec3 vWorldPosition;
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;
void main() {
  float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
  gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
}
`;

/** Renders the scene backdrop: a custom equirectangular image, or a gradient sky preset. */
export function Background() {
  const background = useSettingsStore((state) => state.background);
  const customBackgroundUrl = useSettingsStore((state) => state.customBackgroundUrl);

  if (customBackgroundUrl) {
    return <CustomBackground url={customBackgroundUrl} />;
  }

  return <GradientSky preset={background} />;
}

function CustomBackground({ url }: { url: string }) {
  const texture = useTexture(url);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return <primitive attach="background" object={texture} />;
}

function GradientSky({ preset }: { preset: string }) {
  const colors = BACKGROUND_PRESETS[preset] ?? BACKGROUND_PRESETS['gradient-blue'];

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(colors.top) },
      bottomColor: { value: new THREE.Color(colors.bottom) },
      offset: { value: 20 },
      exponent: { value: 0.6 },
    }),
    [colors.top, colors.bottom],
  );

  return (
    <mesh>
      <sphereGeometry args={[200, 32, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
