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

const FLOATS_PER_BLOCK = 8; // std140 alignment (vec4 + vec4)
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;

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
    data[0] = angles.xy;
    data[1] = angles.xz;
    data[2] = angles.yz;
    data[3] = 0.0; // padding
    data[4] = angles.xw;
    data[5] = angles.yw;
    data[6] = angles.zw;
    data[7] = 0.0; // padding

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
