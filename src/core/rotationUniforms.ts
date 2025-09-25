import type { RotationAngles } from './rotationTypes';
import { composeDualQuaternion } from './dualQuaternion';

const FLOATS_PER_BLOCK = 16; // std140 alignment (vec4 * 4)
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;

export interface RotationUniformOptions {
  /**
   * Blend weight for the dual-quaternion path. 0 = sequential only, 1 = dual only.
   */
  dualBlend?: number;
}

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

  update(angles: RotationAngles, options: RotationUniformOptions = {}) {
    const { data, gl } = this;
    const blend = clamp01(options.dualBlend ?? 0.5);
    const sequentialWeight = 1 - blend;
    const dualWeight = blend;

    const { left, right } = composeDualQuaternion(angles);

    data[0] = angles.xy;
    data[1] = angles.xz;
    data[2] = angles.yz;
    data[3] = sequentialWeight;
    data[4] = angles.xw;
    data[5] = angles.yw;
    data[6] = angles.zw;
    data[7] = dualWeight;
    data[8] = left[0];
    data[9] = left[1];
    data[10] = left[2];
    data[11] = left[3];
    data[12] = right[0];
    data[13] = right[1];
    data[14] = right[2];
    data[15] = right[3];

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  }
}

export { ZERO_ROTATION } from './rotationTypes';

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export type { RotationAngles, RotationSnapshot } from './rotationTypes';
