import { ZERO_ROTATION, type RotationAngles, type RotationSnapshot } from '../core/rotationUniforms';
import { SIX_PLANE_KEYS } from '../core/sixPlaneOrbit';

export interface ExtrumentCalibration {
  timestamp: number;
  confidence: number;
  offsets: RotationAngles;
}

export const EMPTY_CALIBRATION: ExtrumentCalibration = Object.freeze({
  timestamp: 0,
  confidence: 1,
  offsets: { ...ZERO_ROTATION }
});

export const EXTRUMENT_CALIBRATION_STORAGE_KEY = 'hypercube:extrument-calibration';

export interface SerializedExtrumentCalibration {
  version: 1;
  timestamp: number;
  confidence: number;
  offsets: RotationAngles;
}

export function cloneCalibration(calibration: ExtrumentCalibration = EMPTY_CALIBRATION): ExtrumentCalibration {
  return {
    timestamp: calibration.timestamp,
    confidence: calibration.confidence,
    offsets: { ...calibration.offsets }
  };
}

export function hasCalibration(calibration?: ExtrumentCalibration | null): calibration is ExtrumentCalibration {
  if (!calibration) return false;
  if (calibration.timestamp <= 0) return false;
  for (const plane of SIX_PLANE_KEYS) {
    if (Math.abs(calibration.offsets[plane]) > 1e-6) {
      return true;
    }
  }
  return false;
}

export function createCalibrationFromSnapshot(
  snapshot: RotationSnapshot,
  overrides: Partial<Pick<ExtrumentCalibration, 'confidence' | 'timestamp'>> = {}
): ExtrumentCalibration {
  const offsets: RotationAngles = { ...ZERO_ROTATION };
  for (const plane of SIX_PLANE_KEYS) {
    offsets[plane] = snapshot[plane];
  }
  return {
    timestamp: overrides.timestamp ?? snapshot.timestamp,
    confidence: overrides.confidence ?? snapshot.confidence,
    offsets
  };
}

export function applyCalibration(
  snapshot: RotationSnapshot,
  calibration: ExtrumentCalibration,
  target?: RotationSnapshot
): RotationSnapshot {
  const result = target ?? { ...snapshot };
  if (!hasCalibration(calibration)) {
    if (!target) {
      return { ...snapshot };
    }
    Object.assign(result, snapshot);
    return result;
  }

  Object.assign(result, snapshot);
  for (const plane of SIX_PLANE_KEYS) {
    result[plane] = snapshot[plane] - calibration.offsets[plane];
  }
  result.confidence = clamp01(snapshot.confidence * clamp01(calibration.confidence));
  return result;
}

export function combineCalibrations(
  base: ExtrumentCalibration,
  sample: ExtrumentCalibration,
  blend: number
): ExtrumentCalibration {
  const weight = clamp01(blend);
  const offsets: RotationAngles = { ...ZERO_ROTATION };
  for (const plane of SIX_PLANE_KEYS) {
    offsets[plane] = base.offsets[plane] * weight + sample.offsets[plane] * (1 - weight);
  }
  const confidence = base.confidence * weight + sample.confidence * (1 - weight);
  const timestamp = Math.max(base.timestamp, sample.timestamp);
  return {
    offsets,
    confidence: clamp01(confidence),
    timestamp
  };
}

export function serializeCalibration(calibration: ExtrumentCalibration): SerializedExtrumentCalibration {
  return {
    version: 1,
    timestamp: calibration.timestamp,
    confidence: calibration.confidence,
    offsets: { ...calibration.offsets }
  };
}

export function deserializeCalibration(serialized: unknown): ExtrumentCalibration | null {
  if (!serialized || typeof serialized !== 'object') {
    return null;
  }
  const payload = serialized as Partial<SerializedExtrumentCalibration>;
  if (payload.version !== 1) {
    return null;
  }
  if (typeof payload.timestamp !== 'number' || typeof payload.confidence !== 'number') {
    return null;
  }
  const offsets = payload.offsets;
  if (!offsets || typeof offsets !== 'object') {
    return null;
  }
  const normalizedOffsets: RotationAngles = { ...ZERO_ROTATION };
  for (const plane of SIX_PLANE_KEYS) {
    const value = (offsets as RotationAngles)[plane];
    if (typeof value !== 'number') {
      return null;
    }
    normalizedOffsets[plane] = value;
  }
  return {
    timestamp: payload.timestamp,
    confidence: clamp01(payload.confidence),
    offsets: normalizedOffsets
  };
}

export function calibrationSummary(calibration: ExtrumentCalibration): string {
  if (!hasCalibration(calibration)) {
    return 'not set';
  }
  const parts = SIX_PLANE_KEYS.map(plane => `${plane}:${calibration.offsets[plane].toFixed(3)}`);
  return parts.join(' ');
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
