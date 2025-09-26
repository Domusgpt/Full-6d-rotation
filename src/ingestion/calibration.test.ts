import { describe, expect, it } from 'vitest';
import { ZERO_ROTATION, type RotationSnapshot } from '../core/rotationUniforms';
import { SIX_PLANE_KEYS } from '../core/sixPlaneOrbit';
import {
  EMPTY_CALIBRATION,
  applyCalibration,
  calibrationSummary,
  cloneCalibration,
  combineCalibrations,
  createCalibrationFromSnapshot,
  deserializeCalibration,
  hasCalibration,
  serializeCalibration
} from './calibration';

describe('calibration utilities', () => {
  const sampleSnapshot: RotationSnapshot = {
    ...ZERO_ROTATION,
    xy: 0.42,
    xz: -0.18,
    yz: 0.07,
    xw: -0.11,
    yw: 0.09,
    zw: 0.33,
    timestamp: 1200,
    confidence: 0.8
  };

  it('creates a calibration from a snapshot', () => {
    const calibration = createCalibrationFromSnapshot(sampleSnapshot);
    expect(calibration.timestamp).toBe(sampleSnapshot.timestamp);
    expect(calibration.confidence).toBe(sampleSnapshot.confidence);
    for (const plane of SIX_PLANE_KEYS) {
      expect(calibration.offsets[plane]).toBe(sampleSnapshot[plane]);
    }
  });

  it('applies calibration offsets to a snapshot', () => {
    const calibration = createCalibrationFromSnapshot(sampleSnapshot);
    const adjusted = applyCalibration(sampleSnapshot, calibration);
    for (const plane of SIX_PLANE_KEYS) {
      expect(adjusted[plane]).toBeCloseTo(0, 6);
    }
    expect(adjusted.confidence).toBeCloseTo(sampleSnapshot.confidence * calibration.confidence, 6);
  });

  it('blends calibrations using the provided weight', () => {
    const initial = createCalibrationFromSnapshot(sampleSnapshot, { confidence: 0.9 });
    const update = createCalibrationFromSnapshot({
      ...sampleSnapshot,
      xy: sampleSnapshot.xy + 0.2,
      xw: sampleSnapshot.xw - 0.2,
      timestamp: sampleSnapshot.timestamp + 500,
      confidence: 0.6
    });
    const blended = combineCalibrations(initial, update, 0.75);
    expect(blended.timestamp).toBe(update.timestamp);
    expect(blended.confidence).toBeGreaterThan(0.6);
    expect(blended.confidence).toBeLessThan(0.9);
    expect(blended.offsets.xy).toBeCloseTo(initial.offsets.xy * 0.75 + update.offsets.xy * 0.25, 6);
    expect(blended.offsets.xw).toBeCloseTo(initial.offsets.xw * 0.75 + update.offsets.xw * 0.25, 6);
  });

  it('serialises and deserialises a calibration payload', () => {
    const calibration = createCalibrationFromSnapshot(sampleSnapshot);
    const serialised = serializeCalibration(calibration);
    const hydrated = deserializeCalibration(serialised);
    expect(hydrated).not.toBeNull();
    expect(hydrated?.timestamp).toBe(calibration.timestamp);
    expect(hydrated?.confidence).toBe(calibration.confidence);
    for (const plane of SIX_PLANE_KEYS) {
      expect(hydrated?.offsets[plane]).toBe(calibration.offsets[plane]);
    }
  });

  it('handles invalid serialised payloads', () => {
    expect(deserializeCalibration(null)).toBeNull();
    expect(deserializeCalibration({})).toBeNull();
    expect(
      deserializeCalibration({
        version: 1,
        timestamp: 'bad',
        confidence: 1,
        offsets: { ...ZERO_ROTATION }
      })
    ).toBeNull();
  });

  it('detects whether a calibration is active', () => {
    expect(hasCalibration()).toBe(false);
    expect(hasCalibration(EMPTY_CALIBRATION)).toBe(false);
    const calibration = cloneCalibration(EMPTY_CALIBRATION);
    calibration.timestamp = 100;
    calibration.offsets.xy = 0.01;
    expect(hasCalibration(calibration)).toBe(true);
  });

  it('summarises calibration offsets for UI telemetry', () => {
    expect(calibrationSummary(EMPTY_CALIBRATION)).toBe('not set');
    const calibration = cloneCalibration(EMPTY_CALIBRATION);
    calibration.timestamp = 10;
    calibration.offsets.xy = 0.25;
    calibration.offsets.xw = -0.1;
    expect(calibrationSummary(calibration)).toContain('xy:0.250');
    expect(calibrationSummary(calibration)).toContain('xw:-0.100');
  });
});
