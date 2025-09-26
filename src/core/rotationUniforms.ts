import { mat4 } from 'gl-matrix';
import { composeDualQuaternion, rotationMatrixFromAngles } from './so4';

export interface RotationAngles {
  xy: number;
  xz: number;
  yz: number;
  xw: number;
  yw: number;
  zw: number;
}

export interface RotationSnapshot extends RotationAngles {
  timestamp: number;
  confidence: number;
}

export interface RotationDualQuaternion {
  left: Float32Array;
  right: Float32Array;
}

const FLOATS_PER_BLOCK = 68; // 11 vec4 blocks + mat4 + 2 vec4 quaternions
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;
const META_OFFSET = 40;
const MATRIX_OFFSET = 44;
const LEFT_QUAT_OFFSET = 60;
const RIGHT_QUAT_OFFSET = 64;
const MAX_PLANE_ANGLE = Math.PI;
const TAU = Math.PI * 2;
const MIN_TIME_DELTA = 1e-6;
const MAX_ANGULAR_VELOCITY = Math.PI * 12; // rad/s clamp for stability

export function packRotationUniformData(
  snapshot: RotationSnapshot,
  target: Float32Array,
  matrixOut: mat4,
  leftQuatOut: Float32Array,
  rightQuatOut: Float32Array,
  previous: RotationSnapshot | null = null
) {
  const angles = snapshot;
  target[0] = angles.xy;
  target[1] = angles.xz;
  target[2] = angles.yz;
  target[3] = 0.0; // padding
  target[4] = angles.xw;
  target[5] = angles.yw;
  target[6] = angles.zw;
  target[7] = 0.0; // padding

  const sinXY = Math.sin(angles.xy);
  const sinXZ = Math.sin(angles.xz);
  const sinYZ = Math.sin(angles.yz);
  const sinXW = Math.sin(angles.xw);
  const sinYW = Math.sin(angles.yw);
  const sinZW = Math.sin(angles.zw);

  const cosXY = Math.cos(angles.xy);
  const cosXZ = Math.cos(angles.xz);
  const cosYZ = Math.cos(angles.yz);
  const cosXW = Math.cos(angles.xw);
  const cosYW = Math.cos(angles.yw);
  const cosZW = Math.cos(angles.zw);

  target[8] = sinXY;
  target[9] = sinXZ;
  target[10] = sinYZ;
  target[11] = 0.0;
  target[12] = cosXY;
  target[13] = cosXZ;
  target[14] = cosYZ;
  target[15] = 0.0;
  target[16] = sinXW;
  target[17] = sinYW;
  target[18] = sinZW;
  target[19] = 0.0;
  target[20] = cosXW;
  target[21] = cosYW;
  target[22] = cosZW;
  target[23] = 0.0;

  const normXY = Math.min(Math.abs(angles.xy) / MAX_PLANE_ANGLE, 1);
  const normXZ = Math.min(Math.abs(angles.xz) / MAX_PLANE_ANGLE, 1);
  const normYZ = Math.min(Math.abs(angles.yz) / MAX_PLANE_ANGLE, 1);
  const normXW = Math.min(Math.abs(angles.xw) / MAX_PLANE_ANGLE, 1);
  const normYW = Math.min(Math.abs(angles.yw) / MAX_PLANE_ANGLE, 1);
  const normZW = Math.min(Math.abs(angles.zw) / MAX_PLANE_ANGLE, 1);

  target[24] = normXY;
  target[25] = normXZ;
  target[26] = normYZ;
  target[27] = 0.0;
  target[28] = normXW;
  target[29] = normYW;
  target[30] = normZW;
  target[31] = 0.0;

  const velocities = computeAngularVelocities(snapshot, previous);
  target[32] = velocities.xy;
  target[33] = velocities.xz;
  target[34] = velocities.yz;
  target[35] = 0.0;
  target[36] = velocities.xw;
  target[37] = velocities.yw;
  target[38] = velocities.zw;
  target[39] = 0.0;

  const timestampSeconds = snapshot.timestamp * 0.001;
  target[META_OFFSET + 0] = snapshot.confidence;
  target[META_OFFSET + 1] = timestampSeconds;
  target[META_OFFSET + 2] = normSpatialMagnitude(angles);
  target[META_OFFSET + 3] = normHyperspatialMagnitude(angles);

  const matrix = rotationMatrixFromAngles(angles, matrixOut);
  target.set(matrix, MATRIX_OFFSET);

  const dual = composeDualQuaternion(angles, leftQuatOut, rightQuatOut);
  target.set(dual.left, LEFT_QUAT_OFFSET);
  target.set(dual.right, RIGHT_QUAT_OFFSET);
}

function normSpatialMagnitude(angles: RotationAngles): number {
  const numerator = Math.abs(angles.xy) + Math.abs(angles.xz) + Math.abs(angles.yz);
  return Math.min(1, numerator / (MAX_PLANE_ANGLE * 3));
}

function normHyperspatialMagnitude(angles: RotationAngles): number {
  const numerator = Math.abs(angles.xw) + Math.abs(angles.yw) + Math.abs(angles.zw);
  return Math.min(1, numerator / (MAX_PLANE_ANGLE * 3));
}

function computeAngularVelocities(
  snapshot: RotationSnapshot,
  previous: RotationSnapshot | null
): RotationAngles {
  if (!previous) {
    return { ...ZERO_ROTATION };
  }

  const dt = (snapshot.timestamp - previous.timestamp) * 0.001;
  if (!Number.isFinite(dt) || dt <= MIN_TIME_DELTA) {
    return { ...ZERO_ROTATION };
  }

  return {
    xy: clampVelocity(shortestAngleDelta(snapshot.xy, previous.xy) / dt),
    xz: clampVelocity(shortestAngleDelta(snapshot.xz, previous.xz) / dt),
    yz: clampVelocity(shortestAngleDelta(snapshot.yz, previous.yz) / dt),
    xw: clampVelocity(shortestAngleDelta(snapshot.xw, previous.xw) / dt),
    yw: clampVelocity(shortestAngleDelta(snapshot.yw, previous.yw) / dt),
    zw: clampVelocity(shortestAngleDelta(snapshot.zw, previous.zw) / dt)
  };
}

function shortestAngleDelta(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return 0;
  }
  let delta = current - previous;
  if (!Number.isFinite(delta)) {
    return 0;
  }
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

function clampVelocity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value > MAX_ANGULAR_VELOCITY) return MAX_ANGULAR_VELOCITY;
  if (value < -MAX_ANGULAR_VELOCITY) return -MAX_ANGULAR_VELOCITY;
  return value;
}

export class RotationUniformBuffer {
  private readonly buffer: WebGLBuffer;
  private readonly data: Float32Array;
  private readonly matrix = mat4.create();
  private readonly leftQuat = new Float32Array(4);
  private readonly rightQuat = new Float32Array(4);
  private readonly previousSnapshot: RotationSnapshot = { ...ZERO_SNAPSHOT };
  private hasPrevious = false;

  constructor(private readonly gl: WebGL2RenderingContext) {
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to allocate rotation uniform buffer');
    }
    this.buffer = buffer;
    this.data = new Float32Array(FLOATS_PER_BLOCK);

    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, BLOCK_SIZE_BYTES, gl.DYNAMIC_DRAW);
  }

  bind(program: WebGLProgram, blockName = 'RotationUniforms', bindingIndex = 0) {
    const { gl } = this;
    const blockIndex = gl.getUniformBlockIndex(program, blockName);
    if (blockIndex === gl.INVALID_INDEX) {
      throw new Error(`Program is missing uniform block ${blockName}`);
    }
    gl.uniformBlockBinding(program, blockIndex, bindingIndex);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingIndex, this.buffer);
  }

  update(snapshot: RotationSnapshot) {
    const { data, gl } = this;
    const previous = this.hasPrevious ? this.previousSnapshot : null;
    packRotationUniformData(snapshot, data, this.matrix, this.leftQuat, this.rightQuat, previous);
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
    copySnapshot(this.previousSnapshot, snapshot);
    this.hasPrevious = true;
  }
}

function copySnapshot(target: RotationSnapshot, source: RotationSnapshot) {
  target.xy = source.xy;
  target.xz = source.xz;
  target.yz = source.yz;
  target.xw = source.xw;
  target.yw = source.yw;
  target.zw = source.zw;
  target.timestamp = source.timestamp;
  target.confidence = source.confidence;
}

export const ZERO_ROTATION: RotationAngles = {
  xy: 0,
  xz: 0,
  yz: 0,
  xw: 0,
  yw: 0,
  zw: 0
};

export const ZERO_SNAPSHOT: RotationSnapshot = {
  ...ZERO_ROTATION,
  timestamp: 0,
  confidence: 1
};
