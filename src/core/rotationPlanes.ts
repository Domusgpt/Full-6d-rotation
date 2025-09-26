import type { RotationAngles, RotationSnapshot } from './rotationUniforms';

export const SPATIAL_PLANES = ['xy', 'xz', 'yz'] as const;
export const HYPERSPATIAL_PLANES = ['xw', 'yw', 'zw'] as const;
export const SIX_PLANE_KEYS = [...SPATIAL_PLANES, ...HYPERSPATIAL_PLANES] as const;

export type RotationPlane = (typeof SIX_PLANE_KEYS)[number];

export interface RotationPlaneWeights {
  xy: number;
  xz: number;
  yz: number;
  xw: number;
  yw: number;
  zw: number;
}

export const UNIT_PLANE_WEIGHTS: RotationPlaneWeights = {
  xy: 1,
  xz: 1,
  yz: 1,
  xw: 1,
  yw: 1,
  zw: 1
};

type MutableNumericArray = { readonly length: number; [index: number]: number };

export const PLANE_INDEX: Record<RotationPlane, number> = {
  xy: 0,
  xz: 1,
  yz: 2,
  xw: 3,
  yw: 4,
  zw: 5
};

export function forEachPlane(callback: (plane: RotationPlane, index: number) => void) {
  for (const plane of SIX_PLANE_KEYS) {
    callback(plane, PLANE_INDEX[plane]);
  }
}

export function writeRotationChannels<T extends MutableNumericArray>(
  target: T,
  angles: RotationAngles,
  offset = 0
): T {
  target[offset + PLANE_INDEX.xy] = angles.xy;
  target[offset + PLANE_INDEX.xz] = angles.xz;
  target[offset + PLANE_INDEX.yz] = angles.yz;
  target[offset + PLANE_INDEX.xw] = angles.xw;
  target[offset + PLANE_INDEX.yw] = angles.yw;
  target[offset + PLANE_INDEX.zw] = angles.zw;
  return target;
}

export function readRotationChannels(source: ArrayLike<number>, offset = 0): RotationAngles {
  return {
    xy: source[offset + PLANE_INDEX.xy] ?? 0,
    xz: source[offset + PLANE_INDEX.xz] ?? 0,
    yz: source[offset + PLANE_INDEX.yz] ?? 0,
    xw: source[offset + PLANE_INDEX.xw] ?? 0,
    yw: source[offset + PLANE_INDEX.yw] ?? 0,
    zw: source[offset + PLANE_INDEX.zw] ?? 0
  };
}

export function cloneRotationAngles(angles: RotationAngles): RotationAngles {
  return {
    xy: angles.xy,
    xz: angles.xz,
    yz: angles.yz,
    xw: angles.xw,
    yw: angles.yw,
    zw: angles.zw
  };
}

export function clonePlaneWeights(weights: RotationPlaneWeights): RotationPlaneWeights {
  return {
    xy: weights.xy,
    xz: weights.xz,
    yz: weights.yz,
    xw: weights.xw,
    yw: weights.yw,
    zw: weights.zw
  };
}

function sanitizeWeight(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function createPlaneWeights(initial?: Partial<RotationPlaneWeights> | null): RotationPlaneWeights {
  const weights = clonePlaneWeights(UNIT_PLANE_WEIGHTS);
  if (!initial) {
    return weights;
  }
  mergePlaneWeights(weights, initial);
  return weights;
}

export function mergePlaneWeights(
  target: RotationPlaneWeights,
  weights: Partial<RotationPlaneWeights> | null | undefined
): boolean {
  if (!weights) return false;
  let changed = false;
  for (const plane of SIX_PLANE_KEYS) {
    const candidate = weights[plane];
    if (candidate === undefined) continue;
    const sanitized = sanitizeWeight(candidate);
    if (target[plane] !== sanitized) {
      target[plane] = sanitized;
      changed = true;
    }
  }
  return changed;
}

export function applyPlaneWeights<T extends RotationAngles>(
  target: T,
  source: RotationAngles,
  weights: RotationPlaneWeights
): T {
  target.xy = source.xy * weights.xy;
  target.xz = source.xz * weights.xz;
  target.yz = source.yz * weights.yz;
  target.xw = source.xw * weights.xw;
  target.yw = source.yw * weights.yw;
  target.zw = source.zw * weights.zw;
  return target;
}

export function applyPlaneWeightsToSnapshot(
  target: RotationSnapshot,
  source: RotationSnapshot,
  weights: RotationPlaneWeights
): RotationSnapshot {
  applyPlaneWeights(target, source, weights);
  target.timestamp = source.timestamp;
  target.confidence = source.confidence;
  return target;
}
