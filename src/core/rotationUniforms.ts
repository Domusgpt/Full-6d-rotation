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

export interface RotationUniformOverrides {
  spatialSin?: ArrayLike<number>;
  spatialCos?: ArrayLike<number>;
  hyperspatialSin?: ArrayLike<number>;
  hyperspatialCos?: ArrayLike<number>;
  spatialMagnitudes?: ArrayLike<number>;
  hyperspatialMagnitudes?: ArrayLike<number>;
  matrix?: ArrayLike<number>;
  dual?: {
    left: ArrayLike<number>;
    right: ArrayLike<number>;
  };
}

const FLOATS_PER_BLOCK = 60; // 9 vec4 blocks + mat4 + 2 vec4 quaternions
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;
const META_OFFSET = 32;
const MATRIX_OFFSET = 36;
const LEFT_QUAT_OFFSET = 52;
const RIGHT_QUAT_OFFSET = 56;
const MAX_PLANE_ANGLE = Math.PI;

export function packRotationUniformData(
  snapshot: RotationSnapshot,
  target: Float32Array,
  matrixOut: mat4,
  leftQuatOut: Float32Array,
  rightQuatOut: Float32Array,
  overrides: RotationUniformOverrides | null = null
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

  const spatialSin = overrides?.spatialSin;
  const spatialCos = overrides?.spatialCos;
  const hyperspatialSin = overrides?.hyperspatialSin;
  const hyperspatialCos = overrides?.hyperspatialCos;

  const sinXY = spatialSin?.[0] ?? Math.sin(angles.xy);
  const sinXZ = spatialSin?.[1] ?? Math.sin(angles.xz);
  const sinYZ = spatialSin?.[2] ?? Math.sin(angles.yz);
  const sinXW = hyperspatialSin?.[0] ?? Math.sin(angles.xw);
  const sinYW = hyperspatialSin?.[1] ?? Math.sin(angles.yw);
  const sinZW = hyperspatialSin?.[2] ?? Math.sin(angles.zw);

  const cosXY = spatialCos?.[0] ?? Math.cos(angles.xy);
  const cosXZ = spatialCos?.[1] ?? Math.cos(angles.xz);
  const cosYZ = spatialCos?.[2] ?? Math.cos(angles.yz);
  const cosXW = hyperspatialCos?.[0] ?? Math.cos(angles.xw);
  const cosYW = hyperspatialCos?.[1] ?? Math.cos(angles.yw);
  const cosZW = hyperspatialCos?.[2] ?? Math.cos(angles.zw);

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

  const spatialMagnitudes = overrides?.spatialMagnitudes;
  const hyperspatialMagnitudes = overrides?.hyperspatialMagnitudes;

  const normXY = spatialMagnitudes?.[0] ?? Math.min(Math.abs(angles.xy) / MAX_PLANE_ANGLE, 1);
  const normXZ = spatialMagnitudes?.[1] ?? Math.min(Math.abs(angles.xz) / MAX_PLANE_ANGLE, 1);
  const normYZ = spatialMagnitudes?.[2] ?? Math.min(Math.abs(angles.yz) / MAX_PLANE_ANGLE, 1);
  const normXW = hyperspatialMagnitudes?.[0] ?? Math.min(Math.abs(angles.xw) / MAX_PLANE_ANGLE, 1);
  const normYW = hyperspatialMagnitudes?.[1] ?? Math.min(Math.abs(angles.yw) / MAX_PLANE_ANGLE, 1);
  const normZW = hyperspatialMagnitudes?.[2] ?? Math.min(Math.abs(angles.zw) / MAX_PLANE_ANGLE, 1);

  target[24] = normXY;
  target[25] = normXZ;
  target[26] = normYZ;
  target[27] = 0.0;
  target[28] = normXW;
  target[29] = normYW;
  target[30] = normZW;
  target[31] = 0.0;

  const timestampSeconds = snapshot.timestamp * 0.001;
  target[META_OFFSET + 0] = snapshot.confidence;
  target[META_OFFSET + 1] = timestampSeconds;
  target[META_OFFSET + 2] = normSpatialMagnitude(angles);
  target[META_OFFSET + 3] = normHyperspatialMagnitude(angles);

  if (overrides?.matrix) {
    for (let i = 0; i < 16; i += 1) {
      matrixOut[i] = overrides.matrix[i] ?? 0;
    }
    target.set(matrixOut, MATRIX_OFFSET);
  } else {
    const matrix = rotationMatrixFromAngles(angles, matrixOut);
    target.set(matrix, MATRIX_OFFSET);
  }

  if (overrides?.dual) {
    for (let i = 0; i < 4; i += 1) {
      leftQuatOut[i] = overrides.dual.left[i] ?? 0;
      rightQuatOut[i] = overrides.dual.right[i] ?? 0;
    }
    target.set(leftQuatOut, LEFT_QUAT_OFFSET);
    target.set(rightQuatOut, RIGHT_QUAT_OFFSET);
  } else {
    const dual = composeDualQuaternion(angles, leftQuatOut, rightQuatOut);
    target.set(dual.left, LEFT_QUAT_OFFSET);
    target.set(dual.right, RIGHT_QUAT_OFFSET);
  }
}

function normSpatialMagnitude(angles: RotationAngles): number {
  const numerator = Math.abs(angles.xy) + Math.abs(angles.xz) + Math.abs(angles.yz);
  return Math.min(1, numerator / (MAX_PLANE_ANGLE * 3));
}

function normHyperspatialMagnitude(angles: RotationAngles): number {
  const numerator = Math.abs(angles.xw) + Math.abs(angles.yw) + Math.abs(angles.zw);
  return Math.min(1, numerator / (MAX_PLANE_ANGLE * 3));
}

export class RotationUniformBuffer {
  private readonly buffer: WebGLBuffer;
  private readonly data: Float32Array;
  private readonly matrix = mat4.create();
  private readonly leftQuat = new Float32Array(4);
  private readonly rightQuat = new Float32Array(4);

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

  update(snapshot: RotationSnapshot, overrides: RotationUniformOverrides | null = null) {
    const { data, gl } = this;
    packRotationUniformData(snapshot, data, this.matrix, this.leftQuat, this.rightQuat, overrides);
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  }
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
