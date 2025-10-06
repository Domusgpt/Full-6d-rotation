import type { RotationAngles } from '../core/rotationUniforms';

export type RotationPlane = keyof RotationAngles;

export interface MappingChannel {
  axis: 'x' | 'y' | 'z';
  plane: RotationPlane;
  gain: number;
  clamp?: number;
  smoothing?: number;
}

export interface PlaneMappingProfile {
  id: string;
  name: string;
  spatial: MappingChannel[];
  hyperspatial: MappingChannel[];
}

export const DEFAULT_PROFILE: PlaneMappingProfile = {
  id: 'default-imu',
  name: 'Default IMU',
  spatial: [
    { axis: 'x', plane: 'yz', gain: 1.0, smoothing: 0.1 },
    { axis: 'y', plane: 'xz', gain: 0.95, smoothing: 0.1 },
    { axis: 'z', plane: 'xy', gain: 0.9, smoothing: 0.1 }
  ],
  hyperspatial: [
    { axis: 'x', plane: 'xw', gain: 0.35, smoothing: 0.2 },
    { axis: 'y', plane: 'yw', gain: 0.35, smoothing: 0.2 },
    { axis: 'z', plane: 'zw', gain: 0.35, smoothing: 0.2 }
  ]
};

export const SMOOTHING_PROFILE: PlaneMappingProfile = {
  id: 'smooth-orbit',
  name: 'Smooth Orbit',
  spatial: [
    { axis: 'x', plane: 'yz', gain: 0.85, smoothing: 0.45 },
    { axis: 'y', plane: 'xz', gain: 0.8, smoothing: 0.45 },
    { axis: 'z', plane: 'xy', gain: 0.82, smoothing: 0.45 }
  ],
  hyperspatial: [
    { axis: 'x', plane: 'xw', gain: 0.28, smoothing: 0.55 },
    { axis: 'y', plane: 'yw', gain: 0.28, smoothing: 0.55 },
    { axis: 'z', plane: 'zw', gain: 0.28, smoothing: 0.55 }
  ]
};

export const HIGH_GAIN_PROFILE: PlaneMappingProfile = {
  id: 'high-gain-imu',
  name: 'High Gain',
  spatial: [
    { axis: 'x', plane: 'yz', gain: 1.35, clamp: 2.8, smoothing: 0.08 },
    { axis: 'y', plane: 'xz', gain: 1.25, clamp: 2.8, smoothing: 0.08 },
    { axis: 'z', plane: 'xy', gain: 1.2, clamp: 2.6, smoothing: 0.08 }
  ],
  hyperspatial: [
    { axis: 'x', plane: 'xw', gain: 0.48, clamp: 1.4, smoothing: 0.2 },
    { axis: 'y', plane: 'yw', gain: 0.48, clamp: 1.4, smoothing: 0.2 },
    { axis: 'z', plane: 'zw', gain: 0.48, clamp: 1.4, smoothing: 0.2 }
  ]
};

export const AVAILABLE_PROFILES: PlaneMappingProfile[] = [
  DEFAULT_PROFILE,
  HIGH_GAIN_PROFILE,
  SMOOTHING_PROFILE
];

export function getProfileById(id: string): PlaneMappingProfile | undefined {
  return AVAILABLE_PROFILES.find(profile => profile.id === id);
}
