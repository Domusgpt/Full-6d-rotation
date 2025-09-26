import { describe, expect, it } from 'vitest';
import { DEFAULT_GAINS, mapImuPacket, type ImuPacket, type MappingGains } from './imuMapper';

const BASE_PACKET: ImuPacket = {
  timestamp: 1_000,
  gyro: [0.5, -0.25, 0.1],
  accel: [0, 9.81, 0]
};

describe('mapImuPacket', () => {
  it('maps gyroscope axes into spatial planes', () => {
    const snapshot = mapImuPacket(BASE_PACKET, 0.02, DEFAULT_GAINS);
    expect(snapshot.xy).toBeCloseTo(0.5 * 0.02, 6);
    expect(snapshot.xz).toBeCloseTo(-0.25 * 0.02, 6);
    expect(snapshot.yz).toBeCloseTo(0.1 * 0.02, 6);
  });

  it('normalizes acceleration for hyperspatial planes with custom gains', () => {
    const gains: MappingGains = {
      spatial: [1, 1, 1],
      hyperspatial: [0.5, 0.25, 0.75]
    };
    const packet: ImuPacket = {
      ...BASE_PACKET,
      accel: [3, 4, 0]
    };
    const snapshot = mapImuPacket(packet, 0.016, gains);
    const norm = Math.hypot(3, 4, 0);
    expect(snapshot.xw).toBeCloseTo((3 / norm) * 0.5, 6);
    expect(snapshot.yw).toBeCloseTo((4 / norm) * 0.25, 6);
    expect(snapshot.zw).toBeCloseTo(0);
  });
});
