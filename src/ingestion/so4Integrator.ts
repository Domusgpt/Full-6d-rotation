import { ZERO_ROTATION, type RotationAngles, type RotationSnapshot } from '../core/rotationUniforms';
import { DEFAULT_GAINS, mapImuPacket, type ImuPacket, type MappingGains } from './imuMapper';

export interface So4ImuIntegratorOptions {
  /**
   * Blend factor applied when folding accelerometer-derived hyperspatial angles
   * into the running SO(4) state. 0 applies no update, 1 snaps directly to the
   * measurement.
   */
  hyperSmoothing?: number;
  /** Maximum absolute angle that will be retained for any plane. */
  maxMagnitude?: number;
}

const TAU = Math.PI * 2;

function cloneGains(gains: MappingGains): MappingGains {
  return {
    spatial: [...gains.spatial] as [number, number, number],
    hyperspatial: [...gains.hyperspatial] as [number, number, number]
  };
}

function wrapAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  let wrapped = angle % TAU;
  if (wrapped > Math.PI) wrapped -= TAU;
  if (wrapped < -Math.PI) wrapped += TAU;
  return wrapped;
}

function clampMagnitude(angle: number, maxMagnitude: number): number {
  if (Math.abs(angle) <= maxMagnitude) return angle;
  return Math.sign(angle) * maxMagnitude;
}

function lerp(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

export class So4ImuIntegrator {
  private readonly angles: RotationAngles = { ...ZERO_ROTATION };
  private gains: MappingGains;
  private hyperSmoothing: number;
  private readonly maxMagnitude: number;

  constructor(gains: MappingGains = DEFAULT_GAINS, options: So4ImuIntegratorOptions = {}) {
    this.gains = cloneGains(gains);
    const smoothing = options.hyperSmoothing ?? 0.25;
    this.hyperSmoothing = Number.isFinite(smoothing) ? Math.min(Math.max(smoothing, 0), 1) : 0.25;
    this.maxMagnitude = options.maxMagnitude ?? Math.PI;
  }

  setGains(gains: MappingGains) {
    this.gains = cloneGains(gains);
  }

  reset(angles: RotationAngles = ZERO_ROTATION) {
    this.angles.xy = angles.xy;
    this.angles.xz = angles.xz;
    this.angles.yz = angles.yz;
    this.angles.xw = angles.xw;
    this.angles.yw = angles.yw;
    this.angles.zw = angles.zw;
  }

  step(packet: ImuPacket, dt: number, gains: MappingGains = this.gains): RotationSnapshot {
    if (gains !== this.gains) {
      this.setGains(gains);
    }
    const measurement = mapImuPacket(packet, dt, this.gains);

    this.angles.xy = clampMagnitude(wrapAngle(this.angles.xy + measurement.xy), this.maxMagnitude);
    this.angles.xz = clampMagnitude(wrapAngle(this.angles.xz + measurement.xz), this.maxMagnitude);
    this.angles.yz = clampMagnitude(wrapAngle(this.angles.yz + measurement.yz), this.maxMagnitude);

    this.angles.xw = clampMagnitude(lerp(this.angles.xw, measurement.xw, this.hyperSmoothing), this.maxMagnitude);
    this.angles.yw = clampMagnitude(lerp(this.angles.yw, measurement.yw, this.hyperSmoothing), this.maxMagnitude);
    this.angles.zw = clampMagnitude(lerp(this.angles.zw, measurement.zw, this.hyperSmoothing), this.maxMagnitude);

    return {
      xy: this.angles.xy,
      xz: this.angles.xz,
      yz: this.angles.yz,
      xw: this.angles.xw,
      yw: this.angles.yw,
      zw: this.angles.zw,
      timestamp: packet.timestamp,
      confidence: measurement.confidence
    };
  }

  getAngles(): RotationAngles {
    return { ...this.angles };
  }
}
