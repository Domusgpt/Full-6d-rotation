import { mat4, vec4 } from 'gl-matrix';
import type { RotationAngles } from './rotationUniforms';

export function rotationMatrixFromAngles(angles: RotationAngles): mat4 {
  const { xy, xz, yz, xw, yw, zw } = angles;
  const m = mat4.create();
  mat4.identity(m);

  applyRotationToMatrix(m, xy, rotateXY);
  applyRotationToMatrix(m, xz, rotateXZ);
  applyRotationToMatrix(m, yz, rotateYZ);
  applyRotationToMatrix(m, xw, rotateXW);
  applyRotationToMatrix(m, yw, rotateYW);
  applyRotationToMatrix(m, zw, rotateZW);

  return m;
}

function applyRotationToMatrix(target: mat4, angle: number, generator: (out: mat4, angle: number) => mat4) {
  if (angle === 0) return;
  const r = generator(mat4.create(), angle);
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

export function composeDualQuaternion(angles: RotationAngles) {
  const matrix = rotationMatrixFromAngles(angles);

  const basisX = vec4.fromValues(1, 0, 0, 0);
  const basisY = vec4.fromValues(0, 1, 0, 0);
  const basisZ = vec4.fromValues(0, 0, 1, 0);
  const basisW = vec4.fromValues(0, 0, 0, 1);

  const A = vec4.transformMat4(vec4.create(), basisW, matrix);
  const B = vec4.transformMat4(vec4.create(), basisX, matrix);
  const C = vec4.transformMat4(vec4.create(), basisY, matrix);
  const D = vec4.transformMat4(vec4.create(), basisZ, matrix);

  const quatA = vectorToQuaternion(A);
  const quatB = vectorToQuaternion(B);
  const quatC = vectorToQuaternion(C);
  const quatD = vectorToQuaternion(D);

  const aConjugate = conjugateQuaternion(quatA);
  const rotatedI = multiplyQuaternions(quatB, aConjugate);
  const rotatedJ = multiplyQuaternions(quatC, aConjugate);
  const rotatedK = multiplyQuaternions(quatD, aConjugate);

  const rotation3 = [
    [rotatedI[1], rotatedJ[1], rotatedK[1]],
    [rotatedI[2], rotatedJ[2], rotatedK[2]],
    [rotatedI[3], rotatedJ[3], rotatedK[3]]
  ];

  const leftQuatWFirst = quaternionFromRotationMatrix3(rotation3);
  const conjugateRight = multiplyQuaternions(conjugateQuaternion(leftQuatWFirst), quatA);
  const rightQuatWFirst = normalizeQuaternion(conjugateQuaternion(conjugateRight));

  const left = quaternionToVector(leftQuatWFirst);
  const right = quaternionToVector(rightQuatWFirst);

  return { left, right };
}

export function applyDualQuaternionRotation(vector: vec4, angles: RotationAngles): vec4 {
  const { left, right } = composeDualQuaternion(angles);
  const leftQuat = normalizeQuaternion(toWFirst(left));
  const rightQuat = normalizeQuaternion(toWFirst(right));
  const vectorQuat = [vector[3], vector[0], vector[1], vector[2]] as Quaternion;

  const rotated = multiplyQuaternions(
    multiplyQuaternions(leftQuat, vectorQuat),
    conjugateQuaternion(rightQuat)
  );

  return vec4.fromValues(rotated[1], rotated[2], rotated[3], rotated[0]);
}

type Quaternion = [number, number, number, number];

function toWFirst(quaternion: Quaternion): Quaternion {
  return [quaternion[3], quaternion[0], quaternion[1], quaternion[2]];
}

function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const [w, x, y, z] = quaternion;
  const mag = Math.hypot(w, x, y, z) || 1;
  return [w / mag, x / mag, y / mag, z / mag];
}

function conjugateQuaternion(quaternion: Quaternion): Quaternion {
  return [quaternion[0], -quaternion[1], -quaternion[2], -quaternion[3]];
}

function multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw
  ];
}

export function rotationMatrixFromDualQuaternion(angles: RotationAngles): mat4 {
  const basis = [
    vec4.fromValues(1, 0, 0, 0),
    vec4.fromValues(0, 1, 0, 0),
    vec4.fromValues(0, 0, 1, 0),
    vec4.fromValues(0, 0, 0, 1)
  ];

  const matrix = mat4.create();
  for (let i = 0; i < 4; i++) {
    const rotated = applyDualQuaternionRotation(basis[i], angles);
    for (let row = 0; row < 4; row++) {
      matrix[i * 4 + row] = rotated[row];
    }
  }

  return matrix;
}

function vectorToQuaternion(vector: vec4): Quaternion {
  return [vector[3], vector[0], vector[1], vector[2]];
}

function quaternionToVector(quaternion: Quaternion): [number, number, number, number] {
  return [quaternion[1], quaternion[2], quaternion[3], quaternion[0]];
}

function quaternionFromRotationMatrix3(matrix: number[][]): Quaternion {
  const m00 = matrix[0][0];
  const m11 = matrix[1][1];
  const m22 = matrix[2][2];
  const trace = m00 + m11 + m22;

  let w: number;
  let x: number;
  let y: number;
  let z: number;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (matrix[2][1] - matrix[1][2]) / s;
    y = (matrix[0][2] - matrix[2][0]) / s;
    z = (matrix[1][0] - matrix[0][1]) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (matrix[2][1] - matrix[1][2]) / s;
    x = 0.25 * s;
    y = (matrix[0][1] + matrix[1][0]) / s;
    z = (matrix[0][2] + matrix[2][0]) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (matrix[0][2] - matrix[2][0]) / s;
    x = (matrix[0][1] + matrix[1][0]) / s;
    y = 0.25 * s;
    z = (matrix[1][2] + matrix[2][1]) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (matrix[1][0] - matrix[0][1]) / s;
    x = (matrix[0][2] + matrix[2][0]) / s;
    y = (matrix[1][2] + matrix[2][1]) / s;
    z = 0.25 * s;
  }

  return normalizeQuaternion([w, x, y, z]);
}
