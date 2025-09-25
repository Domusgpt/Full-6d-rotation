import type { RotationAngles } from './rotationTypes';
import { composeDualQuaternion, rotationMatrixFromAngles, quaternionNormalize } from './so4';

const FLOATS_PER_BLOCK = 32; // mat4 + 4 vec4 entries
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;

const MATRIX_OFFSET = 0;
const SPATIAL_OFFSET = 16;
const HYPER_OFFSET = 20;
const LEFT_QUAT_OFFSET = 24;
const RIGHT_QUAT_OFFSET = 28;

export class RotationUniformBuffer {
  private readonly buffer: WebGLBuffer;
  private readonly data: Float32Array;

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
    const rotationMatrix = rotationMatrixFromAngles(angles);
    data.set(rotationMatrix, MATRIX_OFFSET);

    data[SPATIAL_OFFSET + 0] = angles.xy;
    data[SPATIAL_OFFSET + 1] = angles.xz;
    data[SPATIAL_OFFSET + 2] = angles.yz;
    data[SPATIAL_OFFSET + 3] = 0.0;

    data[HYPER_OFFSET + 0] = angles.xw;
    data[HYPER_OFFSET + 1] = angles.yw;
    data[HYPER_OFFSET + 2] = angles.zw;
    data[HYPER_OFFSET + 3] = 0.0;

    const { left, right } = composeDualQuaternion(angles);
    const leftQuat = quaternionNormalize(left);
    const rightQuat = quaternionNormalize(right);

    data[LEFT_QUAT_OFFSET + 0] = leftQuat[0];
    data[LEFT_QUAT_OFFSET + 1] = leftQuat[1];
    data[LEFT_QUAT_OFFSET + 2] = leftQuat[2];
    data[LEFT_QUAT_OFFSET + 3] = leftQuat[3];

    data[RIGHT_QUAT_OFFSET + 0] = rightQuat[0];
    data[RIGHT_QUAT_OFFSET + 1] = rightQuat[1];
    data[RIGHT_QUAT_OFFSET + 2] = rightQuat[2];
    data[RIGHT_QUAT_OFFSET + 3] = rightQuat[3];

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  }
}
