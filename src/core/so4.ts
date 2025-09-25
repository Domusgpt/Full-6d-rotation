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
  const { xy, xz, yz, xw, yw, zw } = angles;
  const left = quaternionFromEuler(xy, xz, yz);
  const right = quaternionFromEuler(xw, yw, zw);
  return { left, right };
}

function quaternionFromEuler(ax: number, ay: number, az: number): [number, number, number, number] {
  const cx = Math.cos(ax * 0.5);
  const sx = Math.sin(ax * 0.5);
  const cy = Math.cos(ay * 0.5);
  const sy = Math.sin(ay * 0.5);
  const cz = Math.cos(az * 0.5);
  const sz = Math.sin(az * 0.5);

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz
  ];
}
