import { describe, expect, it } from 'vitest';
import { mat4 } from 'gl-matrix';
import {
  packRotationUniformData,
  ZERO_ROTATION,
  type RotationUniformOverrides
} from './rotationUniforms';
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
    const target = new Float32Array(60);
    const matrixOut = mat4.create();
    const leftQuat = new Float32Array(4);
    const rightQuat = new Float32Array(4);

    packRotationUniformData({ ...ANGLES, timestamp: 1200, confidence: 0.65 }, target, matrixOut, leftQuat, rightQuat);

    expect(target[0]).toBeCloseTo(ANGLES.xy, 1e-6);
    expect(target[1]).toBeCloseTo(ANGLES.xz, 1e-6);
    expect(target[2]).toBeCloseTo(ANGLES.yz, 1e-6);
    expect(target[4]).toBeCloseTo(ANGLES.xw, 1e-6);
    expect(target[5]).toBeCloseTo(ANGLES.yw, 1e-6);
    expect(target[6]).toBeCloseTo(ANGLES.zw, 1e-6);

    expect(target[8]).toBeCloseTo(Math.sin(ANGLES.xy), 1e-6);
    expect(target[9]).toBeCloseTo(Math.sin(ANGLES.xz), 1e-6);
    expect(target[10]).toBeCloseTo(Math.sin(ANGLES.yz), 1e-6);
    expect(target[12]).toBeCloseTo(Math.cos(ANGLES.xy), 1e-6);
    expect(target[13]).toBeCloseTo(Math.cos(ANGLES.xz), 1e-6);
    expect(target[14]).toBeCloseTo(Math.cos(ANGLES.yz), 1e-6);

    expect(target[16]).toBeCloseTo(Math.sin(ANGLES.xw), 1e-6);
    expect(target[17]).toBeCloseTo(Math.sin(ANGLES.yw), 1e-6);
    expect(target[18]).toBeCloseTo(Math.sin(ANGLES.zw), 1e-6);
    expect(target[20]).toBeCloseTo(Math.cos(ANGLES.xw), 1e-6);
    expect(target[21]).toBeCloseTo(Math.cos(ANGLES.yw), 1e-6);
    expect(target[22]).toBeCloseTo(Math.cos(ANGLES.zw), 1e-6);

    expect(target[24]).toBeCloseTo(Math.abs(ANGLES.xy) / Math.PI, 1e-6);
    expect(target[25]).toBeCloseTo(Math.abs(ANGLES.xz) / Math.PI, 1e-6);
    expect(target[26]).toBeCloseTo(Math.abs(ANGLES.yz) / Math.PI, 1e-6);
    expect(target[28]).toBeCloseTo(Math.abs(ANGLES.xw) / Math.PI, 1e-6);
    expect(target[29]).toBeCloseTo(Math.abs(ANGLES.yw) / Math.PI, 1e-6);
    expect(target[30]).toBeCloseTo(Math.abs(ANGLES.zw) / Math.PI, 1e-6);

    const expectedMatrix = rotationMatrixFromAngles(ANGLES);
    for (let i = 0; i < 16; i += 1) {
      expect(target[36 + i]).toBeCloseTo(expectedMatrix[i], 1e-5);
    }

    const expectedDual = composeDualQuaternion(ANGLES);
    for (let i = 0; i < 4; i += 1) {
      expect(target[52 + i]).toBeCloseTo(expectedDual.left[i], 1e-5);
      expect(target[56 + i]).toBeCloseTo(expectedDual.right[i], 1e-5);
    }

    expect(target[32]).toBeCloseTo(0.65, 1e-6);
    expect(target[33]).toBeCloseTo(1.2, 1e-6);
    const spatialMagnitude = (Math.abs(ANGLES.xy) + Math.abs(ANGLES.xz) + Math.abs(ANGLES.yz)) / (Math.PI * 3);
    const hyperMagnitude = (Math.abs(ANGLES.xw) + Math.abs(ANGLES.yw) + Math.abs(ANGLES.zw)) / (Math.PI * 3);
    expect(target[34]).toBeCloseTo(spatialMagnitude, 1e-6);
    expect(target[35]).toBeCloseTo(hyperMagnitude, 1e-6);
  });

  it('handles zero rotation without producing NaNs', () => {
    const target = new Float32Array(60);
    const matrixOut = mat4.create();
    const leftQuat = new Float32Array(4);
    const rightQuat = new Float32Array(4);

    packRotationUniformData({ ...ZERO_ROTATION, timestamp: 0, confidence: 1 }, target, matrixOut, leftQuat, rightQuat);

    for (let i = 0; i < target.length; i += 1) {
      expect(Number.isNaN(target[i])).toBe(false);
      expect(Number.isFinite(target[i])).toBe(true);
    }
  });

  it('respects provided overrides when packing uniform data', () => {
    const target = new Float32Array(60);
    const matrixOut = mat4.create();
    const leftQuat = new Float32Array(4);
    const rightQuat = new Float32Array(4);

    const overrides: RotationUniformOverrides = {
      spatialSin: [0.1, 0.2, 0.3],
      spatialCos: [0.4, 0.5, 0.6],
      hyperspatialSin: [0.7, 0.8, 0.9],
      hyperspatialCos: [1.0, 1.1, 1.2],
      spatialMagnitudes: [0.25, 0.5, 0.75],
      hyperspatialMagnitudes: [0.15, 0.35, 0.55],
      matrix: Array.from({ length: 16 }, (_, index) => index * 0.05),
      dual: {
        left: [0.11, 0.22, 0.33, 0.44],
        right: [0.55, 0.66, 0.77, 0.88]
      }
    };

    packRotationUniformData({ ...ANGLES, timestamp: 2000, confidence: 0.5 }, target, matrixOut, leftQuat, rightQuat, overrides);

    expect(target[8]).toBeCloseTo(overrides.spatialSin![0], 1e-6);
    expect(target[9]).toBeCloseTo(overrides.spatialSin![1], 1e-6);
    expect(target[10]).toBeCloseTo(overrides.spatialSin![2], 1e-6);
    expect(target[12]).toBeCloseTo(overrides.spatialCos![0], 1e-6);
    expect(target[13]).toBeCloseTo(overrides.spatialCos![1], 1e-6);
    expect(target[14]).toBeCloseTo(overrides.spatialCos![2], 1e-6);

    expect(target[16]).toBeCloseTo(overrides.hyperspatialSin![0], 1e-6);
    expect(target[17]).toBeCloseTo(overrides.hyperspatialSin![1], 1e-6);
    expect(target[18]).toBeCloseTo(overrides.hyperspatialSin![2], 1e-6);
    expect(target[20]).toBeCloseTo(overrides.hyperspatialCos![0], 1e-6);
    expect(target[21]).toBeCloseTo(overrides.hyperspatialCos![1], 1e-6);
    expect(target[22]).toBeCloseTo(overrides.hyperspatialCos![2], 1e-6);

    expect(target[24]).toBeCloseTo(overrides.spatialMagnitudes![0], 1e-6);
    expect(target[25]).toBeCloseTo(overrides.spatialMagnitudes![1], 1e-6);
    expect(target[26]).toBeCloseTo(overrides.spatialMagnitudes![2], 1e-6);
    expect(target[28]).toBeCloseTo(overrides.hyperspatialMagnitudes![0], 1e-6);
    expect(target[29]).toBeCloseTo(overrides.hyperspatialMagnitudes![1], 1e-6);
    expect(target[30]).toBeCloseTo(overrides.hyperspatialMagnitudes![2], 1e-6);

    for (let i = 0; i < 16; i += 1) {
      expect(target[36 + i]).toBeCloseTo(overrides.matrix![i], 1e-6);
      expect(matrixOut[i]).toBeCloseTo(overrides.matrix![i], 1e-6);
    }

    for (let i = 0; i < 4; i += 1) {
      expect(target[52 + i]).toBeCloseTo(overrides.dual!.left[i], 1e-6);
      expect(target[56 + i]).toBeCloseTo(overrides.dual!.right[i], 1e-6);
      expect(leftQuat[i]).toBeCloseTo(overrides.dual!.left[i], 1e-6);
      expect(rightQuat[i]).toBeCloseTo(overrides.dual!.right[i], 1e-6);
    }
  });
});
