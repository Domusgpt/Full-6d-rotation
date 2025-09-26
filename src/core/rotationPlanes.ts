import type { RotationAngles } from './rotationUniforms';

export const SPATIAL_PLANES = ['xy', 'xz', 'yz'] as const;
export const HYPERSPATIAL_PLANES = ['xw', 'yw', 'zw'] as const;
export const SIX_PLANE_KEYS = [...SPATIAL_PLANES, ...HYPERSPATIAL_PLANES] as const;

export type RotationPlane = (typeof SIX_PLANE_KEYS)[number];

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
