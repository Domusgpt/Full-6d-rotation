import { mapImuPacket, type ImuPacket } from './imuMapper';
import type { RotationSnapshot } from '../core/rotationUniforms';
import type { PlaneMappingProfile } from './profiles';
import { DEFAULT_PROFILE } from './profiles';
import {
  EMPTY_CALIBRATION,
  applyCalibration,
  cloneCalibration,
  combineCalibrations,
  createCalibrationFromSnapshot,
  hasCalibration,
  type ExtrumentCalibration
} from './calibration';

export type Preprocessor = (packet: ImuPacket) => ImuPacket;
export type SnapshotListener = (snapshot: RotationSnapshot) => void;

export interface ParseratorOptions {
  profile?: PlaneMappingProfile;
  confidenceFloor?: number;
  calibration?: ExtrumentCalibration;
  calibrationBlend?: number;
}

export class Parserator {
  private preprocessors: Preprocessor[] = [];
  private listeners = new Set<SnapshotListener>();
  private lastTimestamp = 0;
  private readonly profile: PlaneMappingProfile;
  private readonly confidenceFloor: number;
  private calibration: ExtrumentCalibration;
  private readonly calibrationBlend: number;
  private scratchSnapshot: RotationSnapshot | null = null;

  constructor(options: ParseratorOptions = {}) {
    this.profile = options.profile ?? DEFAULT_PROFILE;
    this.confidenceFloor = options.confidenceFloor ?? 0.6;
    this.calibration = cloneCalibration(options.calibration ?? EMPTY_CALIBRATION);
    this.calibrationBlend = options.calibrationBlend ?? 0.85;
  }

  registerPreprocessor(fn: Preprocessor) {
    this.preprocessors.push(fn);
  }

  onSnapshot(listener: SnapshotListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ingest(packet: ImuPacket) {
    let processed = packet;
    for (const fn of this.preprocessors) {
      processed = fn(processed);
    }

    const dt = this.computeDelta(processed.timestamp);
    const snapshot = mapImuPacket(processed, dt);
    snapshot.confidence = Math.max(snapshot.confidence, this.confidenceFloor);
    this.applyProfile(snapshot, processed);

    if (hasCalibration(this.calibration)) {
      this.scratchSnapshot = applyCalibration(snapshot, this.calibration, this.scratchSnapshot ?? { ...snapshot });
    } else {
      this.scratchSnapshot = { ...snapshot };
    }

    this.scratchSnapshot.confidence = Math.max(this.scratchSnapshot.confidence, this.confidenceFloor);

    for (const listener of this.listeners) {
      listener({ ...this.scratchSnapshot });
    }
  }

  private computeDelta(timestamp: number): number {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      return 0.016;
    }
    const dt = Math.max(1e-3, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    return dt;
  }

  private applyProfile(snapshot: RotationSnapshot, packet: ImuPacket) {
    const axisIndex = { x: 0, y: 1, z: 2 } as const;

    for (const channel of this.profile.spatial) {
      const index = axisIndex[channel.axis];
      const value = packet.gyro[index] * channel.gain;
      snapshot[channel.plane] = this.applySmoothing(snapshot[channel.plane], value, channel.smoothing);
      if (channel.clamp !== undefined) {
        snapshot[channel.plane] = clamp(snapshot[channel.plane], -channel.clamp, channel.clamp);
      }
    }

    for (const channel of this.profile.hyperspatial) {
      const index = axisIndex[channel.axis];
      const value = packet.accel[index] * channel.gain;
      snapshot[channel.plane] = this.applySmoothing(snapshot[channel.plane], value, channel.smoothing);
      if (channel.clamp !== undefined) {
        snapshot[channel.plane] = clamp(snapshot[channel.plane], -channel.clamp, channel.clamp);
      }
    }
  }

  private applySmoothing(current: number, incoming: number, smoothing = 0): number {
    if (smoothing <= 0) return incoming;
    return current * smoothing + incoming * (1 - smoothing);
  }

  getCalibration(): ExtrumentCalibration {
    return cloneCalibration(this.calibration);
  }

  setCalibration(calibration?: ExtrumentCalibration | null) {
    this.calibration = cloneCalibration(calibration ?? EMPTY_CALIBRATION);
  }

  clearCalibration() {
    this.calibration = cloneCalibration(EMPTY_CALIBRATION);
  }

  captureCalibration(snapshot: RotationSnapshot, blend = this.calibrationBlend): ExtrumentCalibration {
    const sample = createCalibrationFromSnapshot(snapshot);
    if (!hasCalibration(this.calibration)) {
      this.calibration = sample;
      return cloneCalibration(this.calibration);
    }
    this.calibration = combineCalibrations(this.calibration, sample, blend);
    return cloneCalibration(this.calibration);
  }
}

export function lowPassGyro(cutoff: number): Preprocessor {
  let last: ImuPacket | null = null;
  return packet => {
    if (!last) {
      last = packet;
      return packet;
    }
    const blend = Math.exp(-cutoff * Math.max(1e-3, (packet.timestamp - last.timestamp) / 1000));
    const gyro: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      gyro[i] = blend * last.gyro[i] + (1 - blend) * packet.gyro[i];
    }
    last = { ...packet, gyro };
    return last;
  };
}

export function gravityIsolation(strength: number): Preprocessor {
  return packet => {
    const [ax, ay, az] = packet.accel;
    const magnitude = Math.max(Math.hypot(ax, ay, az), 1e-5);
    const normalized: [number, number, number] = [ax / magnitude, ay / magnitude, az / magnitude];
    return { ...packet, accel: normalized.map(value => value * strength) as [number, number, number] };
  };
}

export function featureWindow(windowSize: number): Preprocessor {
  const window: ImuPacket[] = [];
  return packet => {
    window.push(packet);
    if (window.length > windowSize) window.shift();
    const averaged = averagePackets(window);
    return { ...packet, gyro: averaged.gyro, accel: averaged.accel };
  };
}

function averagePackets(samples: ImuPacket[]): { gyro: [number, number, number]; accel: [number, number, number] } {
  const gyro: [number, number, number] = [0, 0, 0];
  const accel: [number, number, number] = [0, 0, 0];
  for (const sample of samples) {
    for (let i = 0; i < 3; i++) {
      gyro[i] += sample.gyro[i];
      accel[i] += sample.accel[i];
    }
  }
  for (let i = 0; i < 3; i++) {
    gyro[i] /= samples.length;
    accel[i] /= samples.length;
  }
  return { gyro, accel };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
