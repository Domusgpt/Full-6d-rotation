import { describe, expect, it } from 'vitest';
import { vec4, mat4 } from 'gl-matrix';
import { applySequentialRotations, rotationMatrixFromAngles } from './so4';
import type { RotationAngles } from './rotationUniforms';
import { composeDualQuaternion, applyDualQuaternion } from './dualQuaternion';

const ANGLES: RotationAngles = {
  xy: 0.5,
  xz: -0.3,
  yz: 0.8,
  xw: -0.2,
  yw: 1.1,
  zw: 0.4
};

describe('SO(4) rotations', () => {
  it('matches matrix multiplication with sequential rotations', () => {
    const vector = vec4.fromValues(0.25, -0.4, 0.7, -0.2);
    const sequential = applySequentialRotations(vector, ANGLES);

    const matrix = rotationMatrixFromAngles(ANGLES);
    const matrixResult = vec4.transformMat4(vec4.create(), vector, matrix);

    for (let i = 0; i < 4; i++) {
      expect(sequential[i]).toBeCloseTo(matrixResult[i], 1e-5);
    }
  });

  it('produces orthonormal matrix', () => {
    const matrix = rotationMatrixFromAngles(ANGLES);
    const transpose = mat4.transpose(mat4.create(), matrix);
    const product = mat4.multiply(mat4.create(), matrix, transpose);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const expected = i === j ? 1 : 0;
        expect(product[i * 4 + j]).toBeCloseTo(expected, 1e-5);
      }
    }
  });

  it('matches dual quaternion rotation', () => {
    const vector = vec4.fromValues(-0.35, 0.22, 0.6, -0.12);
    const sequential = applySequentialRotations(vector, ANGLES);

    const dual = composeDualQuaternion(ANGLES);
    const vectorQuat = [vector[0], vector[1], vector[2], vector[3]] as [number, number, number, number];
    const rotatedQuat = applyDualQuaternion(vectorQuat, dual);

    for (let i = 0; i < 4; i++) {
      expect(rotatedQuat[i]).toBeCloseTo(sequential[i], 1e-5);
    }
  });

  it('normalizes quaternion pairs', () => {
    const dual = composeDualQuaternion({
      xy: Math.PI * 0.8,
      xz: -Math.PI * 0.25,
      yz: Math.PI * 0.33,
      xw: -0.7,
      yw: 0.45,
      zw: 1.2
    });

    const leftLength = Math.hypot(...dual.left);
    const rightLength = Math.hypot(...dual.right);

    expect(leftLength).toBeCloseTo(1, 1e-6);
    expect(rightLength).toBeCloseTo(1, 1e-6);
  });
});
