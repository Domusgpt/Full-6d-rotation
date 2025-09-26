import { describe, expect, it } from 'vitest';
import type { RotationSnapshot } from '../core/rotationUniforms';
import { SIX_PLANE_KEYS } from '../core/sixPlaneOrbit';
import { createConfidenceFloorFilter, createSmoothingFilter } from './parserFilters';

function createSnapshot(value: number): RotationSnapshot {
  return {
    xy: value,
    xz: value,
    yz: value,
    xw: value,
    yw: value,
    zw: value,
    timestamp: 0,
    confidence: 1
  };
}

describe('createSmoothingFilter', () => {
  it('blends incoming rotation with previous frame', () => {
    const filter = createSmoothingFilter({ alpha: 0.5 });
    const channels = new Float32Array(SIX_PLANE_KEYS.length);

    const firstFrame = {
      frameId: 0,
      timestamp: 0,
      rotation: createSnapshot(1),
      channels,
      confidence: 1
    } as const;

    const firstResult = filter(firstFrame);
    expect(firstResult.rotation.xy).toBeCloseTo(1);

    const secondFrame = {
      frameId: 1,
      timestamp: 16,
      rotation: createSnapshot(0),
      channels,
      confidence: 1
    } as const;

    const secondResult = filter(secondFrame);
    expect(secondResult.rotation.xy).toBeCloseTo(0.5);
    for (let i = 0; i < SIX_PLANE_KEYS.length; i += 1) {
      expect(channels[i]).toBeCloseTo(0.5);
    }
  });

  it('respects max delta constraints', () => {
    const filter = createSmoothingFilter({ alpha: 1, maxDelta: 0.1 });
    const channels = new Float32Array(SIX_PLANE_KEYS.length);

    filter({
      frameId: 0,
      timestamp: 0,
      rotation: createSnapshot(0),
      channels,
      confidence: 1
    });

    const result = filter({
      frameId: 1,
      timestamp: 10,
      rotation: createSnapshot(Math.PI),
      channels,
      confidence: 1
    });

    expect(result.rotation.xy).toBeCloseTo(0.1);
  });
});

describe('createConfidenceFloorFilter', () => {
  it('applies configured minimum confidence', () => {
    const filter = createConfidenceFloorFilter({ minimum: 0.4 });
    const frame = {
      frameId: 0,
      timestamp: 0,
      rotation: createSnapshot(0),
      channels: new Float32Array(SIX_PLANE_KEYS.length),
      confidence: 0.1
    } as const;

    const result = filter(frame);
    expect(result.confidence).toBeCloseTo(0.4);
    expect(result.rotation.confidence).toBeCloseTo(0.4);
  });
});

