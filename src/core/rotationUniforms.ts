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

const FLOATS_PER_BLOCK = 48; // 6 vec4 blocks + mat4 + 2 vec4 quaternions
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;
const MATRIX_OFFSET = 24;
const LEFT_QUAT_OFFSET = 40;
const RIGHT_QUAT_OFFSET = 44;

export function packRotationUniformData(
  angles: RotationAngles,
  target: Float32Array,
  matrixOut: mat4,
  leftQuatOut: Float32Array,
  rightQuatOut: Float32Array
) {
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

  const matrix = rotationMatrixFromAngles(angles, matrixOut);
  target.set(matrix, MATRIX_OFFSET);

  const dual = composeDualQuaternion(angles, leftQuatOut, rightQuatOut);
  target.set(dual.left, LEFT_QUAT_OFFSET);
  target.set(dual.right, RIGHT_QUAT_OFFSET);
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

  update(angles: RotationAngles) {
    const { data, gl } = this;
    packRotationUniformData(angles, data, this.matrix, this.leftQuat, this.rightQuat);
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
