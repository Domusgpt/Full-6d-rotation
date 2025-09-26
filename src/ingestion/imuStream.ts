import { SIX_PLANE_KEYS } from '../core/sixPlaneOrbit';
import type { RotationSnapshot } from '../core/rotationUniforms';
import { DEFAULT_GAINS, mapImuPacket, type ImuPacket, type MappingGains } from './imuMapper';

export type ImuStreamState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export interface ImuStreamStatus {
  state: ImuStreamState;
  detail?: string;
}

export interface ImuStreamConfig {
  url: string;
  gains?: MappingGains;
  smoothing?: number;
  fallbackDt?: number;
  onSnapshot: (snapshot: RotationSnapshot) => void;
  onStatus?: (status: ImuStreamStatus) => void;
}

const DEFAULT_FALLBACK_DT = 1 / 90; // seconds
const MIN_SMOOTHING = 0;
const MAX_SMOOTHING = 0.95;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && value.constructor === Object;
}

export class ImuStream {
  private ws: WebSocket | null = null;
  private readonly onSnapshot: (snapshot: RotationSnapshot) => void;
  private readonly onStatus?: (status: ImuStreamStatus) => void;
  private gains: MappingGains;
  private smoothing: number;
  private fallbackDt: number;
  private lastTimestamp: number | null = null;
  private lastSnapshot: RotationSnapshot | null = null;
  private status: ImuStreamStatus = { state: 'idle' };

  private readonly handleOpen = () => {
    this.lastTimestamp = null;
    this.lastSnapshot = null;
    this.emitStatus({ state: 'open' });
  };

  private readonly handleMessage = (event: MessageEvent) => {
    const packet = this.parsePacket(event.data);
    if (!packet) {
      this.emitStatus({ state: 'error', detail: 'Received malformed IMU packet' });
      return;
    }

    const dt = this.computeDelta(packet.timestamp);
    const snapshot = mapImuPacket(packet, dt, this.gains);
    const smoothed = this.applySmoothing(snapshot);
    this.onSnapshot(smoothed);
  };

  private readonly handleClose = () => {
    this.emitStatus({ state: 'closed' });
    this.cleanupSocket();
  };

  private readonly handleError = () => {
    this.cleanupSocket();
    this.emitStatus({ state: 'error', detail: 'IMU stream error' });
  };

  constructor(private readonly config: ImuStreamConfig) {
    this.onSnapshot = config.onSnapshot;
    this.onStatus = config.onStatus;
    this.gains = {
      spatial: [...(config.gains?.spatial ?? DEFAULT_GAINS.spatial)] as [number, number, number],
      hyperspatial: [...(config.gains?.hyperspatial ?? DEFAULT_GAINS.hyperspatial)] as [number, number, number]
    };
    this.smoothing = clamp(config.smoothing ?? 0.25, MIN_SMOOTHING, MAX_SMOOTHING);
    this.fallbackDt = config.fallbackDt ?? DEFAULT_FALLBACK_DT;
  }

  get isActive(): boolean {
    if (!this.ws) return false;
    return this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.isActive) {
      return;
    }
    this.emitStatus({ state: 'connecting' });
    const socket = new WebSocket(this.config.url);
    this.ws = socket;
    socket.addEventListener('open', this.handleOpen);
    socket.addEventListener('message', this.handleMessage);
    socket.addEventListener('close', this.handleClose);
    socket.addEventListener('error', this.handleError);
  }

  disconnect() {
    if (!this.ws) {
      return;
    }
    this.ws.removeEventListener('open', this.handleOpen);
    this.ws.removeEventListener('message', this.handleMessage);
    this.ws.removeEventListener('close', this.handleClose);
    this.ws.removeEventListener('error', this.handleError);
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    this.cleanupSocket();
    this.emitStatus({ state: 'closed' });
  }

  updateGains(gains: Partial<MappingGains>) {
    this.gains = {
      spatial: [...(gains.spatial ?? this.gains.spatial)] as [number, number, number],
      hyperspatial: [...(gains.hyperspatial ?? this.gains.hyperspatial)] as [number, number, number]
    };
  }

  updateSmoothing(value: number) {
    this.smoothing = clamp(value, MIN_SMOOTHING, MAX_SMOOTHING);
  }

  private cleanupSocket() {
    if (this.ws) {
      this.ws.removeEventListener('open', this.handleOpen);
      this.ws.removeEventListener('message', this.handleMessage);
      this.ws.removeEventListener('close', this.handleClose);
      this.ws.removeEventListener('error', this.handleError);
    }
    this.lastTimestamp = null;
    this.lastSnapshot = null;
    this.ws = null;
  }

  private emitStatus(status: ImuStreamStatus) {
    this.status = status;
    if (this.onStatus) {
      this.onStatus(status);
    }
  }

  private parsePacket(data: MessageEvent['data']): ImuPacket | null {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return this.validatePacket(parsed);
      } catch (error) {
        console.warn('IMU stream JSON parse failed', error);
        return null;
      }
    }

    if (isPlainObject(data)) {
      return this.validatePacket(data);
    }

    if (data instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(data);
        const parsed = JSON.parse(text);
        return this.validatePacket(parsed);
      } catch (error) {
        console.warn('IMU stream ArrayBuffer parse failed', error);
        return null;
      }
    }

    return null;
  }

  private validatePacket(candidate: Record<string, unknown>): ImuPacket | null {
    if (
      typeof candidate.timestamp !== 'number' ||
      !Array.isArray(candidate.gyro) ||
      !Array.isArray(candidate.accel) ||
      candidate.gyro.length !== 3 ||
      candidate.accel.length !== 3
    ) {
      return null;
    }

    const gyro = candidate.gyro.map(Number) as [number, number, number];
    const accel = candidate.accel.map(Number) as [number, number, number];
    const confidence = typeof candidate.confidence === 'number' ? candidate.confidence : undefined;

    return {
      timestamp: candidate.timestamp,
      gyro,
      accel,
      confidence
    };
  }

  private computeDelta(timestamp: number): number {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return this.fallbackDt;
    }

    const delta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    if (!Number.isFinite(delta) || delta <= 0) {
      return this.fallbackDt;
    }
    return delta;
  }

  private applySmoothing(snapshot: RotationSnapshot): RotationSnapshot {
    if (!this.lastSnapshot) {
      this.lastSnapshot = snapshot;
      return snapshot;
    }

    const smoothFactor = 1 - this.smoothing;
    for (const plane of SIX_PLANE_KEYS) {
      const previous = this.lastSnapshot[plane];
      const current = snapshot[plane];
      this.lastSnapshot[plane] = previous * this.smoothing + current * smoothFactor;
    }
    this.lastSnapshot.timestamp = snapshot.timestamp;
    this.lastSnapshot.confidence = snapshot.confidence;
    return { ...this.lastSnapshot };
  }
}
