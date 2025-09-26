import { describe, expect, it } from 'vitest';
import { mat4 } from 'gl-matrix';
import { packRotationUniformData, ZERO_ROTATION } from './rotationUniforms';
import { composeDualQuaternion, rotationMatrixFromAngles } from './so4';

const ANGLES = {
  xy: 0.4,
  xz: -0.7,
  yz: 0.2,
  xw: -0.5,
  yw: 1.0,
  zw: -0.3
};

describe('packRotationUniformData', () => {
  it('writes angles, matrix, and dual quaternions into the target buffer', () => {
    const target = new Float32Array(32);
    const matrixOut = mat4.create();
    const leftQuat = new Float32Array(4);
    const rightQuat = new Float32Array(4);

    packRotationUniformData(ANGLES, target, matrixOut, leftQuat, rightQuat);

    expect(target[0]).toBeCloseTo(ANGLES.xy, 1e-6);
    expect(target[1]).toBeCloseTo(ANGLES.xz, 1e-6);
    expect(target[2]).toBeCloseTo(ANGLES.yz, 1e-6);
    expect(target[4]).toBeCloseTo(ANGLES.xw, 1e-6);
    expect(target[5]).toBeCloseTo(ANGLES.yw, 1e-6);
    expect(target[6]).toBeCloseTo(ANGLES.zw, 1e-6);

    const expectedMatrix = rotationMatrixFromAngles(ANGLES);
    for (let i = 0; i < 16; i += 1) {
      expect(target[8 + i]).toBeCloseTo(expectedMatrix[i], 1e-5);
    }

    const expectedDual = composeDualQuaternion(ANGLES);
    for (let i = 0; i < 4; i += 1) {
      expect(target[24 + i]).toBeCloseTo(expectedDual.left[i], 1e-5);
      expect(target[28 + i]).toBeCloseTo(expectedDual.right[i], 1e-5);
    }
  });

  it('handles zero rotation without producing NaNs', () => {
    const target = new Float32Array(32);
    const matrixOut = mat4.create();
    const leftQuat = new Float32Array(4);
    const rightQuat = new Float32Array(4);

    packRotationUniformData(ZERO_ROTATION, target, matrixOut, leftQuat, rightQuat);

    for (let i = 0; i < target.length; i += 1) {
      expect(Number.isNaN(target[i])).toBe(false);
      expect(Number.isFinite(target[i])).toBe(true);
    }
  });
});
