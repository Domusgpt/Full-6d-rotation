import { describe, expect, it } from 'vitest';
import { Parserator } from './parserator';
import type { ImuPacket } from './imuMapper';
import { createCalibrationFromSnapshot } from './calibration';
import { ZERO_ROTATION, type RotationSnapshot } from '../core/rotationUniforms';

function createPacket(overrides: Partial<ImuPacket> = {}): ImuPacket {
  return {
    timestamp: overrides.timestamp ?? 1000,
    gyro: overrides.gyro ?? [1, 0, 0],
    accel: overrides.accel ?? [0, 0, 1],
    confidence: overrides.confidence ?? 0.7
  };
}

describe('Parserator calibration handling', () => {
  it('applies calibration offsets to emitted snapshots', () => {
    const parserator = new Parserator();
    const outputs: RotationSnapshot[] = [];
    parserator.onSnapshot(snapshot => outputs.push(snapshot));

    const packet = createPacket();
    parserator.ingest(packet);
    const initial = outputs.pop();
    expect(initial).toBeDefined();

    const calibration = createCalibrationFromSnapshot(initial ?? {
      ...ZERO_ROTATION,
      timestamp: packet.timestamp,
      confidence: 1
    });
    parserator.setCalibration(calibration);

    parserator.ingest({ ...packet, timestamp: packet.timestamp + 16 });
    const adjusted = outputs.pop();
    expect(adjusted).toBeDefined();
    if (!adjusted) throw new Error('adjusted snapshot missing');

    expect(Math.abs(adjusted.xy)).toBeLessThan(1e-3);
    expect(Math.abs(adjusted.xw)).toBeLessThan(1e-3);
  });

  it('captures calibration using smoothing', () => {
    const parserator = new Parserator({ calibrationBlend: 0.5 });
    const packet = createPacket();
    let captured: RotationSnapshot | undefined;
    parserator.onSnapshot(snapshot => {
      captured = snapshot;
    });

    parserator.ingest(packet);
    if (!captured) throw new Error('expected snapshot');

    const calibrationA = parserator.captureCalibration(captured);
    expect(calibrationA.timestamp).toBe(captured.timestamp);

    const nudged: RotationSnapshot = { ...captured, xy: captured.xy + 0.1, timestamp: captured.timestamp + 32 };
    const calibrationB = parserator.captureCalibration(nudged);
    expect(calibrationB.offsets.xy).toBeCloseTo((calibrationA.offsets.xy + nudged.xy) / 2, 6);
  });
});
