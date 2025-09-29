import { describe, expect, it } from 'vitest';
import type { RotationAngles } from './rotationUniforms';
import {
  SIX_PLANE_KEYS,
  UNIT_PLANE_WEIGHTS,
  applyPlaneWeights,
  applyPlaneWeightsToSnapshot,
  clonePlaneWeights,
  cloneRotationAngles,
  createPlaneWeights,
  isUnitPlaneWeights,
  mergePlaneWeights,
  readRotationChannels,
  writeRotationChannels
} from './rotationPlanes';

const SAMPLE: RotationAngles = {
  xy: 0.25,
  xz: -0.5,
  yz: 0.75,
  xw: -1.0,
  yw: 1.25,
  zw: -1.5
};

describe('rotationPlanes helpers', () => {
  it('writes angles into a contiguous channel buffer', () => {
    const buffer = new Float32Array(16);
    writeRotationChannels(buffer, SAMPLE, 2);
    expect(buffer[2]).toBeCloseTo(SAMPLE.xy);
    expect(buffer[3]).toBeCloseTo(SAMPLE.xz);
    expect(buffer[4]).toBeCloseTo(SAMPLE.yz);
    expect(buffer[5]).toBeCloseTo(SAMPLE.xw);
    expect(buffer[6]).toBeCloseTo(SAMPLE.yw);
    expect(buffer[7]).toBeCloseTo(SAMPLE.zw);
  });

  it('reads angles from a channel buffer', () => {
    const buffer = new Float32Array(6);
    writeRotationChannels(buffer, SAMPLE);
    const result = readRotationChannels(buffer);
    for (const plane of SIX_PLANE_KEYS) {
      expect(result[plane]).toBeCloseTo(SAMPLE[plane]);
    }
  });

  it('clones rotation angle objects', () => {
    const clone = cloneRotationAngles(SAMPLE);
    for (const plane of SIX_PLANE_KEYS) {
      expect(clone[plane]).toBe(SAMPLE[plane]);
    }
    expect(clone).not.toBe(SAMPLE);
  });

  it('creates plane weight objects with optional overrides', () => {
    const weights = createPlaneWeights({ xy: 0.5, zw: 0 });
    expect(weights.xy).toBeCloseTo(0.5);
    expect(weights.zw).toBeCloseTo(0);
    expect(weights.xz).toBe(1);
  });

  it('merges plane weights and clamps to the [0, 1] range', () => {
    const weights = clonePlaneWeights(UNIT_PLANE_WEIGHTS);
    const changed = mergePlaneWeights(weights, { xy: 2, xz: -1, yz: 0.45 });
    expect(changed).toBe(true);
    expect(weights.xy).toBe(1);
    expect(weights.xz).toBe(0);
    expect(weights.yz).toBeCloseTo(0.45);
    const unchanged = mergePlaneWeights(weights, { yz: 0.45 });
    expect(unchanged).toBe(false);
  });

  it('applies plane weights to rotation angles and snapshots', () => {
    const weights = createPlaneWeights({ xy: 0.5, xw: 0 });
    const angles: RotationAngles = { ...SAMPLE };
    const weighted = applyPlaneWeights({ ...SAMPLE }, angles, weights);
    expect(weighted.xy).toBeCloseTo(SAMPLE.xy * 0.5);
    expect(weighted.xw).toBeCloseTo(0);

    const snapshot = applyPlaneWeightsToSnapshot(
      { ...SAMPLE, timestamp: 12, confidence: 0.8 },
      { ...SAMPLE, timestamp: 34, confidence: 0.6 },
      weights
    );
    expect(snapshot.timestamp).toBe(34);
    expect(snapshot.confidence).toBeCloseTo(0.6);
    expect(snapshot.xy).toBeCloseTo(SAMPLE.xy * 0.5);
  });

  it('detects when plane weights remain at the default unit mask', () => {
    const weights = createPlaneWeights();
    expect(isUnitPlaneWeights(weights)).toBe(true);
    weights.xy = 0.75;
    expect(isUnitPlaneWeights(weights)).toBe(false);
    weights.xy = 1;
    expect(isUnitPlaneWeights(weights)).toBe(true);
  });
});
