import { mat4, quat, vec4 } from 'gl-matrix';
import type { RotationAngles } from './rotationTypes';

export interface DualQuaternionRotor {
  left: quat;
  right: quat;
}

export function rotationMatrixFromAngles(angles: RotationAngles): mat4 {
  const m = mat4.create();
  mat4.identity(m);

  applyRotationToMatrix(m, angles.xy, rotateXYMatrix);
  applyRotationToMatrix(m, angles.xz, rotateXZMatrix);
  applyRotationToMatrix(m, angles.yz, rotateYZMatrix);
  applyRotationToMatrix(m, angles.xw, rotateXWMatrix);
  applyRotationToMatrix(m, angles.yw, rotateYWMatrix);
  applyRotationToMatrix(m, angles.zw, rotateZWMatrix);

  return m;
}

function applyRotationToMatrix(target: mat4, angle: number, generator: (out: mat4, angle: number) => mat4) {
  if (angle === 0) return;
  const r = generator(mat4.create(), angle);
  mat4.multiply(target, r, target);
}

export function applySequentialRotations(vector: vec4, angles: RotationAngles): vec4 {
  const result = vec4.clone(vector);
  rotateXYVec(result, angles.xy);
  rotateXZVec(result, angles.xz);
  rotateYZVec(result, angles.yz);
  rotateXWVec(result, angles.xw);
  rotateYWVec(result, angles.yw);
  rotateZWVec(result, angles.zw);
  return result;
}

export function composeDualQuaternion(angles: RotationAngles): DualQuaternionRotor {
  const left = quat.create();
  const right = quat.create();
  quat.identity(left);
  quat.identity(right);

  applyPlaneRotor(left, right, rotorXY(angles.xy));
  applyPlaneRotor(left, right, rotorXZ(angles.xz));
  applyPlaneRotor(left, right, rotorYZ(angles.yz));
  applyPlaneRotor(left, right, rotorXW(angles.xw));
  applyPlaneRotor(left, right, rotorYW(angles.yw));
  applyPlaneRotor(left, right, rotorZW(angles.zw));

  return { left, right };
}

export function quaternionNormalize(input: quat): quat {
  const output = quat.create();
  quat.normalize(output, input);
  return output;
}

export function applyDualQuaternionRotation(vector: vec4, angles: RotationAngles): vec4 {
  const rotor = composeDualQuaternion(angles);
  const left = quaternionNormalize(rotor.left);
  const right = quaternionNormalize(rotor.right);
  const rightConjugate = quat.create();
  quat.conjugate(rightConjugate, right);

  const qVec = quat.fromValues(vector[0], vector[1], vector[2], vector[3]);
  const tmp = quat.create();
  quat.multiply(tmp, left, qVec);
  const resultQuat = quat.create();
  quat.multiply(resultQuat, tmp, rightConjugate);

  return vec4.fromValues(resultQuat[0], resultQuat[1], resultQuat[2], resultQuat[3]);
}

function rotateXYVec(out: vec4, angle: number): vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = out[0];
  const y = out[1];
  out[0] = x * c - y * s;
  out[1] = x * s + y * c;
  return out;
}

function rotateXZVec(out: vec4, angle: number): vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = out[0];
  const z = out[2];
  out[0] = x * c - z * s;
  out[2] = x * s + z * c;
  return out;
}

function rotateYZVec(out: vec4, angle: number): vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const y = out[1];
  const z = out[2];
  out[1] = y * c - z * s;
  out[2] = y * s + z * c;
  return out;
}

function rotateXWVec(out: vec4, angle: number): vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = out[0];
  const w = out[3];
  out[0] = x * c - w * s;
  out[3] = x * s + w * c;
  return out;
}

function rotateYWVec(out: vec4, angle: number): vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const y = out[1];
  const w = out[3];
  out[1] = y * c - w * s;
  out[3] = y * s + w * c;
  return out;
}

function rotateZWVec(out: vec4, angle: number): vec4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const z = out[2];
  const w = out[3];
  out[2] = z * c - w * s;
  out[3] = z * s + w * c;
  return out;
}

function rotateXYMatrix(out: mat4, angle: number): mat4 {
  mat4.identity(out);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c; out[1] = s;
  out[4] = -s; out[5] = c;
  return out;
}

function rotateXZMatrix(out: mat4, angle: number): mat4 {
  mat4.identity(out);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c; out[2] = s;
  out[8] = -s; out[10] = c;
  return out;
}

function rotateYZMatrix(out: mat4, angle: number): mat4 {
  mat4.identity(out);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[5] = c; out[6] = s;
  out[9] = -s; out[10] = c;
  return out;
}

function rotateXWMatrix(out: mat4, angle: number): mat4 {
  mat4.identity(out);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c; out[3] = s;
  out[12] = -s; out[15] = c;
  return out;
}

function rotateYWMatrix(out: mat4, angle: number): mat4 {
  mat4.identity(out);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[5] = c; out[7] = s;
  out[13] = -s; out[15] = c;
  return out;
}

function rotateZWMatrix(out: mat4, angle: number): mat4 {
  mat4.identity(out);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[10] = c; out[11] = s;
  out[14] = -s; out[15] = c;
  return out;
}

type RotorPair = { left: quat; right: quat };

function applyPlaneRotor(left: quat, right: quat, rotor: RotorPair) {
  quat.multiply(left, rotor.left, left);
  quat.multiply(right, rotor.right, right);
}

function makeRotor(x: number, y: number, z: number, w: number): quat {
  const q = quat.create();
  quat.set(q, x, y, z, w);
  return q;
}

function rotorXY(angle: number): RotorPair {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return { left: makeRotor(0, 0, s, c), right: makeRotor(0, 0, s, c) };
}

function rotorXZ(angle: number): RotorPair {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return { left: makeRotor(0, s, 0, c), right: makeRotor(0, s, 0, c) };
}

function rotorYZ(angle: number): RotorPair {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return { left: makeRotor(s, 0, 0, c), right: makeRotor(s, 0, 0, c) };
}

function rotorXW(angle: number): RotorPair {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return { left: makeRotor(-s, 0, 0, c), right: makeRotor(s, 0, 0, c) };
}

function rotorYW(angle: number): RotorPair {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return { left: makeRotor(0, -s, 0, c), right: makeRotor(0, s, 0, c) };
}

function rotorZW(angle: number): RotorPair {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  return { left: makeRotor(0, 0, -s, c), right: makeRotor(0, 0, s, c) };
}
