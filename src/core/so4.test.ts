import { describe, expect, it } from 'vitest';
import { vec4, mat4 } from 'gl-matrix';
import { applySequentialRotations, rotationMatrixFromAngles } from './so4';
import type { RotationAngles } from './rotationUniforms';

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

  it('maintains sequential/matrix parity across random samples', () => {
    const iterations = 25;
    for (let i = 0; i < iterations; i++) {
      const vector = vec4.fromValues(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );

      const angles: RotationAngles = {
        xy: (Math.random() * 2 - 1) * Math.PI,
        xz: (Math.random() * 2 - 1) * Math.PI,
        yz: (Math.random() * 2 - 1) * Math.PI,
        xw: (Math.random() * 2 - 1) * Math.PI,
        yw: (Math.random() * 2 - 1) * Math.PI,
        zw: (Math.random() * 2 - 1) * Math.PI
      };

      const sequential = applySequentialRotations(vector, angles);
      const matrix = rotationMatrixFromAngles(angles);
      const matrixResult = vec4.transformMat4(vec4.create(), vector, matrix);

      for (let axis = 0; axis < 4; axis++) {
        expect(sequential[axis]).toBeCloseTo(matrixResult[axis], 1e-5);
      }
    }
  });
});
