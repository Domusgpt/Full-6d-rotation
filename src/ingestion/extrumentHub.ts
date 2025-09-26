import type { RotationSnapshot } from '../core/rotationUniforms';
import { SIX_PLANE_KEYS } from '../core/sixPlaneOrbit';

type PlaneKey = (typeof SIX_PLANE_KEYS)[number];

export interface ExtrumentAdapter<TPayload = RotationSnapshot> {
  readonly id: string;
  connect(): Promise<void> | void;
  disconnect(): Promise<void> | void;
  send(payload: TPayload): Promise<void> | void;
  isConnected?(): boolean;
}

export interface ExtrumentHubOptions<TPayload> {
  transform?: (snapshot: RotationSnapshot) => TPayload;
  onError?: (error: unknown, adapter: ExtrumentAdapter<TPayload>) => void;
}

interface AdapterState<TPayload> {
  adapter: ExtrumentAdapter<TPayload>;
  connected: boolean;
}

export class ExtrumentHub<TPayload = RotationSnapshot> {
  private readonly adapters = new Map<string, AdapterState<TPayload>>();
  private readonly transform: (snapshot: RotationSnapshot) => TPayload;
  private readonly onError?: (error: unknown, adapter: ExtrumentAdapter<TPayload>) => void;

  constructor(options: ExtrumentHubOptions<TPayload> = {}) {
    this.transform = options.transform ?? ((snapshot) => snapshot as unknown as TPayload);
    this.onError = options.onError;
  }

  register(adapter: ExtrumentAdapter<TPayload>): () => void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter with id ${adapter.id} is already registered`);
    }
    this.adapters.set(adapter.id, { adapter, connected: false });
    return () => {
      const entry = this.adapters.get(adapter.id);
      if (!entry) return;
      if (entry.connected) {
        void entry.adapter.disconnect();
      }
      this.adapters.delete(adapter.id);
    };
  }

  async connect(id: string): Promise<void> {
    const entry = this.adapters.get(id);
    if (!entry) {
      throw new Error(`Unknown adapter ${id}`);
    }
    if (entry.connected) return;
    await entry.adapter.connect();
    entry.connected = entry.adapter.isConnected ? entry.adapter.isConnected() ?? true : true;
  }

  async disconnect(id: string): Promise<void> {
    const entry = this.adapters.get(id);
    if (!entry) return;
    if (!entry.connected) return;
    await entry.adapter.disconnect();
    entry.connected = entry.adapter.isConnected ? entry.adapter.isConnected() ?? false : false;
  }

  async broadcast(snapshot: RotationSnapshot): Promise<void> {
    if (this.adapters.size === 0) return;
    const payload = this.transform(snapshot);
    await this.broadcastPayload(payload);
  }

  async broadcastPayload(payload: TPayload): Promise<void> {
    if (this.adapters.size === 0) return;
    for (const state of this.adapters.values()) {
      if (!state.connected) continue;
      try {
        await state.adapter.send(payload);
      } catch (error) {
        state.connected = state.adapter.isConnected ? state.adapter.isConnected() ?? false : false;
        if (this.onError) {
          this.onError(error, state.adapter);
        }
      }
    }
  }

  listAdapters(): Array<{ id: string; connected: boolean }> {
    return Array.from(this.adapters.values()).map(({ adapter, connected }) => ({
      id: adapter.id,
      connected
    }));
  }
}

export interface NormalizedSnapshot {
  timestamp: number;
  confidence: number;
  magnitude: number;
  planes: Record<PlaneKey, number>;
  raw: RotationSnapshot;
}

export interface NormalizeOptions {
  range?: number;
  clamp?: boolean;
}

export function normalizeSnapshot(snapshot: RotationSnapshot, options: NormalizeOptions = {}): NormalizedSnapshot {
  const range = options.range ?? Math.PI;
  const clamp = options.clamp ?? true;
  const planes = {} as Record<PlaneKey, number>;
  let magnitude = 0;

  for (const plane of SIX_PLANE_KEYS) {
    const value = snapshot[plane];
    magnitude += Math.abs(value);
    let normalized = range === 0 ? 0 : value / range;
    if (clamp) {
      normalized = Math.min(1, Math.max(-1, normalized));
    }
    planes[plane] = normalized * 0.5 + 0.5;
  }

  magnitude /= SIX_PLANE_KEYS.length;

  return {
    timestamp: snapshot.timestamp,
    confidence: snapshot.confidence,
    magnitude,
    planes,
    raw: { ...snapshot }
  };
}

export function describeSnapshot(snapshot: NormalizedSnapshot): string {
  const planeSummary = SIX_PLANE_KEYS
    .map((plane) => `${plane}:${snapshot.planes[plane].toFixed(2)}`)
    .join(' ');
  return `σ=${snapshot.magnitude.toFixed(2)} · c=${snapshot.confidence.toFixed(2)} · ${planeSummary}`;
}
