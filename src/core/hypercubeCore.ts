import { RotationUniformBuffer } from './rotationUniforms';
import type { RotationAngles } from './rotationTypes';
import type { GeometryData } from '../geometry/types';

export interface HypercubeCoreOptions {
  projectionDepth?: number;
  lineWidth?: number;
  matrixBlend?: number;
  dualQuaternionBlend?: number;
}

export class HypercubeCore {
  private readonly gl: WebGL2RenderingContext;
  private readonly rotationBuffer: RotationUniformBuffer;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  private projectionDepth = 3;
  private lineWidth = 1.5;
  private matrixBlend = 1;
  private dualQuaternionBlend = 1;
  private lastTimestamp = 0;
  private animationHandle: number | null = null;

  private uniforms!: {
    projectionDepth: WebGLUniformLocation;
    lineWidth: WebGLUniformLocation;
    time: WebGLUniformLocation;
    matrixBlend: WebGLUniformLocation;
    dualQuaternionBlend: WebGLUniformLocation;
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
    this.matrixBlend = options.matrixBlend ?? this.matrixBlend;
    this.dualQuaternionBlend = options.dualQuaternionBlend ?? this.dualQuaternionBlend;
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

  setMatrixBlend(weight: number) {
    this.matrixBlend = Math.max(0, Math.min(1, weight));
  }

  setDualQuaternionBlend(weight: number) {
    this.dualQuaternionBlend = Math.max(0, Math.min(1, weight));
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
    gl.uniform1f(this.uniforms.matrixBlend, this.matrixBlend);
    gl.uniform1f(this.uniforms.dualQuaternionBlend, this.dualQuaternionBlend);
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
    const matrixBlend = this.gl.getUniformLocation(this.program, 'u_matrixBlend');
    const dualQuaternionBlend = this.gl.getUniformLocation(this.program, 'u_dualQuaternionBlend');
    if (
      projectionDepth === null ||
      lineWidth === null ||
      time === null ||
      matrixBlend === null ||
      dualQuaternionBlend === null
    ) {
      throw new Error('Failed to resolve uniform locations');
    }
    return { projectionDepth, lineWidth, time, matrixBlend, dualQuaternionBlend };
  }
}

const VERTEX_SHADER = `
precision highp float;
layout(location = 0) in vec4 a_position4d;

layout(std140) uniform RotationUniforms {
  mat4 rotationMatrix;
  vec4 spatial;
  vec4 hyperspatial;
  vec4 quatLeft;
  vec4 quatRight;
};

uniform float u_projectionDepth;
uniform float u_lineWidth;
uniform float u_time;
uniform float u_matrixBlend;
uniform float u_dualQuaternionBlend;

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

vec4 applySequential(vec4 v) {
  v = rotateXY(v, spatial.x);
  v = rotateXZ(v, spatial.y);
  v = rotateYZ(v, spatial.z);
  v = rotateXW(v, hyperspatial.x);
  v = rotateYW(v, hyperspatial.y);
  v = rotateZW(v, hyperspatial.z);
  return v;
}

vec4 quatMultiply(vec4 a, vec4 b) {
  return vec4(
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  );
}

vec4 quatConjugate(vec4 q) {
  return vec4(-q.x, -q.y, -q.z, q.w);
}

vec4 applyRotor(vec4 v) {
  vec4 leftNorm = normalize(quatLeft);
  vec4 rightNorm = normalize(quatRight);
  vec4 qVec = v;
  vec4 tmp = quatMultiply(leftNorm, qVec);
  vec4 result = quatMultiply(tmp, quatConjugate(rightNorm));
  return result;
}

void main() {
  vec4 sequential = applySequential(a_position4d);
  vec4 matrixRotated = rotationMatrix * a_position4d;
  vec4 matrixBlendResult = mix(sequential, matrixRotated, clamp(u_matrixBlend, 0.0, 1.0));
  vec4 rotorResult = applyRotor(a_position4d);
  vec4 rotated = mix(matrixBlendResult, rotorResult, clamp(u_dualQuaternionBlend, 0.0, 1.0));

  float depth = max(u_projectionDepth - rotated.w, 0.2);
  vec3 projected = rotated.xyz / depth;
  gl_Position = vec4(projected.xy, projected.z * 0.5, 1.0);
  gl_PointSize = 4.0;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform float u_time;
uniform float u_lineWidth;

out vec4 fragColor;

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

vec3 spectralPalette(float t) {
  float r = 0.5 + 0.5 * sin(6.2831 * (t + 0.0));
  float g = 0.5 + 0.5 * sin(6.2831 * (t + 0.33));
  float b = 0.5 + 0.5 * sin(6.2831 * (t + 0.66));
  return vec3(r, g, b);
}

void main() {
  float hue = mod(u_time * 0.05 + gl_FragCoord.x * 0.0005, 1.0);
  vec3 base = spectralPalette(hue);
  float shimmer = 0.35 + 0.65 * sin(u_time * 0.9 + gl_FragCoord.y * 0.004);
  vec3 color = mix(base, vec3(luma(base)), 0.25) * shimmer;
  fragColor = vec4(color, 1.0);
}
`;
