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
