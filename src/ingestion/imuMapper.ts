import type { RotationAngles, RotationSnapshot } from '../core/rotationUniforms';

export interface ImuPacket {
  timestamp: number;
  gyro: [number, number, number];
  accel: [number, number, number];
  confidence?: number;
}

export interface MappingGains {
  spatial: [number, number, number];
  hyperspatial: [number, number, number];
}

export const DEFAULT_GAINS: MappingGains = {
  spatial: [1, 1, 1],
  hyperspatial: [0.35, 0.35, 0.35]
};

export type AxisTriple = [number, number, number];

type SpatialPlane = 'xy' | 'xz' | 'yz';
type HyperspatialPlane = 'xw' | 'yw' | 'zw';

export type PlaneWeights<T extends string> = Record<T, AxisTriple>;

export interface PlaneMappingProfile {
  spatial?: Partial<PlaneWeights<SpatialPlane>>;
  hyperspatial?: Partial<PlaneWeights<HyperspatialPlane>>;
  spatialClamp?: number;
  hyperspatialClamp?: number;
}

export interface ResolvedPlaneMappingProfile {
  spatial: PlaneWeights<SpatialPlane>;
  hyperspatial: PlaneWeights<HyperspatialPlane>;
  spatialClamp: number;
  hyperspatialClamp: number;
}

const DEFAULT_SPATIAL_WEIGHTS: PlaneWeights<SpatialPlane> = {
  xy: [1, 0, 0],
  xz: [0, 1, 0],
  yz: [0, 0, 1]
};

const DEFAULT_HYPERSPATIAL_WEIGHTS: PlaneWeights<HyperspatialPlane> = {
  xw: [1, 0, 0],
  yw: [0, 1, 0],
  zw: [0, 0, 1]
};

const DEFAULT_RESOLVED_MAPPING: ResolvedPlaneMappingProfile = {
  spatial: DEFAULT_SPATIAL_WEIGHTS,
  hyperspatial: DEFAULT_HYPERSPATIAL_WEIGHTS,
  spatialClamp: Number.POSITIVE_INFINITY,
  hyperspatialClamp: Number.POSITIVE_INFINITY
};

export function resolvePlaneMappingProfile(
  profile?: PlaneMappingProfile | null
): ResolvedPlaneMappingProfile {
  if (!profile) {
    return DEFAULT_RESOLVED_MAPPING;
  }

  const spatial: PlaneWeights<SpatialPlane> = {
    xy: cloneWeights(profile.spatial?.xy ?? DEFAULT_SPATIAL_WEIGHTS.xy),
    xz: cloneWeights(profile.spatial?.xz ?? DEFAULT_SPATIAL_WEIGHTS.xz),
    yz: cloneWeights(profile.spatial?.yz ?? DEFAULT_SPATIAL_WEIGHTS.yz)
  };

  const hyperspatial: PlaneWeights<HyperspatialPlane> = {
    xw: cloneWeights(profile.hyperspatial?.xw ?? DEFAULT_HYPERSPATIAL_WEIGHTS.xw),
    yw: cloneWeights(profile.hyperspatial?.yw ?? DEFAULT_HYPERSPATIAL_WEIGHTS.yw),
    zw: cloneWeights(profile.hyperspatial?.zw ?? DEFAULT_HYPERSPATIAL_WEIGHTS.zw)
  };

  return {
    spatial,
    hyperspatial,
    spatialClamp: resolveClamp(profile.spatialClamp),
    hyperspatialClamp: resolveClamp(profile.hyperspatialClamp)
  };
}

function cloneWeights(weights: AxisTriple): AxisTriple {
  return [weights[0], weights[1], weights[2]];
}

function resolveClamp(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.abs(value));
}

export function mapImuPacket(
  packet: ImuPacket,
  dt: number,
  gains: MappingGains = DEFAULT_GAINS,
  mapping: ResolvedPlaneMappingProfile = DEFAULT_RESOLVED_MAPPING
): RotationSnapshot {
  const [gx, gy, gz] = packet.gyro;
  const [ax, ay, az] = packet.accel;

  const spatial = integrateGyro([gx, gy, gz], dt, gains.spatial, mapping);
  const hyperspatial = projectAcceleration([ax, ay, az], gains.hyperspatial, mapping);

  return {
    xy: spatial[2],
    xz: spatial[1],
    yz: spatial[0],
    xw: hyperspatial[0],
    yw: hyperspatial[1],
    zw: hyperspatial[2],
    timestamp: packet.timestamp,
    confidence: packet.confidence ?? 1
  };
}

function integrateGyro(
  gyro: [number, number, number],
  dt: number,
  gains: [number, number, number],
  mapping: ResolvedPlaneMappingProfile
): [number, number, number] {
  const weighted = mapAxesToPlanes(gyro, mapping.spatial);
  return [
    clampAngle(weighted.yz * dt * gains[2], mapping.spatialClamp),
    clampAngle(weighted.xz * dt * gains[1], mapping.spatialClamp),
    clampAngle(weighted.xy * dt * gains[0], mapping.spatialClamp)
  ];
}

function projectAcceleration(
  accel: [number, number, number],
  gains: [number, number, number],
  mapping: ResolvedPlaneMappingProfile
): [number, number, number] {
  const gravity = Math.max(Math.hypot(accel[0], accel[1], accel[2]), 1e-5);
  const normalized: [number, number, number] = [
    accel[0] / gravity,
    accel[1] / gravity,
    accel[2] / gravity
  ];
  const weighted = mapAxesToPlanes(normalized, mapping.hyperspatial);
  return [
    clampAngle(weighted.xw * gains[0], mapping.hyperspatialClamp),
    clampAngle(weighted.yw * gains[1], mapping.hyperspatialClamp),
    clampAngle(weighted.zw * gains[2], mapping.hyperspatialClamp)
  ];
}

function mapAxesToPlanes<T extends string>(
  axes: [number, number, number],
  weights: PlaneWeights<T>
): Record<T, number> {
  const [ax, ay, az] = axes;
  const result: Partial<Record<T, number>> = {};
  for (const key of Object.keys(weights) as T[]) {
    const w = weights[key];
    result[key] = ax * w[0] + ay * w[1] + az * w[2];
  }
  return result as Record<T, number>;
}

function clampAngle(value: number, maxMagnitude: number): number {
  if (!Number.isFinite(maxMagnitude) || maxMagnitude === Number.POSITIVE_INFINITY) {
    return value;
  }
  if (maxMagnitude <= 0) {
    return 0;
  }
  if (value > maxMagnitude) return maxMagnitude;
  if (value < -maxMagnitude) return -maxMagnitude;
  return value;
}
