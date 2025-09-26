import { describe, expect, it } from 'vitest';
import type { RotationAngles } from './rotationUniforms';
import {
  SIX_PLANE_KEYS,
  cloneRotationAngles,
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
});
