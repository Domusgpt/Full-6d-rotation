import type { vec4, vec3 } from 'gl-matrix';
import { vec3 as Vec3 } from 'gl-matrix';

export type ProjectionMode = 'perspective' | 'stereographic' | 'orthographic';

export interface ProjectionParameters {
  distance?: number;
  focalLength?: number;
  stereographicScale?: number;
}

export interface ProjectionConfig {
  mode: ProjectionMode;
  shaderSnippet: string;
  project: (input: vec4) => vec3;
}

export function configureProjection(mode: ProjectionMode, parameters: ProjectionParameters = {}): ProjectionConfig {
  switch (mode) {
    case 'perspective':
      return {
        mode,
        shaderSnippet: perspectiveSnippet(parameters.distance ?? 3.0),
        project: vector => projectPerspective(vector, parameters.distance ?? 3.0)
      };
    case 'stereographic':
      return {
        mode,
        shaderSnippet: stereographicSnippet(parameters.stereographicScale ?? 1.0),
        project: vector => projectStereographic(vector, parameters.stereographicScale ?? 1.0)
      };
    case 'orthographic':
    default:
      return {
        mode: 'orthographic',
        shaderSnippet: orthographicSnippet(),
        project: vector => Vec3.fromValues(vector[0], vector[1], vector[2])
      };
  }
}

function perspectiveSnippet(distance: number): string {
  return `
vec3 project4Dto3D(vec4 v) {
  float depth = max(${distance.toFixed(3)} - v.w, 0.1);
  return v.xyz / depth;
}`.trim();
}

function stereographicSnippet(scale: number): string {
  return `
vec3 project4Dto3D(vec4 v) {
  float denom = max(${scale.toFixed(3)} - v.w, 0.1);
  return v.xyz / denom;
}`.trim();
}

function orthographicSnippet(): string {
  return `
vec3 project4Dto3D(vec4 v) {
  return v.xyz;
}`.trim();
}

function projectPerspective(vector: vec4, distance: number): vec3 {
  const depth = Math.max(distance - vector[3], 0.1);
  return Vec3.fromValues(vector[0] / depth, vector[1] / depth, vector[2] / depth);
}

function projectStereographic(vector: vec4, scale: number): vec3 {
  const denom = Math.max(scale - vector[3], 0.1);
  return Vec3.fromValues(vector[0] / denom, vector[1] / denom, vector[2] / denom);
}
