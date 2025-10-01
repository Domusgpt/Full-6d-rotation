import type { RotationAngles, RotationSnapshot } from './rotationUniforms';

export interface AngularVelocityOptions {
  /**
   * Minimum elapsed time between samples (in seconds) required before angular
   * velocity is computed. Smaller deltas clear the target instead of producing
   * excessively large or noisy values.
   */
  minDeltaSeconds?: number;
  /**
   * Maximum absolute angular velocity (in radians per second) permitted for a
   * single plane. Values exceeding this magnitude are clamped to preserve
   * numerical stability across the render and audio pipelines.
   */
  maxMagnitude?: number;
}

export const DEFAULT_MIN_DELTA_SECONDS = 1e-3;
export const DEFAULT_MAX_ANGULAR_VELOCITY = Math.PI * 12;

/**
 * Clears all plane values on the provided rotation angle object. The target is
 * mutated in place and also returned for convenience so the helper can be
 * chained when desired.
 */
export function clearRotationAngles<T extends RotationAngles>(target: T): T {
  target.xy = 0;
  target.xz = 0;
  target.yz = 0;
  target.xw = 0;
  target.yw = 0;
  target.zw = 0;
  return target;
}

/**
 * Computes per-plane angular velocity (in radians per second) between two
 * rotation snapshots. The result is written into the provided target object and
 * the same target reference is returned.
 */
export function computeAngularVelocity<T extends RotationAngles>(
  target: T,
  previous: RotationSnapshot,
  next: RotationSnapshot,
  options: AngularVelocityOptions = {}
): T {
  const deltaMs = next.timestamp - previous.timestamp;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return clearRotationAngles(target);
  }

  const deltaSeconds = deltaMs * 0.001;
  const minDelta = options.minDeltaSeconds ?? DEFAULT_MIN_DELTA_SECONDS;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < minDelta) {
    return clearRotationAngles(target);
  }

  const maxMagnitude = Math.abs(options.maxMagnitude ?? DEFAULT_MAX_ANGULAR_VELOCITY);

  target.xy = clampAngularVelocity((next.xy - previous.xy) / deltaSeconds, maxMagnitude);
  target.xz = clampAngularVelocity((next.xz - previous.xz) / deltaSeconds, maxMagnitude);
  target.yz = clampAngularVelocity((next.yz - previous.yz) / deltaSeconds, maxMagnitude);
  target.xw = clampAngularVelocity((next.xw - previous.xw) / deltaSeconds, maxMagnitude);
  target.yw = clampAngularVelocity((next.yw - previous.yw) / deltaSeconds, maxMagnitude);
  target.zw = clampAngularVelocity((next.zw - previous.zw) / deltaSeconds, maxMagnitude);

  return target;
}

function clampAngularVelocity(value: number, maxMagnitude: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (maxMagnitude <= 0) {
    return 0;
  }
  if (!Number.isFinite(maxMagnitude)) {
    return value;
  }
  if (value > maxMagnitude) return maxMagnitude;
  if (value < -maxMagnitude) return -maxMagnitude;
  return value;
}
