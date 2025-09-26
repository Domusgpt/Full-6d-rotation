export interface ConfidenceTrendState {
  values: number[];
  maxPoints?: number;
  updatedAt?: number;
}

export interface ConfidenceTrendOptions {
  maxPoints?: number;
  state?: ConfidenceTrendState | null;
}

export const DATASET_CONFIDENCE_TREND_STORAGE_KEY = 'hypercube-core-confidence-trend';

const DEFAULT_MAX_POINTS = 48;
const MAX_ALLOWED_POINTS = 512;
const MIN_ALLOWED_POINTS = 1;

export class ConfidenceTrend {
  private values: number[];
  private maxPoints: number;
  private updatedAt: number;

  constructor(options: ConfidenceTrendOptions = {}) {
    const state = options.state ?? null;
    this.maxPoints = sanitizeMaxPoints(options.maxPoints ?? state?.maxPoints);

    if (state && Array.isArray(state.values)) {
      this.values = state.values
        .map(normalizeValue)
        .filter((value): value is number => value !== null);
    } else {
      this.values = [];
    }

    if (this.values.length > this.maxPoints) {
      this.values = this.values.slice(-this.maxPoints);
    }

    const hydratedTimestamp = normalizeTimestamp(state?.updatedAt);
    if (this.values.length === 0) {
      this.updatedAt = 0;
    } else {
      this.updatedAt = hydratedTimestamp ?? Date.now();
    }
  }

  record(value: number, timestamp: number = Date.now()): void {
    const normalized = normalizeValue(value);
    if (normalized === null) {
      return;
    }

    this.values.push(normalized);
    if (this.values.length > this.maxPoints) {
      this.values.splice(0, this.values.length - this.maxPoints);
    }

    const validTimestamp = normalizeTimestamp(timestamp);
    this.updatedAt = validTimestamp ?? Date.now();
  }

  clear(): void {
    this.values = [];
    this.updatedAt = 0;
  }

  getValues(): readonly number[] {
    return this.values;
  }

  isEmpty(): boolean {
    return this.values.length === 0;
  }

  getUpdatedAt(): number | null {
    if (this.values.length === 0) {
      return null;
    }
    return this.updatedAt || null;
  }

  toJSON(): ConfidenceTrendState {
    return {
      values: [...this.values],
      maxPoints: this.maxPoints,
      updatedAt: this.getUpdatedAt() ?? 0
    };
  }
}

function sanitizeMaxPoints(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_MAX_POINTS;
  }
  const bounded = Math.min(Math.max(Math.floor(numeric), MIN_ALLOWED_POINTS), MAX_ALLOWED_POINTS);
  return bounded;
}

function normalizeValue(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (numeric <= 0) {
    return 0;
  }
  if (numeric >= 1) {
    return 1;
  }
  return numeric;
}

function normalizeTimestamp(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}
