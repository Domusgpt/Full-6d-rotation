import { describe, expect, it } from 'vitest';
import {
  buildProjectionUniforms,
  DEFAULT_PROJECTION_PARAMETERS,
  projectionModeToIndex,
  type ProjectionMode,
  updateProjectionParameter
} from './projectionBridge';

const MODES: ProjectionMode[] = ['perspective', 'stereographic', 'orthographic'];

describe('projectionBridge', () => {
  it('maps projection modes to stable indices', () => {
    const indices = MODES.map((mode) => projectionModeToIndex(mode));
    expect(new Set(indices).size).toBe(MODES.length);
    for (const index of indices) {
      expect(index).toBeGreaterThanOrEqual(0);
    }
  });

  it('builds uniform data with sane defaults', () => {
    const target = new Float32Array(4);
    const { mode, params } = buildProjectionUniforms('perspective', DEFAULT_PROJECTION_PARAMETERS, target);
    expect(mode).toBe(projectionModeToIndex('perspective'));
    expect(params).toBe(target);
    expect(params[0]).toBeGreaterThan(params[1]);
    expect(params[2]).toBeGreaterThan(0);
    expect(params[3]).toBeGreaterThan(0);
  });

  it('updates projection parameters based on mode', () => {
    let params = { ...DEFAULT_PROJECTION_PARAMETERS };
    params = updateProjectionParameter('perspective', params, 4);
    expect(params.depth).toBe(4);

    params = updateProjectionParameter('stereographic', params, 2.5);
    expect(params.stereographicScale).toBeCloseTo(2.5);

    params = updateProjectionParameter('orthographic', params, 1.2);
    expect(params.orthographicScale).toBeCloseTo(1.2);
  });
});
