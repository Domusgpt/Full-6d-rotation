import { describe, expect, it } from 'vitest';
import { validateRotationSolvers } from './rotationValidator';
import { ZERO_SNAPSHOT } from './rotationUniforms';

describe('validateRotationSolvers', () => {
  it('accepts zero rotation', () => {
    const result = validateRotationSolvers(ZERO_SNAPSHOT);
    expect(result.ok).toBe(true);
    expect(result.matrixDeviation).toBe(0);
    expect(result.dualDeviation).toBe(0);
  });

  it('keeps solvers aligned for representative rotations', () => {
    const samples = [
      {
        xy: 0.42,
        xz: -0.63,
        yz: 0.2,
        xw: -0.51,
        yw: 0.88,
        zw: -0.35,
        timestamp: 0,
        confidence: 1
      },
      {
        xy: -1.1,
        xz: 0.92,
        yz: -0.74,
        xw: 0.58,
        yw: -0.64,
        zw: 1.2,
        timestamp: 0,
        confidence: 1
      }
    ] as const;

    for (const snapshot of samples) {
      const tolerance = 5e-3;
      const result = validateRotationSolvers(snapshot, tolerance);
      expect(result.ok).toBe(true);
      expect(result.matrixDeviation).toBeLessThanOrEqual(tolerance);
      expect(result.dualDeviation).toBeLessThanOrEqual(tolerance);
    }
  });
});
