import { describe, expect, it, vi } from 'vitest';
import type { RotationSnapshot } from '../core/rotationUniforms';
import { SIX_PLANE_KEYS } from '../core/rotationPlanes';
import { createConfidenceFloorFilter } from './parserFilters';
import { KerbelizedParserator } from './kerbelizedParserator';
import type { ImuPacket } from './imuMapper';

function makeSnapshot(values: number[], confidence = 1): RotationSnapshot {
  return {
    xy: values[0],
    xz: values[1],
    yz: values[2],
    xw: values[3],
    yw: values[4],
    zw: values[5],
    timestamp: Date.now(),
    confidence
  };
}

describe('KerbelizedParserator', () => {
  it('notifies subscribers with filtered frames', () => {
    const parser = new KerbelizedParserator({ smoothingAlpha: 0.5 });
    const subscriber = vi.fn();
    parser.subscribe(subscriber);

    const first = makeSnapshot([1, 0, 0, 0, 0, 0]);
    parser.ingestRotation(first);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber.mock.calls[0][0].rotation.xy).toBeCloseTo(1);

    const second = makeSnapshot([0, 0, 0, 0, 0, 0]);
    parser.ingestRotation(second);
    expect(subscriber).toHaveBeenCalledTimes(2);
    const frame = subscriber.mock.calls[1][0];
    expect(frame.rotation.xy).toBeLessThan(1);
    expect(frame.channels[0]).toBeCloseTo(frame.rotation.xy);
    expect(frame.overrides?.spatialSin?.[0]).toBeCloseTo(Math.sin(frame.rotation.xy), 1e-6);
  });

  it('applies focus updates to smoothing filter', () => {
    const parser = new KerbelizedParserator({ smoothingAlpha: 0.1 });
    const recorder: RotationSnapshot[] = [];
    parser.subscribe((frame) => recorder.push(frame.rotation));

    parser.ingestRotation(makeSnapshot([1, 1, 1, 1, 1, 1]));
    parser.updateFocus({ smoothingAlpha: 1, maxDelta: Infinity });
    parser.ingestRotation(makeSnapshot([0, 0, 0, 0, 0, 0]));

    expect(recorder[1].xy).toBeCloseTo(0);
  });

  it('updates confidence floor dynamically', () => {
    const parser = new KerbelizedParserator({
      filters: [createConfidenceFloorFilter({ minimum: 0.2 })],
      minimumConfidence: 0.3
    });
    const frames: number[] = [];
    parser.subscribe((frame) => frames.push(frame.confidence));

    parser.ingestRotation(makeSnapshot([0, 0, 0, 0, 0, 0], 0.1));
    expect(frames[0]).toBeCloseTo(0.3);

    parser.updateFocus({ minimumConfidence: 0.6 });
    parser.ingestRotation(makeSnapshot([0, 0, 0, 0, 0, 0], 0.2));
    expect(frames[1]).toBeCloseTo(0.6);
  });

  it('packs six-plane rotation into channel buffer', () => {
    const parser = new KerbelizedParserator();
    const recorded: Float32Array[] = [];
    parser.subscribe((frame) => {
      recorded.push(Float32Array.from(frame.channels));
    });

    const snapshot = makeSnapshot([0.1, 0.2, 0.3, -0.4, 0.5, -0.6]);
    parser.ingestRotation(snapshot);

    expect(recorded).toHaveLength(1);
    const channels = recorded[0];
    for (let i = 0; i < SIX_PLANE_KEYS.length; i += 1) {
      expect(channels[i]).toBeCloseTo(snapshot[SIX_PLANE_KEYS[i]]);
    }
  });

  it('integrates IMU packets into the rotation stream', () => {
    const parser = new KerbelizedParserator({ smoothingAlpha: 1 });
    const frames: RotationSnapshot[] = [];
    parser.subscribe((frame) => {
      frames.push(frame.rotation);
      expect(frame.overrides?.matrix).toBeDefined();
    });

    const packet: ImuPacket = {
      timestamp: 10,
      gyro: [0, 0, 1],
      accel: [0, 0, 1],
      confidence: 0.9
    };

    parser.ingestImuPacket(packet, 0.5);
    parser.ingestImuPacket({ ...packet, timestamp: 20 }, 0.5);

    expect(frames).toHaveLength(2);
    expect(frames[1].yz).toBeGreaterThan(frames[0].yz);
    expect(frames[1].confidence).toBeGreaterThan(0);
  });
});

