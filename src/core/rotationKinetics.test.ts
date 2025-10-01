import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_ANGULAR_VELOCITY,
  clearRotationAngles,
  computeAngularVelocity
} from './rotationKinetics';
import { ZERO_ROTATION, type RotationSnapshot } from './rotationUniforms';

function makeSnapshot(partial: Partial<RotationSnapshot>): RotationSnapshot {
  return {
    xy: 0,
    xz: 0,
    yz: 0,
    xw: 0,
    yw: 0,
    zw: 0,
    timestamp: 0,
    confidence: 1,
    ...partial
  };
}

describe('computeAngularVelocity', () => {
  it('derives per-plane velocity in radians per second', () => {
    const previous = makeSnapshot({ timestamp: 1000, xy: 0.2, xw: -0.1 });
    const next = makeSnapshot({ timestamp: 1200, xy: 0.5, xw: 0.2 });
    const target = { ...ZERO_ROTATION };

    computeAngularVelocity(target, previous, next);

    // Δxy = 0.3 rad over 0.2s → 1.5 rad/s
    expect(target.xy).toBeCloseTo(1.5, 6);
    // Δxw = 0.3 rad over 0.2s → 1.5 rad/s
    expect(target.xw).toBeCloseTo(1.5, 6);
    // unaffected planes remain at zero
    expect(target.yz).toBe(0);
    expect(target.zw).toBe(0);
  });

  it('clamps velocities above the configured maximum magnitude', () => {
    const previous = makeSnapshot({ timestamp: 0, xy: 0 });
    const next = makeSnapshot({ timestamp: 10, xy: Math.PI });
    const target = { ...ZERO_ROTATION };

    computeAngularVelocity(target, previous, next);

    expect(target.xy).toBeCloseTo(DEFAULT_MAX_ANGULAR_VELOCITY, 6);
  });

  it('clears the target when delta time is non-positive', () => {
    const previous = makeSnapshot({ timestamp: 500, xy: 1 });
    const next = makeSnapshot({ timestamp: 500, xy: 3 });
    const target = { ...ZERO_ROTATION, xy: 4, yz: 2 };

    computeAngularVelocity(target, previous, next);

    expect(target).toEqual(ZERO_ROTATION);
  });
});

describe('clearRotationAngles', () => {
  it('zeros all plane components in place', () => {
    const angles = { ...ZERO_ROTATION, xy: 1, xw: -0.5 };
    clearRotationAngles(angles);
    expect(angles).toEqual(ZERO_ROTATION);
  });
});
