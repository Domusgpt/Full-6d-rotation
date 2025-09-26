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

export function mapImuPacket(packet: ImuPacket, dt: number, gains: MappingGains = DEFAULT_GAINS): RotationSnapshot {
  const [gx, gy, gz] = packet.gyro;
  const [ax, ay, az] = packet.accel;

  const spatial = integrateGyro([gx, gy, gz], dt, gains.spatial);
  const hyperspatial = projectAcceleration([ax, ay, az], gains.hyperspatial);

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

function integrateGyro([gx, gy, gz]: [number, number, number], dt: number, gains: [number, number, number]): [number, number, number] {
  return [
    gz * dt * gains[2],
    gy * dt * gains[1],
    gx * dt * gains[0]
  ];
}

function projectAcceleration([ax, ay, az]: [number, number, number], gains: [number, number, number]): [number, number, number] {
  const gravity = Math.max(Math.hypot(ax, ay, az), 1e-5);
  const normalized = [ax / gravity, ay / gravity, az / gravity] as [number, number, number];
  return [
    normalized[0] * gains[0],
    normalized[1] * gains[1],
    normalized[2] * gains[2]
  ];
}
