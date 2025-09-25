import { type RotationAngles } from './rotationUniforms';
import { type RotationDynamics, ZERO_DYNAMICS } from './styleUniforms';

const SQRT_THREE = Math.sqrt(3);
const SQRT_SIX = Math.sqrt(6);
const MAX_PLANE_MAGNITUDE = Math.PI * SQRT_THREE;
const MAX_TOTAL_MAGNITUDE = Math.PI * SQRT_SIX;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function deriveRotationDynamics(angles: RotationAngles): RotationDynamics {
  const spatialVector = [angles.xy, angles.xz, angles.yz];
  const hypersVector = [angles.xw, angles.yw, angles.zw];

  const spatialMagnitude = Math.hypot(...spatialVector);
  const hypersMagnitude = Math.hypot(...hypersVector);
  const totalMagnitude = Math.hypot(
    spatialVector[0],
    spatialVector[1],
    spatialVector[2],
    hypersVector[0],
    hypersVector[1],
    hypersVector[2]
  );

  const energy = clamp01(totalMagnitude / MAX_TOTAL_MAGNITUDE);
  const spatial = clamp01(spatialMagnitude / MAX_PLANE_MAGNITUDE);
  const hyperspatial = clamp01(hypersMagnitude / MAX_PLANE_MAGNITUDE);

  const interference =
    Math.sin(angles.xy * 0.5) +
    Math.sin(angles.xz * 0.33 + angles.yw * 0.25) +
    Math.sin(angles.yz * 0.42 - angles.zw * 0.37);
  const harmonic = (interference / 3 + 1) * 0.5;

  const saturation = clamp01(0.3 + energy * 0.6 + 0.15 * (harmonic - 0.5));
  const brightness = clamp01(0.35 + 0.4 * (1 - Math.abs(harmonic - 0.5) * 1.6));

  const thicknessRaw = 0.7 + energy * 1.2 + (spatial - hyperspatial) * 0.35;
  const thickness = Math.min(Math.max(thicknessRaw, 0.45), 2.4);

  const chaos = clamp01(Math.abs(spatial - hyperspatial) * 0.8 + energy * 0.25);

  return {
    energy,
    spatial,
    hyperspatial,
    harmonic,
    saturation,
    brightness,
    thickness,
    chaos
  };
}

export function dynamicsToUniformSafe(dynamics: RotationDynamics | null | undefined): RotationDynamics {
  return dynamics ?? ZERO_DYNAMICS;
}
