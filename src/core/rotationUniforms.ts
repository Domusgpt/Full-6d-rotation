import { mat4 } from 'gl-matrix';
import { rotationMatrixFromAngles, composeDualQuaternion } from './so4';
import type { RotationAngles } from './rotationTypes';

export type { RotationAngles } from './rotationTypes';

const FLOATS_PER_BLOCK = 32; // mat4 (16) + 4 vec4 blocks
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;

export class RotationUniformBuffer {
  private readonly buffer: WebGLBuffer;
  private readonly data: Float32Array;
  private readonly matrix = mat4.create();

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
    const matrix = rotationMatrixFromAngles(angles, this.matrix);
    const { left, right } = composeDualQuaternion(angles);

    data.set(matrix, 0);

    data[16] = angles.xy;
    data[17] = angles.xz;
    data[18] = angles.yz;
    data[19] = 0.0;

    data[20] = angles.xw;
    data[21] = angles.yw;
    data[22] = angles.zw;
    data[23] = 0.0;

    data.set(left, 24);
    data.set(right, 28);

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  }
}
