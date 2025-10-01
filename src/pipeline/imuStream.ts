import type { ImuPacket } from '../ingestion/imuMapper';

type StatusCallback = (status: string) => void;

type PacketCallback = (packet: ImuPacket, dt: number) => void;

export interface ImuStreamOptions {
  url: string;
  onPacket: PacketCallback;
  onStatus?: StatusCallback;
  reconnectIntervalMs?: number;
}

const DEFAULT_RECONNECT_MS = 2500;
const FALLBACK_SAMPLE_DT = 1 / 200;

export class ImuStream {
  private socket: WebSocket | null = null;
  private lastTimestamp: number | null = null;
  private reconnectHandle: number | null = null;
  private active = false;

  constructor(private readonly options: ImuStreamOptions) {}

  start() {
    if (this.active) return;
    this.active = true;
    this.connect();
  }

  stop() {
    this.active = false;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.reconnectHandle !== null) {
      clearTimeout(this.reconnectHandle);
      this.reconnectHandle = null;
    }
    this.lastTimestamp = null;
  }

  private connect() {
    if (!this.active) return;
    try {
      this.reportStatus(`Connecting to ${this.options.url}…`);
      const socket = new WebSocket(this.options.url);
      this.socket = socket;

      socket.addEventListener('open', () => {
        this.reportStatus('IMU stream connected');
        this.lastTimestamp = null;
      });

      socket.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });

      socket.addEventListener('close', () => {
        this.reportStatus('IMU stream closed');
        this.scheduleReconnect();
      });

      socket.addEventListener('error', (event) => {
        console.error('IMU stream error', event);
        this.reportStatus('IMU stream error – retrying');
      });
    } catch (error) {
      console.error('Failed to open IMU stream', error);
      this.reportStatus('IMU stream unavailable');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.active) return;
    if (this.reconnectHandle !== null) return;
    const interval = this.options.reconnectIntervalMs ?? DEFAULT_RECONNECT_MS;
    this.reconnectHandle = window.setTimeout(() => {
      this.reconnectHandle = null;
      this.connect();
    }, interval);
  }

  private handleMessage(data: unknown) {
    let packet: ImuPacket | null = null;
    try {
      packet = typeof data === 'string' ? (JSON.parse(data) as ImuPacket) : (data as ImuPacket);
    } catch (error) {
      console.warn('Invalid IMU payload', error);
      return;
    }

    if (!packet || typeof packet.timestamp !== 'number') {
      console.warn('IMU payload missing timestamp');
      return;
    }

    const dt = this.computeDeltaSeconds(packet.timestamp);
    this.options.onPacket(packet, dt);
  }

  private computeDeltaSeconds(timestampMs: number): number {
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestampMs;
      return FALLBACK_SAMPLE_DT;
    }
    const delta = (timestampMs - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestampMs;
    if (!Number.isFinite(delta) || delta <= 0) {
      return FALLBACK_SAMPLE_DT;
    }
    return delta;
  }

  private reportStatus(message: string) {
    if (this.options.onStatus) {
      this.options.onStatus(message);
    }
  }
}
