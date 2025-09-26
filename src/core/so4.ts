import { mat4, vec4 } from 'gl-matrix';
import type { RotationAngles, RotationDualQuaternion } from './rotationUniforms';

export function rotationMatrixFromAngles(angles: RotationAngles, out?: mat4): mat4 {
  const { xy, xz, yz, xw, yw, zw } = angles;
  const m = out ?? mat4.create();
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

export function composeDualQuaternion(
  angles: RotationAngles,
  leftOut?: Float32Array,
  rightOut?: Float32Array
): RotationDualQuaternion {
  const matrix = rotationMatrixFromAngles(angles, scratchMatrix);
  const columns = extractColumns(matrix);

  const left = leftOut ?? new Float32Array(4);
  const right = rightOut ?? new Float32Array(4);
  const initialRight = quaternionFromEuler(angles.xw, angles.yw, angles.zw, scratchQuaternion0);

  solveDualQuaternionPair(columns, initialRight, left, right);

  return { left, right };
}

export function applyDualQuaternionRotation(
  vector: vec4,
  dual: RotationDualQuaternion,
  out: vec4 = vec4.create()
): vec4 {
  const left = copyQuaternion(dual.left, scratchQuaternion0);
  const right = copyQuaternion(dual.right, scratchQuaternion1);
  const qVector = quaternionFromVector(vector, scratchQuaternion2);
  const temp = multiplyQuaternion(quaternionNormalize(left), qVector, scratchQuaternion0);
  const rightConjugate = conjugateQuaternion(quaternionNormalize(right), scratchQuaternion1);
  const rotated = multiplyQuaternion(temp, rightConjugate, scratchQuaternion0);
  out[0] = rotated[0];
  out[1] = rotated[1];
  out[2] = rotated[2];
  out[3] = rotated[3];
  return out;
}

function quaternionFromEuler(
  ax: number,
  ay: number,
  az: number,
  out?: Float32Array
): Float32Array {
  const cx = Math.cos(ax * 0.5);
  const sx = Math.sin(ax * 0.5);
  const cy = Math.cos(ay * 0.5);
  const sy = Math.sin(ay * 0.5);
  const cz = Math.cos(az * 0.5);
  const sz = Math.sin(az * 0.5);

  const target = out ?? new Float32Array(4);
  target[0] = sx * cy * cz + cx * sy * sz;
  target[1] = cx * sy * cz - sx * cy * sz;
  target[2] = cx * cy * sz + sx * sy * cz;
  target[3] = cx * cy * cz - sx * sy * sz;
  return target;
}

const scratchQuaternion0 = new Float32Array(4);
const scratchQuaternion1 = new Float32Array(4);
const scratchQuaternion2 = new Float32Array(4);
const scratchMatrix = mat4.create();
const columnScratch = [
  vec4.create(),
  vec4.create(),
  vec4.create(),
  vec4.create()
];
const vectorScratch0 = vec4.create();
const vectorScratch1 = vec4.create();
const vectorScratch2 = vec4.create();
const vectorScratch3 = vec4.create();

const RIGHT_TRANSFORMS: readonly number[][][] = [
  [
    [0, 0, 0, 1],
    [0, 0, -1, 0],
    [0, 1, 0, 0],
    [-1, 0, 0, 0]
  ],
  [
    [0, 0, 1, 0],
    [0, 0, 0, 1],
    [-1, 0, 0, 0],
    [0, -1, 0, 0]
  ],
  [
    [0, -1, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 1],
    [0, 0, -1, 0]
  ],
  [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ]
];

function solveDualQuaternionPair(
  columns: readonly Float32Array[],
  initialRight: Float32Array,
  leftOut: Float32Array,
  rightOut: Float32Array
) {
  const conjRight = quaternionNormalize(conjugateQuaternion(initialRight, scratchQuaternion1));
  const left = leftOut;
  const u = scratchQuaternion2;
  u.set(conjRight);

  for (let i = 0; i < 3; i += 1) {
    solveLeftQuaternion(columns, u, left);
    quaternionNormalize(left);
    solveConjugateRightGivenLeft(columns, left, u);
    quaternionNormalize(u);
  }

  if (left[3] < 0) {
    scaleQuaternion(left, -1);
    scaleQuaternion(u, -1);
  }

  conjugateQuaternion(u, rightOut);
  quaternionNormalize(rightOut);
}

function extractColumns(matrix: mat4): readonly Float32Array[] {
  for (let i = 0; i < 4; i += 1) {
    const column = columnScratch[i];
    column[0] = matrix[i * 4 + 0];
    column[1] = matrix[i * 4 + 1];
    column[2] = matrix[i * 4 + 2];
    column[3] = matrix[i * 4 + 3];
  }
  return columnScratch;
}

function solveLeftQuaternion(
  columns: readonly Float32Array[],
  conjugateRight: Float32Array,
  out: Float32Array
): Float32Array {
  const rows: number[][] = [];
  const rhs: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    const v = transformRows(RIGHT_TRANSFORMS[i], conjugateRight, vectorScratch0);
    addLeftRows(v, columns[i], rows, rhs);
  }

  return solveLeastSquares4(rows, rhs, out);
}

function solveConjugateRightGivenLeft(
  columns: readonly Float32Array[],
  left: Float32Array,
  out: Float32Array
): Float32Array {
  const rows: number[][] = [];
  const rhs: number[] = [];

  for (let i = 0; i < 4; i += 1) {
    const transform = RIGHT_TRANSFORMS[i];
    addRightRows(left, transform, columns[i], rows, rhs);
  }

  return solveLeastSquares4(rows, rhs, out);
}

function addLeftRows(
  v: Float32Array,
  target: Float32Array,
  rows: number[][],
  rhs: number[]
) {
  rows.push([v[3], v[2], -v[1], v[0]]);
  rhs.push(target[0]);
  rows.push([-v[2], v[3], v[0], v[1]]);
  rhs.push(target[1]);
  rows.push([v[1], -v[0], v[3], v[2]]);
  rhs.push(target[2]);
  rows.push([-v[0], -v[1], -v[2], v[3]]);
  rhs.push(target[3]);
}

function addRightRows(
  left: Float32Array,
  transformRows: readonly number[][],
  target: Float32Array,
  rows: number[][],
  rhs: number[]
) {
  const ax = left[0];
  const ay = left[1];
  const az = left[2];
  const aw = left[3];

  const rowX = combineRows(transformRows, aw, -az, ay, ax, vectorScratch1);
  const rowY = combineRows(transformRows, az, aw, -ax, ay, vectorScratch2);
  const rowZ = combineRows(transformRows, -ay, ax, aw, az, vectorScratch3);
  const rowW = combineRows(transformRows, -ax, -ay, -az, aw, vectorScratch0);

  rows.push([...rowX]);
  rhs.push(target[0]);
  rows.push([...rowY]);
  rhs.push(target[1]);
  rows.push([...rowZ]);
  rhs.push(target[2]);
  rows.push([...rowW]);
  rhs.push(target[3]);
}

function combineRows(
  rows: readonly number[][],
  c0: number,
  c1: number,
  c2: number,
  c3: number,
  out: Float32Array
): Float32Array {
  for (let i = 0; i < 4; i += 1) {
    out[i] = rows[0][i] * c0 + rows[1][i] * c1 + rows[2][i] * c2 + rows[3][i] * c3;
  }
  return out;
}

function solveLeastSquares4(
  rows: number[][],
  rhs: number[],
  out: Float32Array
): Float32Array {
  const ata = new Float32Array(16);
  const atb = new Float32Array(4);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const value = rhs[i];
    for (let x = 0; x < 4; x += 1) {
      atb[x] += row[x] * value;
      for (let y = 0; y < 4; y += 1) {
        ata[x + y * 4] += row[x] * row[y];
      }
    }
  }

  const inv = mat4.create();
  if (!mat4.invert(inv, ata)) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
  }

  for (let i = 0; i < 4; i += 1) {
    let sum = 0;
    for (let j = 0; j < 4; j += 1) {
      sum += inv[i + j * 4] * atb[j];
    }
    out[i] = sum;
  }

  return out;
}

function transformRows(
  rows: readonly number[][],
  vector: Float32Array,
  out: Float32Array
): Float32Array {
  for (let i = 0; i < 4; i += 1) {
    out[i] =
      rows[i][0] * vector[0] +
      rows[i][1] * vector[1] +
      rows[i][2] * vector[2] +
      rows[i][3] * vector[3];
  }
  return out;
}

function scaleQuaternion(quaternion: Float32Array, scale: number) {
  quaternion[0] *= scale;
  quaternion[1] *= scale;
  quaternion[2] *= scale;
  quaternion[3] *= scale;
}

function quaternionFromVector(vector: vec4, out: Float32Array) {
  out[0] = vector[0];
  out[1] = vector[1];
  out[2] = vector[2];
  out[3] = vector[3];
  return out;
}

function copyQuaternion(source: Float32Array, out: Float32Array) {
  out[0] = source[0];
  out[1] = source[1];
  out[2] = source[2];
  out[3] = source[3];
  return out;
}

function conjugateQuaternion(quaternion: Float32Array, out: Float32Array) {
  out[0] = -quaternion[0];
  out[1] = -quaternion[1];
  out[2] = -quaternion[2];
  out[3] = quaternion[3];
  return out;
}

function multiplyQuaternion(
  a: Float32Array,
  b: Float32Array,
  out: Float32Array
) {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];

  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

function quaternionNormalize(quaternion: Float32Array) {
  const length = Math.hypot(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
  if (length === 0) {
    quaternion[3] = 1;
    quaternion[0] = quaternion[1] = quaternion[2] = 0;
    return quaternion;
  }
  const inv = 1 / length;
  quaternion[0] *= inv;
  quaternion[1] *= inv;
  quaternion[2] *= inv;
  quaternion[3] *= inv;
  return quaternion;
}
