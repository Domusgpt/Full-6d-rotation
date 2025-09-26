import { describe, expect, it } from 'vitest';
import { rotationEnergy, ZERO_ROTATION, type RotationAngles } from './rotationUniforms';

describe('rotationEnergy', () => {
  it('is zero for the neutral rotation', () => {
    expect(rotationEnergy(ZERO_ROTATION)).toBe(0);
  });

  it('sums the absolute magnitude of every plane', () => {
    const angles: RotationAngles = {
      xy: Math.PI / 4,
      xz: -Math.PI / 6,
      yz: 0,
      xw: -0.5,
      yw: 0.75,
      zw: -1.25
    };

    const expected =
      Math.abs(angles.xy) +
      Math.abs(angles.xz) +
      Math.abs(angles.yz) +
      Math.abs(angles.xw) +
      Math.abs(angles.yw) +
      Math.abs(angles.zw);

    expect(rotationEnergy(angles)).toBeCloseTo(expected, 1e-10);
  });

  it('does not mutate the input angles', () => {
    const angles: RotationAngles = {
      xy: 0.3,
      xz: -0.2,
      yz: 0.1,
      xw: -0.4,
      yw: 0.05,
      zw: -0.6
    };

    const copy = { ...angles };
    rotationEnergy(angles);
    expect(angles).toStrictEqual(copy);
  });
});
