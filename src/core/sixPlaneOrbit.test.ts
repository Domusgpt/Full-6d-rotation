import { describe, expect, it } from 'vitest';
import { createHarmonicOrbit, SIX_PLANE_KEYS } from './sixPlaneOrbit';

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
});
