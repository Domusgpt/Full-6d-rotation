import { RotationUniformBuffer, type RotationAngles } from './rotationUniforms';
import type { GeometryData } from '../geometry/types';

export interface HypercubeCoreOptions {
  projectionDepth?: number;
  lineWidth?: number;
}

export class HypercubeCore {
  private readonly gl: WebGL2RenderingContext;
  private readonly rotationBuffer: RotationUniformBuffer;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  private projectionDepth = 3;
  private lineWidth = 1.5;
  private lastTimestamp = 0;
  private animationHandle: number | null = null;

  private uniforms!: {
    projectionDepth: WebGLUniformLocation;
    lineWidth: WebGLUniformLocation;
    time: WebGLUniformLocation;
  };

  constructor(private readonly canvas: HTMLCanvasElement, options: HypercubeCoreOptions = {}) {
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('WebGL2 is required for HypercubeCore.');
    }
    this.gl = gl;
    this.rotationBuffer = new RotationUniformBuffer(gl);
    this.projectionDepth = options.projectionDepth ?? this.projectionDepth;
    this.lineWidth = options.lineWidth ?? this.lineWidth;
    this.program = this.createProgram();
    this.rotationBuffer.bind(this.program);
    this.uniforms = this.getUniformLocations();
    this.configureContext();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setProjectionDepth(depth: number) {
    this.projectionDepth = depth;
  }

  setLineWidth(width: number) {
    this.lineWidth = width;
  }

  setGeometry(geometry: GeometryData) {
    const { gl } = this;
    if (!this.vao) {
      this.vao = gl.createVertexArray();
    }
    gl.bindVertexArray(this.vao);

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      throw new Error('Failed to create vertex buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, geometry.vertexStride, gl.FLOAT, false, 0, 0);

    const indexBuffer = gl.createBuffer();
    if (!indexBuffer) {
      throw new Error('Failed to create index buffer');
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

    this.indexCount = geometry.indices.length;
    gl.bindVertexArray(null);
  }

  updateRotation(angles: RotationAngles) {
    this.rotationBuffer.update(angles);
  }

  start() {
    if (this.animationHandle !== null) return;
    const loop = (timestamp: number) => {
      if (this.lastTimestamp === 0) {
        this.lastTimestamp = timestamp;
      }
      const dt = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;
      this.render(timestamp * 0.001, dt);
      this.animationHandle = requestAnimationFrame(loop);
    };
    this.animationHandle = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  private render(time: number, deltaTime: number) {
    const { gl } = this;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniform1f(this.uniforms.projectionDepth, this.projectionDepth);
    gl.uniform1f(this.uniforms.lineWidth, this.lineWidth);
    gl.uniform1f(this.uniforms.time, time);
    gl.lineWidth(this.lineWidth);

    gl.drawElements(gl.LINES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  private configureContext() {
    const { gl } = this;
    gl.clearColor(0.01, 0.01, 0.04, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.lineWidth(this.lineWidth);
  }

  private resize() {
    const { canvas } = this.gl;
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
    const displayHeight = Math.floor(this.canvas.clientHeight * dpr);
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
  }

  private createProgram(): WebGLProgram {
    const vertexSource = `#version 300 es\n${VERTEX_SHADER}`;
    const fragmentSource = `#version 300 es\n${FRAGMENT_SHADER}`;
    const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('Unable to create shader program');
    }
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${this.gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Unable to allocate shader');
    }
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${this.gl.getShaderInfoLog(shader)}\n${source}`);
    }
    return shader;
  }

  private getUniformLocations() {
    const projectionDepth = this.gl.getUniformLocation(this.program, 'u_projectionDepth');
    const lineWidth = this.gl.getUniformLocation(this.program, 'u_lineWidth');
    const time = this.gl.getUniformLocation(this.program, 'u_time');
    if (!projectionDepth || !lineWidth || !time) {
      throw new Error('Failed to resolve uniform locations');
    }
    return { projectionDepth, lineWidth, time };
  }
}

const VERTEX_SHADER = `
precision highp float;
layout(location = 0) in vec4 a_position4d;

layout(std140) uniform RotationUniforms {
  vec4 spatial;    // xy, xz, yz, padding
  vec4 hyperspatial; // xw, yw, zw, padding
};

uniform float u_projectionDepth;
uniform float u_lineWidth;
uniform float u_time;

out vec3 v_color;
out float v_depth;

vec4 rotateXY(vec4 v, float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return vec4(
    v.x * c - v.y * s,
    v.x * s + v.y * c,
    v.z,
    v.w
  );
}

vec4 rotateXZ(vec4 v, float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return vec4(
    v.x * c - v.z * s,
    v.y,
    v.x * s + v.z * c,
    v.w
  );
}

vec4 rotateYZ(vec4 v, float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return vec4(
    v.x,
    v.y * c - v.z * s,
    v.y * s + v.z * c,
    v.w
  );
}

vec4 rotateXW(vec4 v, float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return vec4(
    v.x * c - v.w * s,
    v.y,
    v.z,
    v.x * s + v.w * c
  );
}

vec4 rotateYW(vec4 v, float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return vec4(
    v.x,
    v.y * c - v.w * s,
    v.z,
    v.y * s + v.w * c
  );
}

vec4 rotateZW(vec4 v, float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return vec4(
    v.x,
    v.y,
    v.z * c - v.w * s,
    v.z * s + v.w * c
  );
}

vec4 applyRotations(vec4 v) {
  v = rotateXY(v, spatial.x);
  v = rotateXZ(v, spatial.y);
  v = rotateYZ(v, spatial.z);
  v = rotateXW(v, hyperspatial.x);
  v = rotateYW(v, hyperspatial.y);
  v = rotateZW(v, hyperspatial.z);
  return v;
}

vec3 spectralPalette(float parameter) {
  float hue = parameter;
  return vec3(
    0.60 + 0.38 * cos(6.2831 * hue),
    0.62 + 0.36 * cos(6.2831 * hue + 2.094),
    0.64 + 0.34 * cos(6.2831 * hue + 4.188)
  );
}

void main() {
  vec4 rotated = applyRotations(a_position4d);
  float depth = max(u_projectionDepth - rotated.w, 0.2);
  vec3 projected = rotated.xyz / depth;
  gl_Position = vec4(projected.xy, projected.z * 0.5, 1.0);
  gl_PointSize = 4.0;

  v_depth = depth;
  float harmonic = 0.5 + 0.5 * sin(u_time * 0.3 + rotated.w * 1.2);
  float contour = 0.35 + 0.65 * smoothstep(0.0, u_projectionDepth, depth);
  v_color = spectralPalette(harmonic) * contour;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform float u_time;
uniform float u_lineWidth;

in vec3 v_color;
in float v_depth;

out vec4 fragColor;

void main() {
  float shimmer = 0.75 + 0.25 * sin(u_time * 0.7 + v_depth * 0.5);
  fragColor = vec4(v_color * shimmer, 1.0);
}
`;
