import { describe, expect, it } from 'vitest';
import type { ImuPacket } from './imuMapper';
import { So4ImuIntegrator } from './so4Integrator';

const BASE_PACKET: ImuPacket = {
  timestamp: 0,
  gyro: [0, 0, 0],
  accel: [0, 0, 1],
  confidence: 0.8
};

describe('So4ImuIntegrator', () => {
  it('accumulates spatial rotations over successive packets', () => {
    const integrator = new So4ImuIntegrator();
    const packet: ImuPacket = { ...BASE_PACKET, gyro: [0, 0, 1], timestamp: 10 };

    const first = integrator.step(packet, 0.5);
    expect(first.yz).toBeCloseTo(0.5, 5);

    const second = integrator.step({ ...packet, timestamp: 20 }, 0.5);
    expect(second.yz).toBeCloseTo(1.0, 5);
    expect(second.timestamp).toBe(20);
    expect(second.confidence).toBe(packet.confidence);
  });

  it('wraps spatial angles within ±π', () => {
    const integrator = new So4ImuIntegrator();
    const packet: ImuPacket = { ...BASE_PACKET, gyro: [Math.PI * 2, 0, 0], timestamp: 10 };
    const result = integrator.step(packet, 1);
    expect(result.xy).toBeCloseTo(0);
  });

  it('applies smoothing to hyperspatial measurements', () => {
    const integrator = new So4ImuIntegrator(undefined, { hyperSmoothing: 0.5 });
    const packet: ImuPacket = { ...BASE_PACKET, accel: [1, 0, 0], timestamp: 5 };
    const result = integrator.step(packet, 1);
    expect(result.xw).toBeGreaterThan(0);
    expect(result.xw).toBeLessThan(0.35);
  });

  it('resets to provided angles', () => {
    const integrator = new So4ImuIntegrator();
    integrator.step({ ...BASE_PACKET, gyro: [0, 1, 0], timestamp: 1 }, 1);
    integrator.reset({ xy: 0.2, xz: -0.2, yz: 0.1, xw: 0, yw: 0, zw: 0 });
    const state = integrator.getAngles();
    expect(state.xz).toBeCloseTo(-0.2);
    expect(state.yz).toBeCloseTo(0.1);
  });

  it('accepts custom mapping profiles', () => {
    const integrator = new So4ImuIntegrator(undefined, {
      mappingProfile: {
        spatial: { xy: [0, 0, 1], xz: [1, 0, 0], yz: [0, 1, 0] }
      }
    });

    const gyroPacket: ImuPacket = { ...BASE_PACKET, gyro: [1, 0, 0], timestamp: 5 };
    const first = integrator.step(gyroPacket, 0.5);
    expect(first.xz).toBeCloseTo(0.5, 5);
    expect(first.xy).toBeCloseTo(0, 5);

    integrator.setMappingProfile({ spatial: { xy: [1, 0, 0], xz: [0, 1, 0], yz: [0, 0, 1] } });
    const remapped = integrator.step({ ...gyroPacket, timestamp: 10 }, 0.5);
    expect(remapped.xy).toBeCloseTo(0.5, 5);
  });
});
