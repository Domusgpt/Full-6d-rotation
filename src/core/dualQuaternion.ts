import type { RotationAngles } from './rotationTypes';

export type UnitQuaternion = [number, number, number, number];

export interface DualQuaternion {
  left: UnitQuaternion;
  right: UnitQuaternion;
}

export function composeDualQuaternion(angles: RotationAngles): DualQuaternion {
  const left = normalizeQuaternion(quaternionFromEuler(angles.xy, angles.xz, angles.yz));
  const right = normalizeQuaternion(quaternionFromEuler(angles.xw, angles.yw, angles.zw));
  return { left, right };
}

export function quaternionMultiply(a: UnitQuaternion, b: UnitQuaternion): UnitQuaternion {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];

  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ];
}

export function quaternionConjugate(q: UnitQuaternion): UnitQuaternion {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function applyDualQuaternion(vector: UnitQuaternion, dual: DualQuaternion): UnitQuaternion {
  const left = dual.left;
  const rightConjugate = quaternionConjugate(dual.right);
  return quaternionMultiply(quaternionMultiply(left, vector), rightConjugate);
}

function quaternionFromEuler(ax: number, ay: number, az: number): UnitQuaternion {
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

function normalizeQuaternion(q: UnitQuaternion): UnitQuaternion {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  if (length === 0) {
    return [0, 0, 0, 1];
  }
  const inv = 1 / length;
  return [q[0] * inv, q[1] * inv, q[2] * inv, q[3] * inv];
}

