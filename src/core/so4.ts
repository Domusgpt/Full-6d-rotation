import { mat4, vec4 } from 'gl-matrix';
import type { RotationAngles } from './rotationUniforms';

export type QuaternionBuffer = Float32Array | [number, number, number, number];

export interface DualQuaternionPair<L extends QuaternionBuffer = [number, number, number, number], R extends QuaternionBuffer = [number, number, number, number]> {
  left: L;
  right: R;
}

const rotationScratch = mat4.create();

export function rotationMatrixFromAngles(angles: RotationAngles, out?: mat4): mat4 {
  const { xy, xz, yz, xw, yw, zw } = angles;
  const matrix = out ?? mat4.create();
  mat4.identity(matrix);

  applyRotationToMatrix(matrix, xy, rotateXY);
  applyRotationToMatrix(matrix, xz, rotateXZ);
  applyRotationToMatrix(matrix, yz, rotateYZ);
  applyRotationToMatrix(matrix, xw, rotateXW);
  applyRotationToMatrix(matrix, yw, rotateYW);
  applyRotationToMatrix(matrix, zw, rotateZW);

  return matrix;
}

function applyRotationToMatrix(target: mat4, angle: number, generator: (out: mat4, angle: number) => mat4) {
  if (angle === 0) return;
  const r = generator(rotationScratch, angle);
  mat4.multiply(target, r, target);
}

export function applySequentialRotations(vector: vec4, angles: RotationAngles): vec4 {
  const result = vec4.clone(vector);
  rotateXY(result, angles.xy);
  rotateXZ(result, angles.xz);
  rotateYZ(result, angles.yz);
  rotateXW(result, angles.xw);
  rotateYW(result, angles.yw);
  rotateZW(result, angles.zw);
  return result;
}

function rotateXY(out: vec4, angle: number): vec4;
function rotateXY(out: mat4, angle: number): mat4;
function rotateXY(out: vec4 | mat4, angle: number): typeof out {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (out.length === 4) {
    const [x, y, z, w] = out as vec4;
    (out as vec4)[0] = x * c - y * s;
    (out as vec4)[1] = x * s + y * c;
    (out as vec4)[2] = z;
    (out as vec4)[3] = w;
  } else {
    const m = out as mat4;
    mat4.identity(m);
    m[0] = c; m[1] = s;
    m[4] = -s; m[5] = c;
  }
  return out;
}

function rotateXZ(out: vec4, angle: number): vec4;
function rotateXZ(out: mat4, angle: number): mat4;
function rotateXZ(out: vec4 | mat4, angle: number): typeof out {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (out.length === 4) {
    const [x, y, z, w] = out as vec4;
    (out as vec4)[0] = x * c - z * s;
    (out as vec4)[1] = y;
    (out as vec4)[2] = x * s + z * c;
    (out as vec4)[3] = w;
  } else {
    const m = out as mat4;
    mat4.identity(m);
    m[0] = c; m[2] = s;
    m[8] = -s; m[10] = c;
  }
  return out;
}

function rotateYZ(out: vec4, angle: number): vec4;
function rotateYZ(out: mat4, angle: number): mat4;
function rotateYZ(out: vec4 | mat4, angle: number): typeof out {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (out.length === 4) {
    const [x, y, z, w] = out as vec4;
    (out as vec4)[0] = x;
    (out as vec4)[1] = y * c - z * s;
    (out as vec4)[2] = y * s + z * c;
    (out as vec4)[3] = w;
  } else {
    const m = out as mat4;
    mat4.identity(m);
    m[5] = c; m[6] = s;
    m[9] = -s; m[10] = c;
  }
  return out;
}

function rotateXW(out: vec4, angle: number): vec4;
function rotateXW(out: mat4, angle: number): mat4;
function rotateXW(out: vec4 | mat4, angle: number): typeof out {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (out.length === 4) {
    const [x, y, z, w] = out as vec4;
    (out as vec4)[0] = x * c - w * s;
    (out as vec4)[1] = y;
    (out as vec4)[2] = z;
    (out as vec4)[3] = x * s + w * c;
  } else {
    const m = out as mat4;
    mat4.identity(m);
    m[0] = c; m[3] = s;
    m[12] = -s; m[15] = c;
  }
  return out;
}

function rotateYW(out: vec4, angle: number): vec4;
function rotateYW(out: mat4, angle: number): mat4;
function rotateYW(out: vec4 | mat4, angle: number): typeof out {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (out.length === 4) {
    const [x, y, z, w] = out as vec4;
    (out as vec4)[0] = x;
    (out as vec4)[1] = y * c - w * s;
    (out as vec4)[2] = z;
    (out as vec4)[3] = y * s + w * c;
  } else {
    const m = out as mat4;
    mat4.identity(m);
    m[5] = c; m[7] = s;
    m[13] = -s; m[15] = c;
  }
  return out;
}

function rotateZW(out: vec4, angle: number): vec4;
function rotateZW(out: mat4, angle: number): mat4;
function rotateZW(out: vec4 | mat4, angle: number): typeof out {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (out.length === 4) {
    const [x, y, z, w] = out as vec4;
    (out as vec4)[0] = x;
    (out as vec4)[1] = y;
    (out as vec4)[2] = z * c - w * s;
    (out as vec4)[3] = z * s + w * c;
  } else {
    const m = out as mat4;
    mat4.identity(m);
    m[10] = c; m[11] = s;
    m[14] = -s; m[15] = c;
  }
  return out;
}

const dualQuatMatrixScratch = mat4.create();
const dualQuatBasis = [
  vec4.fromValues(0, 0, 0, 1),
  vec4.fromValues(1, 0, 0, 0),
  vec4.fromValues(0, 1, 0, 0),
  vec4.fromValues(0, 0, 1, 0)
];
const dualQuatRotated = [vec4.create(), vec4.create(), vec4.create(), vec4.create()];
const dualQuatMatrixBasis = [
  vec4.fromValues(1, 0, 0, 0),
  vec4.fromValues(0, 1, 0, 0),
  vec4.fromValues(0, 0, 1, 0),
  vec4.fromValues(0, 0, 0, 1)
];

function createQuaternion(): [number, number, number, number] {
  return [0, 0, 0, 0];
}

const dualQuatQuaternions = Array.from({ length: 11 }, createQuaternion);

const tmpVectorQuaternion: [number, number, number, number] = [0, 0, 0, 0];
const tmpLeftQuat: [number, number, number, number] = [0, 0, 0, 0];
const tmpRightQuat: [number, number, number, number] = [0, 0, 0, 0];
const tmpProduct: [number, number, number, number] = [0, 0, 0, 0];
const tmpConjugateRight: [number, number, number, number] = [0, 0, 0, 0];

export function composeDualQuaternion<L extends QuaternionBuffer = [number, number, number, number], R extends QuaternionBuffer = [number, number, number, number]>(
  angles: RotationAngles,
  outLeft?: L,
  outRight?: R
): DualQuaternionPair<L, R> {
  const matrix = rotationMatrixFromAngles(angles, dualQuatMatrixScratch);

  for (let i = 0; i < dualQuatBasis.length; i++) {
    vec4.transformMat4(dualQuatRotated[i], dualQuatBasis[i], matrix);
  }

  const quatA = vectorToQuaternionInto(dualQuatRotated[0], dualQuatQuaternions[0]);
  const quatB = vectorToQuaternionInto(dualQuatRotated[1], dualQuatQuaternions[1]);
  const quatC = vectorToQuaternionInto(dualQuatRotated[2], dualQuatQuaternions[2]);
  const quatD = vectorToQuaternionInto(dualQuatRotated[3], dualQuatQuaternions[3]);

  const aConjugate = conjugateQuaternionInto(quatA, dualQuatQuaternions[4]);
  const rotatedI = multiplyQuaternionsInto(dualQuatQuaternions[5], quatB, aConjugate);
  const rotatedJ = multiplyQuaternionsInto(dualQuatQuaternions[6], quatC, aConjugate);
  const rotatedK = multiplyQuaternionsInto(dualQuatQuaternions[7], quatD, aConjugate);

  const leftQuatWFirst = quaternionFromRotationMatrix3(
    rotatedI[1], rotatedJ[1], rotatedK[1],
    rotatedI[2], rotatedJ[2], rotatedK[2],
    rotatedI[3], rotatedJ[3], rotatedK[3],
    dualQuatQuaternions[8]
  );

  normalizeQuaternionInPlace(leftQuatWFirst);

  const conjugateLeft = conjugateQuaternionInto(leftQuatWFirst, dualQuatQuaternions[9]);
  const conjugateRight = multiplyQuaternionsInto(dualQuatQuaternions[10], conjugateLeft, quatA);
  const rightQuatWFirst = normalizeQuaternionInto(conjugateQuaternionInto(conjugateRight, conjugateRight), conjugateRight);

  const leftResult = (outLeft ?? createQuaternion()) as L;
  const rightResult = (outRight ?? createQuaternion()) as R;

  quaternionToVectorInto(leftQuatWFirst, leftResult);
  quaternionToVectorInto(rightQuatWFirst, rightResult);

  return { left: leftResult, right: rightResult };
}

export function applyDualQuaternionRotation(vector: vec4, angles: RotationAngles, out?: vec4): vec4 {
  const { left, right } = composeDualQuaternion(angles);
  return rotateVectorWithDualQuaternion(vector, left, right, out ?? vec4.create());
}

export function rotationMatrixFromDualQuaternion(angles: RotationAngles): mat4 {
  const matrix = mat4.create();
  const { left, right } = composeDualQuaternion(angles);
  const rotated = vec4.create();

  for (let i = 0; i < dualQuatMatrixBasis.length; i++) {
    rotateVectorWithDualQuaternion(dualQuatMatrixBasis[i], left, right, rotated);
    for (let row = 0; row < 4; row++) {
      matrix[i * 4 + row] = rotated[row];
    }
  }

  return matrix;
}

function rotateVectorWithDualQuaternion(vector: vec4, left: QuaternionBuffer, right: QuaternionBuffer, out: vec4): vec4 {
  const leftQuat = normalizeQuaternionInto(toWFirst(left, tmpLeftQuat), tmpLeftQuat);
  const rightQuat = normalizeQuaternionInto(toWFirst(right, tmpRightQuat), tmpRightQuat);
  const vectorQuat = vectorToQuaternionInto(vector, tmpVectorQuaternion);
  const product = multiplyQuaternionsInto(tmpProduct, leftQuat, vectorQuat);
  const conjugateRight = conjugateQuaternionInto(rightQuat, tmpConjugateRight);
  const rotated = multiplyQuaternionsInto(tmpVectorQuaternion, product, conjugateRight);

  out[0] = rotated[1];
  out[1] = rotated[2];
  out[2] = rotated[3];
  out[3] = rotated[0];
  return out;
}

function toWFirst(quaternion: QuaternionBuffer, out: QuaternionBuffer): QuaternionBuffer {
  out[0] = quaternion[3];
  out[1] = quaternion[0];
  out[2] = quaternion[1];
  out[3] = quaternion[2];
  return out;
}

function normalizeQuaternionInto(source: QuaternionBuffer, out: QuaternionBuffer): QuaternionBuffer {
  const w = source[0];
  const x = source[1];
  const y = source[2];
  const z = source[3];
  const mag = Math.hypot(w, x, y, z) || 1;
  out[0] = w / mag;
  out[1] = x / mag;
  out[2] = y / mag;
  out[3] = z / mag;
  return out;
}

function normalizeQuaternionInPlace(quaternion: QuaternionBuffer): QuaternionBuffer {
  return normalizeQuaternionInto(quaternion, quaternion);
}

function conjugateQuaternionInto(source: QuaternionBuffer, out: QuaternionBuffer): QuaternionBuffer {
  out[0] = source[0];
  out[1] = -source[1];
  out[2] = -source[2];
  out[3] = -source[3];
  return out;
}

function multiplyQuaternionsInto(out: QuaternionBuffer, a: QuaternionBuffer, b: QuaternionBuffer): QuaternionBuffer {
  const aw = a[0];
  const ax = a[1];
  const ay = a[2];
  const az = a[3];
  const bw = b[0];
  const bx = b[1];
  const by = b[2];
  const bz = b[3];

  out[0] = aw * bw - ax * bx - ay * by - az * bz;
  out[1] = aw * bx + ax * bw + ay * bz - az * by;
  out[2] = aw * by - ax * bz + ay * bw + az * bx;
  out[3] = aw * bz + ax * by - ay * bx + az * bw;
  return out;
}

function vectorToQuaternionInto(vector: vec4, out: QuaternionBuffer): QuaternionBuffer {
  out[0] = vector[3];
  out[1] = vector[0];
  out[2] = vector[1];
  out[3] = vector[2];
  return out;
}

function quaternionToVectorInto(quaternion: QuaternionBuffer, out: QuaternionBuffer): QuaternionBuffer {
  out[0] = quaternion[1];
  out[1] = quaternion[2];
  out[2] = quaternion[3];
  out[3] = quaternion[0];
  return out;
}

function quaternionFromRotationMatrix3(
  m00: number, m01: number, m02: number,
  m10: number, m11: number, m12: number,
  m20: number, m21: number, m22: number,
  out: QuaternionBuffer
): QuaternionBuffer {
  const trace = m00 + m11 + m22;

  let w: number;
  let x: number;
  let y: number;
  let z: number;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }

  out[0] = w;
  out[1] = x;
  out[2] = y;
  out[3] = z;
  return normalizeQuaternionInto(out, out);
}
