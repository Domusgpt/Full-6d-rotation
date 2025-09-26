export interface RotationDynamics {
  /** Combined six-plane energy, normalized 0..1 */
  energy: number;
  /** Spatial-plane energy (XY/XZ/YZ), normalized 0..1 */
  spatial: number;
  /** Hyperspatial-plane energy (XW/YW/ZW), normalized 0..1 */
  hyperspatial: number;
  /** Harmonic index 0..1 derived from plane interference */
  harmonic: number;
  /** Saturation weighting for color mix 0..1 */
  saturation: number;
  /** Brightness weighting 0..1 */
  brightness: number;
  /** Dynamic line thickness multiplier (approximately 0.5..2.5) */
  thickness: number;
  /** Chaotic modulation 0..1 used for shimmer/noise */
  chaos: number;
}

export const ZERO_DYNAMICS: RotationDynamics = {
  energy: 0,
  spatial: 0,
  hyperspatial: 0,
  harmonic: 0.5,
  saturation: 0,
  brightness: 0.35,
  thickness: 1,
  chaos: 0
};

const FLOATS_PER_BLOCK = 8; // vec4 + vec4
const BLOCK_SIZE_BYTES = FLOATS_PER_BLOCK * 4;

export class StyleUniformBuffer {
  private readonly buffer: WebGLBuffer;
  private readonly data: Float32Array;

  constructor(private readonly gl: WebGL2RenderingContext) {
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to allocate style uniform buffer');
    }
    this.buffer = buffer;
    this.data = new Float32Array(FLOATS_PER_BLOCK);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, BLOCK_SIZE_BYTES, gl.DYNAMIC_DRAW);
  }

  bind(program: WebGLProgram, blockName = 'StyleUniforms', bindingIndex = 1) {
    const { gl } = this;
    const blockIndex = gl.getUniformBlockIndex(program, blockName);
    if (blockIndex === gl.INVALID_INDEX) {
      throw new Error(`Program is missing uniform block ${blockName}`);
    }
    gl.uniformBlockBinding(program, blockIndex, bindingIndex);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingIndex, this.buffer);
  }

  update(dynamics: RotationDynamics) {
    const { data, gl } = this;
    data[0] = dynamics.energy;
    data[1] = dynamics.spatial;
    data[2] = dynamics.hyperspatial;
    data[3] = dynamics.harmonic;
    data[4] = dynamics.saturation;
    data[5] = dynamics.brightness;
    data[6] = dynamics.thickness;
    data[7] = dynamics.chaos;

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  }
}
