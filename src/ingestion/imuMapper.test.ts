import { describe, expect, it } from 'vitest';
import { DEFAULT_GAINS, mapImuPacket, type MappingGains } from './imuMapper';

const packet = {
  timestamp: 10,
  gyro: [1, 2, 3] as [number, number, number],
  accel: [0.5, -0.5, 2] as [number, number, number]
};

describe('mapImuPacket', () => {
  it('maps gyro deltas into spatial plane angles using dt and gains', () => {
    const dt = 0.25;
    const snapshot = mapImuPacket(packet, dt, DEFAULT_GAINS);

    expect(snapshot.yz).toBeCloseTo(packet.gyro[2] * dt * DEFAULT_GAINS.spatial[2]);
    expect(snapshot.xz).toBeCloseTo(packet.gyro[1] * dt * DEFAULT_GAINS.spatial[1]);
    expect(snapshot.xy).toBeCloseTo(packet.gyro[0] * dt * DEFAULT_GAINS.spatial[0]);
  });

  it('normalizes acceleration before mapping to hyperspatial planes', () => {
    const dt = 1;
    const snapshot = mapImuPacket(packet, dt, DEFAULT_GAINS);
    const accelMagnitude = Math.hypot(...packet.accel);

    expect(snapshot.xw).toBeCloseTo((packet.accel[0] / accelMagnitude) * DEFAULT_GAINS.hyperspatial[0]);
    expect(snapshot.yw).toBeCloseTo((packet.accel[1] / accelMagnitude) * DEFAULT_GAINS.hyperspatial[1]);
    expect(snapshot.zw).toBeCloseTo((packet.accel[2] / accelMagnitude) * DEFAULT_GAINS.hyperspatial[2]);
  });

  it('respects custom gain matrices for spatial and hyperspatial planes', () => {
    const gains: MappingGains = {
      spatial: [2, 0.5, 1.5],
      hyperspatial: [0.1, 0.2, 0.3]
    };
    const dt = 0.1;
    const snapshot = mapImuPacket(packet, dt, gains);

    expect(snapshot.xy).toBeCloseTo(packet.gyro[0] * dt * gains.spatial[0]);
    expect(snapshot.xz).toBeCloseTo(packet.gyro[1] * dt * gains.spatial[1]);
    expect(snapshot.yz).toBeCloseTo(packet.gyro[2] * dt * gains.spatial[2]);

    const accelMagnitude = Math.hypot(...packet.accel);
    expect(snapshot.xw).toBeCloseTo((packet.accel[0] / accelMagnitude) * gains.hyperspatial[0]);
    expect(snapshot.yw).toBeCloseTo((packet.accel[1] / accelMagnitude) * gains.hyperspatial[1]);
    expect(snapshot.zw).toBeCloseTo((packet.accel[2] / accelMagnitude) * gains.hyperspatial[2]);
  });

  it('caps gravity magnitude to prevent division by zero', () => {
    const zeroAccelPacket = { ...packet, accel: [0, 0, 0] as [number, number, number] };
    const snapshot = mapImuPacket(zeroAccelPacket, 0.016);

    expect(Number.isFinite(snapshot.xw)).toBe(true);
    expect(Number.isFinite(snapshot.yw)).toBe(true);
    expect(Number.isFinite(snapshot.zw)).toBe(true);
  });
});
