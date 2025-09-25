import { type RotationAngles } from './rotationUniforms';
import { composeDualQuaternion } from './so4';
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

const scratchLeft = new Float32Array(4);
const scratchRight = new Float32Array(4);

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

  const energyRaw = clamp01(totalMagnitude / MAX_TOTAL_MAGNITUDE);
  const spatial = clamp01(spatialMagnitude / MAX_PLANE_MAGNITUDE);
  const hyperspatial = clamp01(hypersMagnitude / MAX_PLANE_MAGNITUDE);

  const interference =
    Math.sin(angles.xy * 0.5) +
    Math.sin(angles.xz * 0.33 + angles.yw * 0.25) +
    Math.sin(angles.yz * 0.42 - angles.zw * 0.37);
  const harmonicWave = (interference / 3 + 1) * 0.5;

  const dual = composeDualQuaternion(angles, scratchLeft, scratchRight);
  const dot =
    dual.left[0] * dual.right[0] +
    dual.left[1] * dual.right[1] +
    dual.left[2] * dual.right[2] +
    dual.left[3] * dual.right[3];
  const isoclinic = clamp01((dot + 1) * 0.5);
  const chiralSpread = clamp01(
    Math.hypot(
      dual.left[0] - dual.right[0],
      dual.left[1] - dual.right[1],
      dual.left[2] - dual.right[2],
      dual.left[3] - dual.right[3]
    ) * 0.5
  );

  const harmonic = clamp01(0.55 * harmonicWave + 0.45 * isoclinic);

  const saturation = clamp01(
    0.28 +
      energyRaw * 0.6 +
      0.18 * (harmonic - 0.5) +
      (isoclinic - 0.5) * 0.12
  );
  const brightness = clamp01(
    0.34 +
      0.42 * (1 - Math.abs(harmonic - 0.5) * 1.5) +
      0.08 * (1 - chiralSpread)
  );

  const thicknessRaw =
    0.7 +
    energyRaw * 1.15 +
    (spatial - hyperspatial) * 0.32 +
    chiralSpread * 0.48;
  const thickness = Math.min(Math.max(thicknessRaw, 0.45), 2.6);

  const chaos = clamp01(
    Math.abs(spatial - hyperspatial) * 0.7 +
      energyRaw * 0.22 +
      chiralSpread * 0.48
  );

  const energy = clamp01(energyRaw * (0.88 + chiralSpread * 0.18));

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
