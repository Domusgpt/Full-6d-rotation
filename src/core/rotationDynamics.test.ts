import { describe, expect, it } from 'vitest';
import { deriveRotationDynamics } from './rotationDynamics';
import { ZERO_ROTATION } from './rotationTypes';

const randomAngle = () => (Math.random() - 0.5) * Math.PI * 2;

describe('deriveRotationDynamics', () => {
  it('returns zero energy for zero rotation', () => {
    const dynamics = deriveRotationDynamics(ZERO_ROTATION);
    expect(dynamics.energy).toBe(0);
    expect(dynamics.spatial).toBe(0);
    expect(dynamics.hyperspatial).toBe(0);
    expect(dynamics.harmonic).toBeGreaterThanOrEqual(0);
    expect(dynamics.harmonic).toBeLessThanOrEqual(1);
  });

  it('responds to spatial and hyperspatial planes differently', () => {
    const spatialOnly = deriveRotationDynamics({
      xy: Math.PI / 2,
      xz: 0,
      yz: 0,
      xw: 0,
      yw: 0,
      zw: 0
    });

    const hyperOnly = deriveRotationDynamics({
      xy: 0,
      xz: 0,
      yz: 0,
      xw: Math.PI / 2,
      yw: 0,
      zw: 0
    });

    expect(spatialOnly.spatial).toBeGreaterThan(hyperOnly.spatial);
    expect(hyperOnly.hyperspatial).toBeGreaterThan(spatialOnly.hyperspatial);
  });

  it('produces normalized metrics within expected bounds', () => {
    for (let i = 0; i < 32; i += 1) {
      const dynamics = deriveRotationDynamics({
        xy: randomAngle(),
        xz: randomAngle(),
        yz: randomAngle(),
        xw: randomAngle(),
        yw: randomAngle(),
        zw: randomAngle()
      });

      expect(dynamics.energy).toBeGreaterThanOrEqual(0);
      expect(dynamics.energy).toBeLessThanOrEqual(1);
      expect(dynamics.spatial).toBeGreaterThanOrEqual(0);
      expect(dynamics.spatial).toBeLessThanOrEqual(1);
      expect(dynamics.hyperspatial).toBeGreaterThanOrEqual(0);
      expect(dynamics.hyperspatial).toBeLessThanOrEqual(1);
      expect(dynamics.saturation).toBeGreaterThanOrEqual(0);
      expect(dynamics.saturation).toBeLessThanOrEqual(1);
      expect(dynamics.brightness).toBeGreaterThanOrEqual(0);
      expect(dynamics.brightness).toBeLessThanOrEqual(1);
      expect(dynamics.chaos).toBeGreaterThanOrEqual(0);
      expect(dynamics.chaos).toBeLessThanOrEqual(1);
      expect(dynamics.thickness).toBeGreaterThan(0);
    }
  });
});
