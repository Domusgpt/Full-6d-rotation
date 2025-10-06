export type TelemetryCategory = 'parserator' | 'ingestion' | 'extrument' | 'system';

export interface TelemetryEventInput {
  category: TelemetryCategory;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export interface TelemetryEvent {
  id: number;
  category: TelemetryCategory;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface TelemetryLogSnapshot {
  capacity: number;
  updatedAt: number;
  events: TelemetryEvent[];
}

export class TelemetryLoom {
  private readonly capacity: number;
  private events: TelemetryEvent[] = [];
  private counter = 0;

  constructor(capacity = 120) {
    this.capacity = Math.max(1, capacity);
  }

  record(event: TelemetryEventInput): TelemetryEvent[] {
    const entry: TelemetryEvent = {
      id: ++this.counter,
      category: event.category,
      message: event.message,
      timestamp: event.timestamp ?? now(),
      metadata: event.metadata ? cloneMetadata(event.metadata) : undefined
    };
    this.events = [...this.events.slice(-(this.capacity - 1)), entry];
    return this.list();
  }

  list(): TelemetryEvent[] {
    return this.events.map(event => ({
      ...event,
      metadata: event.metadata ? cloneMetadata(event.metadata) : undefined
    }));
  }

  snapshot(): TelemetryLogSnapshot {
    const events = this.list();
    const updatedAt = events.length ? events[events.length - 1].timestamp : Date.now();
    return {
      capacity: this.capacity,
      updatedAt,
      events
    };
  }

  hydrate(snapshot: TelemetryLogSnapshot | null | undefined): void {
    if (!snapshot) {
      this.events = [];
      this.counter = 0;
      return;
    }

    const limit = Math.max(1, Math.min(this.capacity, Math.floor(snapshot.capacity) || this.capacity));
    const sanitized = Array.isArray(snapshot.events)
      ? snapshot.events
          .map(normalizeHydratedEvent)
          .filter((event): event is TelemetryEvent => event !== null)
      : [];

    const trimmed = sanitized.slice(-limit);
    this.events = trimmed.map(event => ({
      ...event,
      metadata: event.metadata ? cloneMetadata(event.metadata) : undefined
    }));
    this.counter = this.events.reduce((max, event) => Math.max(max, event.id), 0);
  }

  getCapacity(): number {
    return this.capacity;
  }

  clear(): void {
    this.events = [];
  }
}

function now(): number {
  return Date.now();
}

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === 'function') {
    return structuredClone(metadata);
  }
  return JSON.parse(JSON.stringify(metadata));
}

function normalizeHydratedEvent(event: TelemetryEvent | undefined): TelemetryEvent | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const id = Number(event.id);
  const timestamp = Number(event.timestamp);
  if (!Number.isFinite(id) || !Number.isFinite(timestamp)) {
    return null;
  }

  if (typeof event.message !== 'string') {
    return null;
  }

  if (!isTelemetryCategory(event.category)) {
    return null;
  }

  return {
    id,
    category: event.category,
    message: event.message,
    timestamp,
    metadata: isPlainRecord(event.metadata) ? cloneMetadata(event.metadata) : undefined
  };
}

function isTelemetryCategory(value: unknown): value is TelemetryCategory {
  return value === 'parserator' || value === 'ingestion' || value === 'extrument' || value === 'system';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
