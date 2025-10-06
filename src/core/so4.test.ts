import { describe, expect, it } from 'vitest';
import { vec4, mat4 } from 'gl-matrix';
import {
  applySequentialRotations,
  applyDualQuaternionRotation,
  rotationMatrixFromAngles,
  rotationMatrixFromDualQuaternion,
  composeDualQuaternion
} from './so4';
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

  it('matches dual-quaternion rotation across randomized samples', () => {
    const vectors = [
      vec4.fromValues(0.3, -0.4, 0.2, 0.5),
      vec4.fromValues(-0.8, 0.1, 0.65, -0.12),
      vec4.fromValues(0.05, -0.9, 0.4, 0.3)
    ];

    for (let seed = 0; seed < 5; seed++) {
      const angles: RotationAngles = {
        xy: Math.sin(seed * 0.37) * 0.8,
        xz: Math.cos(seed * 0.51) * 0.6,
        yz: Math.sin(seed * 0.23 + 0.3) * 0.7,
        xw: Math.cos(seed * 0.41 + 0.2) * 0.5,
        yw: Math.sin(seed * 0.19 + 0.4) * 0.9,
        zw: Math.cos(seed * 0.33 + 0.1) * 0.4
      };

      const dualMatrix = rotationMatrixFromDualQuaternion(angles);
      const sequentialMatrix = rotationMatrixFromAngles(angles);

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          expect(dualMatrix[col * 4 + row]).toBeCloseTo(sequentialMatrix[col * 4 + row], 1e-5);
        }
      }

      for (const vector of vectors) {
        const sequential = applySequentialRotations(vector, angles);
        const dualQuaternion = applyDualQuaternionRotation(vector, angles);

        for (let i = 0; i < 4; i++) {
          expect(dualQuaternion[i]).toBeCloseTo(sequential[i], 1e-5);
        }
      }
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

  it('writes results into provided buffers', () => {
    const seedVector = vec4.fromValues(0.12, -0.34, 0.56, -0.78);
    const angles: RotationAngles = {
      xy: 0.31,
      xz: -0.41,
      yz: 0.23,
      xw: -0.54,
      yw: 0.67,
      zw: -0.12
    };

    const presetMatrix = mat4.create();
    const returnedMatrix = rotationMatrixFromAngles(angles, presetMatrix);
    expect(returnedMatrix).toBe(presetMatrix);

    const leftBuffer = new Float32Array(4);
    const rightBuffer = new Float32Array(4);
    const pair = composeDualQuaternion(angles, leftBuffer, rightBuffer);
    expect(pair.left).toBe(leftBuffer);
    expect(pair.right).toBe(rightBuffer);

    const target = vec4.create();
    const rotated = applyDualQuaternionRotation(seedVector, angles, target);
    expect(rotated).toBe(target);

    const baseline = applySequentialRotations(seedVector, angles);
    for (let i = 0; i < 4; i++) {
      expect(rotated[i]).toBeCloseTo(baseline[i], 1e-5);
    }
  });
});
