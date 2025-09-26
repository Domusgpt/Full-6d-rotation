import { describe, expect, it } from 'vitest';
import { configureProjection } from './projectionBridge';
import { vec4 } from 'gl-matrix';

describe('ProjectionBridge', () => {
  it('provides orthographic projection identity', () => {
    const { project } = configureProjection('orthographic');
    const input = vec4.fromValues(1, 2, 3, 4);
    const result = project(input);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it('applies perspective depth scaling', () => {
    const { project } = configureProjection('perspective', { distance: 5 });
    const input = vec4.fromValues(1, 1, 1, 1);
    const result = project(input);
    expect(result[0]).toBeCloseTo(1 / 4);
    expect(result[2]).toBeCloseTo(1 / 4);
  });
});
