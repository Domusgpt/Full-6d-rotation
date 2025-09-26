import { clamp } from '../utils/math';

export type ProjectionMode = 'perspective' | 'stereographic' | 'orthographic';

export interface ProjectionParameters {
  /** For perspective and stereographic projection this acts as the camera depth */
  depth: number;
  /** Minimum denominator to avoid division by zero */
  epsilon: number;
  /** Strength multiplier for stereographic projection */
  stereographicScale: number;
  /** Scale applied during orthographic projection */
  orthographicScale: number;
}

export interface ProjectionUniforms {
  mode: number;
  params: Float32Array;
}

export const DEFAULT_PROJECTION_PARAMETERS: ProjectionParameters = {
  depth: 3,
  epsilon: 0.2,
  stereographicScale: 1,
  orthographicScale: 0.8
};

export function projectionModeToIndex(mode: ProjectionMode): number {
  switch (mode) {
    case 'perspective':
      return 0;
    case 'stereographic':
      return 1;
    case 'orthographic':
      return 2;
    default:
      return 0;
  }
}

export function buildProjectionUniforms(
  mode: ProjectionMode,
  params: ProjectionParameters,
  target: Float32Array = new Float32Array(4)
): ProjectionUniforms {
  const uniforms: ProjectionUniforms = {
    mode: projectionModeToIndex(mode),
    params: target
  };

  const depth = Math.max(params.depth, params.epsilon);
  const epsilon = clamp(params.epsilon, 1e-4, depth);
  const stereoScale = Math.max(params.stereographicScale, 0.01);
  const orthoScale = Math.max(params.orthographicScale, 0.01);

  target[0] = depth;
  target[1] = epsilon;
  target[2] = stereoScale;
  target[3] = orthoScale;

  return uniforms;
}

export function updateProjectionParameter(
  mode: ProjectionMode,
  params: ProjectionParameters,
  value: number
): ProjectionParameters {
  switch (mode) {
    case 'perspective':
      return { ...params, depth: Math.max(value, params.epsilon) };
    case 'stereographic':
      return { ...params, stereographicScale: Math.max(value, 0.01) };
    case 'orthographic':
      return { ...params, orthographicScale: Math.max(value, 0.01) };
    default:
      return params;
  }
}
