import { RotationUniformBuffer, type RotationAngles } from './rotationUniforms';
import { StyleUniformBuffer, type RotationDynamics, ZERO_DYNAMICS } from './styleUniforms';
import type { GeometryData } from '../geometry/types';

export interface HypercubeCoreOptions {
  projectionDepth?: number;
  lineWidth?: number;
}

export class HypercubeCore {
  private readonly gl: WebGL2RenderingContext;
  private readonly rotationBuffer: RotationUniformBuffer;
  private readonly styleBuffer: StyleUniformBuffer;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null = null;
  private indexCount = 0;
  private projectionDepth = 3;
  private lineWidth = 1.5;
  private dynamicLineScale = 1;
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
    this.styleBuffer = new StyleUniformBuffer(gl);
    this.projectionDepth = options.projectionDepth ?? this.projectionDepth;
    this.lineWidth = options.lineWidth ?? this.lineWidth;
    this.program = this.createProgram();
    this.rotationBuffer.bind(this.program);
    this.styleBuffer.bind(this.program);
    this.styleBuffer.update(ZERO_DYNAMICS);
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

  updateDynamics(dynamics: RotationDynamics) {
    this.dynamicLineScale = dynamics.thickness;
    this.styleBuffer.update(dynamics);
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
    const modulatedLineWidth = this.lineWidth * this.dynamicLineScale;
    gl.uniform1f(this.uniforms.lineWidth, modulatedLineWidth);
    gl.uniform1f(this.uniforms.time, time);
    gl.lineWidth(Math.max(1, Math.min(modulatedLineWidth, 8)));

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
  mat4 rotationMatrix;
  vec4 quatLeft;
  vec4 quatRight;
};

layout(std140) uniform StyleUniforms {
  vec4 metricsA; // energy, spatial, hyperspatial, harmonic
  vec4 metricsB; // saturation, brightness, thickness, chaos
};

uniform float u_projectionDepth;
uniform float u_lineWidth;
uniform float u_time;

out vec3 v_color;
out float v_depth;
out float v_energy;
out float v_thickness;
out float v_chaos;
out float v_harmonic;
out float v_isoclinic;
out float v_chiral;

vec3 spectralPalette(float parameter) {
  float hue = parameter;
  return vec3(
    0.60 + 0.38 * cos(6.2831 * hue),
    0.62 + 0.36 * cos(6.2831 * hue + 2.094),
    0.64 + 0.34 * cos(6.2831 * hue + 4.188)
  );
}

vec2 rotatePlane(vec2 plane, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(
    plane.x * c - plane.y * s,
    plane.x * s + plane.y * c
  );
}

vec4 applySixPlaneRotation(vec4 position, vec4 spatialAngles, vec4 hyperAngles) {
  vec4 rotated = position;

  vec2 pairXY = rotatePlane(rotated.xy, spatialAngles.x);
  rotated.x = pairXY.x;
  rotated.y = pairXY.y;

  vec2 pairXZ = rotatePlane(vec2(rotated.x, rotated.z), spatialAngles.y);
  rotated.x = pairXZ.x;
  rotated.z = pairXZ.y;

  vec2 pairYZ = rotatePlane(vec2(rotated.y, rotated.z), spatialAngles.z);
  rotated.y = pairYZ.x;
  rotated.z = pairYZ.y;

  vec2 pairXW = rotatePlane(vec2(rotated.x, rotated.w), hyperAngles.x);
  rotated.x = pairXW.x;
  rotated.w = pairXW.y;

  vec2 pairYW = rotatePlane(vec2(rotated.y, rotated.w), hyperAngles.y);
  rotated.y = pairYW.x;
  rotated.w = pairYW.y;

  vec2 pairZW = rotatePlane(vec2(rotated.z, rotated.w), hyperAngles.z);
  rotated.z = pairZW.x;
  rotated.w = pairZW.y;

  return rotated;
}

void main() {
  vec4 rotated = applySixPlaneRotation(a_position4d, spatial, hyperspatial);
  vec4 matrixProjected = rotationMatrix * a_position4d;
  float depth = max(u_projectionDepth - rotated.w, 0.2);
  vec3 projected = rotated.xyz / depth;
  gl_Position = vec4(projected.xy, projected.z * 0.5, 1.0);
  gl_PointSize = 4.0;

  float energy = metricsA.x;
  float harmonicBase = metricsA.w;
  float saturation = metricsB.x;
  float brightness = metricsB.y;
  float thickness = metricsB.z;
  float chaos = metricsB.w;

  float isoclinicDot = clamp(dot(quatLeft, quatRight), -1.0, 1.0);
  float isoPhase = isoclinicDot * 0.5 + 0.5;
  vec3 leftVec = quatLeft.xyz;
  vec3 rightVec = quatRight.xyz;
  float chiralSpread = length(leftVec - rightVec);
  float chiralTone = smoothstep(0.0, 1.4, clamp(chiralSpread, 0.0, 2.0));

  float hueShift = chaos * 0.12 + energy * 0.08 + (isoPhase - 0.5) * 0.18;
  float isoSaturation = clamp(saturation + (isoPhase - 0.5) * 0.22, 0.0, 1.0);
  float isoBrightness = clamp(brightness + (1.0 - chiralTone) * 0.12, 0.0, 1.0);
  float isoThickness = thickness * (1.0 + chiralTone * 0.45);
  float isoChaos = clamp(chaos + chiralTone * 0.35, 0.0, 1.0);
  float isoEnergy = clamp(mix(energy, 1.0, chiralTone * 0.15), 0.0, 1.0);

  float geometricMix = dot(rotated, vec4(0.12, 0.18, 0.24, 0.3));
  geometricMix += dot(matrixProjected, rotated) * 0.01;
  float harmonic = fract(harmonicBase + geometricMix * 0.12 + isoPhase * 0.33);
  vec3 baseColor = spectralPalette(fract(harmonic + hueShift));
  vec3 neutral = vec3(isoBrightness);
  float contour = 0.35 + 0.65 * smoothstep(0.0, u_projectionDepth, depth);

  v_color = mix(neutral, baseColor, isoSaturation) * contour;
  v_depth = depth;
  v_energy = isoEnergy;
  v_thickness = isoThickness;
  v_chaos = isoChaos;
  v_harmonic = harmonic;
  v_isoclinic = isoPhase;
  v_chiral = chiralTone;
}
`;

const FRAGMENT_SHADER = `
precision highp float;

layout(std140) uniform StyleUniforms {
  vec4 metricsA;
  vec4 metricsB;
};

uniform float u_time;
uniform float u_lineWidth;

in vec3 v_color;
in float v_depth;
in float v_energy;
in float v_thickness;
in float v_chaos;
in float v_harmonic;
in float v_isoclinic;
in float v_chiral;

out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float energy = v_energy;
  float chaos = v_chaos;
  float harmonic = v_harmonic;
  float shimmerBase = 0.65 + 0.35 * sin(u_time * (0.9 + energy * 0.8) + harmonic * 6.2831);
  float shimmer = shimmerBase * mix(0.85, 1.22, v_isoclinic);
  float depthFade = smoothstep(1.2, 0.1, v_depth);
  float noiseSample = hash(gl_FragCoord.xy * (0.003 + chaos * 0.02));
  float noise = mix(-0.08, 0.14, noiseSample) * chaos * mix(0.45, 1.05, v_chiral);
  float widthPulse = 0.82 + 0.38 * sin(u_time * (1.3 + v_isoclinic * 0.7) + v_thickness * 1.05);

  vec3 color = (v_color + vec3(0.08, 0.15, 0.32) * v_chiral) * shimmer * (0.7 + depthFade * 0.5);
  color += vec3(noise);
  float alpha = clamp(0.24 + energy * 0.58 + chaos * 0.17 + v_chiral * 0.2, 0.2, 1.0);

  fragColor = vec4(color * widthPulse, alpha);
}
`;
