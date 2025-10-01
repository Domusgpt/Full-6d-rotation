import { vec4 } from 'gl-matrix';
import {
  applyDualQuaternionRotation,
  applySequentialRotations,
  composeDualQuaternion,
  rotationMatrixFromAngles
} from './so4';
import type { RotationSnapshot } from './rotationUniforms';

const TEST_VECTORS: readonly vec4[] = [
  vec4.fromValues(1, 0, 0, 0),
  vec4.fromValues(0, 1, 0, 0),
  vec4.fromValues(0, 0, 1, 0),
  vec4.fromValues(0, 0, 0, 1),
  vec4.fromValues(0.5, -0.5, 0.75, -0.25),
  vec4.fromValues(-0.33, 0.62, -0.48, 0.91)
];

export interface RotationValidationResult {
  ok: boolean;
  matrixDeviation: number;
  dualDeviation: number;
  tolerance: number;
  sampleCount: number;
}

function maxComponentDelta(a: vec4, b: vec4): number {
  return Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(a[2] - b[2]),
    Math.abs(a[3] - b[3])
  );
}

export function validateRotationSolvers(
  snapshot: RotationSnapshot,
  tolerance = 1e-4
): RotationValidationResult {
  const matrix = rotationMatrixFromAngles(snapshot);
  const dual = composeDualQuaternion(snapshot);

  let matrixDeviation = 0;
  let dualDeviation = 0;

  for (const baseVector of TEST_VECTORS) {
    const sequential = applySequentialRotations(baseVector, snapshot);
    const matrixResult = vec4.transformMat4(vec4.create(), baseVector, matrix);
    const dualResult = applyDualQuaternionRotation(baseVector, dual);

    matrixDeviation = Math.max(matrixDeviation, maxComponentDelta(sequential, matrixResult));
    dualDeviation = Math.max(dualDeviation, maxComponentDelta(sequential, dualResult));
    dualDeviation = Math.max(dualDeviation, maxComponentDelta(matrixResult, dualResult));
  }

  const ok = matrixDeviation <= tolerance && dualDeviation <= tolerance;
  return {
    ok,
    matrixDeviation,
    dualDeviation,
    tolerance,
    sampleCount: TEST_VECTORS.length
  };
}
