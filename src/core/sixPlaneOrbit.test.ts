import { describe, expect, it } from 'vitest';
import { createHarmonicOrbit, createRotationLoom, SIX_PLANE_KEYS } from './sixPlaneOrbit';

describe('six plane harmonic orbit', () => {
  it('produces bounded angles for each plane', () => {
    const orbit = createHarmonicOrbit();
    const angles = orbit(1.234);
    for (const plane of SIX_PLANE_KEYS) {
      expect(angles[plane]).toBeLessThanOrEqual(Math.PI);
      expect(angles[plane]).toBeGreaterThanOrEqual(-Math.PI);
    }
  });

  it('reacts smoothly across time samples', () => {
    const orbit = createHarmonicOrbit();
    const early = orbit(0.25);
    const late = orbit(0.30);
    for (const plane of SIX_PLANE_KEYS) {
      expect(Math.abs(late[plane] - early[plane])).toBeLessThan(0.5);
    }
  });

  it('records rotation loom samples with bounded length', () => {
    const orbit = createHarmonicOrbit();
    const loom = createRotationLoom(orbit, 10);
    let lastEnergy = 0;
    for (let i = 0; i < 50; i++) {
      const samples = loom(i * 0.1);
      lastEnergy = samples[samples.length - 1]?.energy ?? 0;
      expect(samples.length).toBeLessThanOrEqual(10);
    }
    expect(lastEnergy).toBeGreaterThan(0);
  });
});
