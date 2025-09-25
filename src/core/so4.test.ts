import { describe, expect, it } from 'vitest';
import { vec4, mat4 } from 'gl-matrix';
import { applySequentialRotations, rotationMatrixFromAngles } from './so4';
import type { RotationAngles } from './rotationTypes';

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

  it('populates provided output matrix without reallocation', () => {
    const out = mat4.create();
    const matrix = rotationMatrixFromAngles(ANGLES, out);
    expect(matrix).toBe(out);

    const another = rotationMatrixFromAngles(ANGLES, out);
    expect(another).toBe(out);

    const vector = vec4.fromValues(0.1, 0.2, -0.3, 0.4);
    const transformed = vec4.transformMat4(vec4.create(), vector, out);
    const sequential = applySequentialRotations(vector, ANGLES);

    for (let i = 0; i < 4; i++) {
      expect(transformed[i]).toBeCloseTo(sequential[i], 1e-5);
    }
  });
});
