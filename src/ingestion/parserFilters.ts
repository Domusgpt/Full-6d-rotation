import type { RotationAngles, RotationSnapshot } from '../core/rotationUniforms';
import { SIX_PLANE_KEYS } from '../core/sixPlaneOrbit';

export interface ParserFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly rotation: RotationSnapshot;
  readonly channels: Float32Array;
  readonly confidence: number;
}

export type ParserFilter = (frame: ParserFrame) => ParserFrame;

export interface StatefulParserFilter extends ParserFilter {
  reset?(): void;
  setAlpha?(alpha: number): void;
  setMaxDelta?(delta: number): void;
}

function cloneRotation(source: RotationSnapshot): RotationSnapshot {
  return {
    xy: source.xy,
    xz: source.xz,
    yz: source.yz,
    xw: source.xw,
    yw: source.yw,
    zw: source.zw,
    timestamp: source.timestamp,
    confidence: source.confidence
  };
}

function blendAngles(target: RotationAngles, current: RotationAngles, alpha: number) {
  for (const plane of SIX_PLANE_KEYS) {
    target[plane] = target[plane] + (current[plane] - target[plane]) * alpha;
  }
}

export interface SmoothingFilterOptions {
  /**
   * Exponential smoothing factor in the range [0, 1].
   * Lower values favour stability, higher values favour responsiveness.
   */
  alpha?: number;
  /**
   * Optional clamp to restrict the per-frame delta for any plane.
   */
  maxDelta?: number;
}

function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 0.2;
  if (alpha < 0) return 0;
  if (alpha > 1) return 1;
  return alpha;
}

/**
 * Creates an exponential smoothing filter that blends the incoming rotation with the previous
 * filtered state. The filter mutates the shared channel buffer so downstream consumers always see
 * the smoothed six-plane values.
 */
export function createSmoothingFilter(options: SmoothingFilterOptions = {}): StatefulParserFilter {
  let previous: RotationSnapshot | null = null;
  let alpha = clampAlpha(options.alpha ?? 0.2);
  let maxDelta = options.maxDelta ?? Infinity;

  const filter: StatefulParserFilter = (frame) => {
    if (!previous) {
      previous = cloneRotation(frame.rotation);
      return frame;
    }

    const blended = cloneRotation(previous);
    blendAngles(blended, frame.rotation, alpha);

    if (Number.isFinite(maxDelta)) {
      for (const plane of SIX_PLANE_KEYS) {
        const delta = blended[plane] - previous[plane];
        if (Math.abs(delta) > maxDelta) {
          blended[plane] = previous[plane] + Math.sign(delta) * maxDelta;
        }
      }
    }

    for (let i = 0; i < SIX_PLANE_KEYS.length; i += 1) {
      frame.channels[i] = blended[SIX_PLANE_KEYS[i]];
    }

    blended.confidence = frame.confidence;
    const blendedConfidence = frame.confidence * 0.85 + previous.confidence * 0.15;
    previous = { ...blended, confidence: blendedConfidence };
    return {
      ...frame,
      rotation: previous,
      confidence: blendedConfidence
    };
  };

  filter.reset = () => {
    previous = null;
  };

  filter.setAlpha = (nextAlpha: number) => {
    alpha = clampAlpha(nextAlpha);
  };

  filter.setMaxDelta = (nextDelta: number) => {
    if (!Number.isFinite(nextDelta) || nextDelta <= 0) {
      maxDelta = Infinity;
      return;
    }
    maxDelta = nextDelta;
  };

  return filter;
}

export interface ConfidenceFloorOptions {
  minimum?: number;
}

/**
 * Ensures the downstream consumers never see confidence fall below a configured floor. This is
 * useful when sensor dropout would otherwise suppress the visual and sonic response entirely.
 */
export function createConfidenceFloorFilter({ minimum = 0.1 }: ConfidenceFloorOptions = {}): ParserFilter {
  const floor = Math.max(0, Math.min(1, minimum));
  return (frame) => {
    if (frame.confidence >= floor) {
      return frame;
    }
    return {
      ...frame,
      confidence: floor,
      rotation: { ...frame.rotation, confidence: floor }
    };
  };
}

