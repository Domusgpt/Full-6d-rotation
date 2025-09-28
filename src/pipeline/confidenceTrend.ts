export interface ConfidenceTrendAnnotationState {
  profileId: string;
  profileName?: string;
  confidenceFloor: number;
  preprocessors?: string[];
}

export interface ConfidenceTrendSampleState {
  value: number;
  timestamp?: number;
  annotation?: ConfidenceTrendAnnotationState | null;
}

export interface ConfidenceTrendState {
  values: number[];
  samples?: ConfidenceTrendSampleState[];
  maxPoints?: number;
  updatedAt?: number;
}

export interface ConfidenceTrendAnnotation {
  profileId: string;
  profileName?: string;
  confidenceFloor: number;
  preprocessors?: string[];
}

export interface ConfidenceTrendSample {
  value: number;
  timestamp?: number;
  annotation?: ConfidenceTrendAnnotation;
}

export interface ConfidenceTrendOptions {
  maxPoints?: number;
  state?: ConfidenceTrendState | null;
}

export const DATASET_CONFIDENCE_TREND_STORAGE_KEY = 'hypercube-core-confidence-trend';

const DEFAULT_MAX_POINTS = 48;
const MAX_ALLOWED_POINTS = 512;
const MIN_ALLOWED_POINTS = 1;

type InternalSample = {
  value: number;
  timestamp: number | null;
  annotation?: InternalAnnotation;
};

type InternalAnnotation = {
  profileId: string;
  profileName?: string;
  confidenceFloor: number;
  preprocessors: string[];
};

export class ConfidenceTrend {
  private samples: InternalSample[];
  private maxPoints: number;
  private updatedAt: number;

  constructor(options: ConfidenceTrendOptions = {}) {
    const state = options.state ?? null;
    this.maxPoints = sanitizeMaxPoints(options.maxPoints ?? state?.maxPoints);

    this.samples = [];
    if (state?.samples && Array.isArray(state.samples)) {
      for (const sample of state.samples) {
        const sanitized = sanitizeSample(sample);
        if (sanitized) {
          this.samples.push(sanitized);
        }
      }
    }

    if (this.samples.length === 0 && state && Array.isArray(state.values)) {
      const sanitizedValues = state.values
        .map(normalizeValue)
        .filter((value): value is number => value !== null);
      const timestamp = normalizeTimestamp(state.updatedAt);
      for (const value of sanitizedValues) {
        this.samples.push({ value, timestamp: timestamp ?? null });
      }
    }

    if (this.samples.length > this.maxPoints) {
      this.samples = this.samples.slice(-this.maxPoints);
    }

    const hydratedTimestamp = normalizeTimestamp(state?.updatedAt);
    if (this.samples.length === 0) {
      this.updatedAt = 0;
    } else if (typeof hydratedTimestamp === 'number') {
      this.updatedAt = hydratedTimestamp;
    } else {
      const last = this.samples[this.samples.length - 1];
      if (!last.timestamp) {
        const now = Date.now();
        last.timestamp = now;
        this.updatedAt = now;
      } else {
        this.updatedAt = last.timestamp;
      }
    }
  }

  record(
    value: number,
    timestamp: number = Date.now(),
    annotation: ConfidenceTrendAnnotation | null | undefined = undefined
  ): void {
    const normalized = normalizeValue(value);
    if (normalized === null) {
      return;
    }

    const validTimestamp = normalizeTimestamp(timestamp) ?? Date.now();
    const sanitizedAnnotation = sanitizeAnnotation(annotation);

    this.samples.push({ value: normalized, timestamp: validTimestamp, annotation: sanitizedAnnotation });
    if (this.samples.length > this.maxPoints) {
      this.samples.splice(0, this.samples.length - this.maxPoints);
    }

    this.updatedAt = validTimestamp;
  }

  clear(): void {
    this.samples = [];
    this.updatedAt = 0;
  }

  getValues(): readonly number[] {
    return this.samples.map(sample => sample.value);
  }

  getSamples(): ReadonlyArray<ConfidenceTrendSample> {
    return this.samples.map(sample => ({
      value: sample.value,
      timestamp: sample.timestamp ?? undefined,
      annotation: sample.annotation
        ? { ...sample.annotation }
        : undefined
    }));
  }

  isEmpty(): boolean {
    return this.samples.length === 0;
  }

  getUpdatedAt(): number | null {
    if (this.samples.length === 0) {
      return null;
    }
    return this.updatedAt || null;
  }

  toJSON(): ConfidenceTrendState {
    const samples = this.samples.map(sample => ({
      value: sample.value,
      timestamp: sample.timestamp ?? undefined,
      annotation: sample.annotation ? { ...sample.annotation } : undefined
    }));

    return {
      values: samples.map(sample => sample.value),
      samples,
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

function sanitizeSample(sample: ConfidenceTrendSampleState | null | undefined): InternalSample | null {
  if (!sample || typeof sample !== 'object') {
    return null;
  }

  const normalizedValue = normalizeValue(sample.value);
  if (normalizedValue === null) {
    return null;
  }

  const timestamp = normalizeTimestamp(sample.timestamp);
  const annotation = sanitizeAnnotation(sample.annotation ?? undefined);

  return {
    value: normalizedValue,
    timestamp: timestamp ?? null,
    annotation
  };
}

function sanitizeAnnotation(
  annotation: ConfidenceTrendAnnotation | ConfidenceTrendAnnotationState | null | undefined
): InternalAnnotation | undefined {
  if (!annotation || typeof annotation !== 'object') {
    return undefined;
  }

  const profileId = typeof annotation.profileId === 'string' ? annotation.profileId.trim() : '';
  if (!profileId) {
    return undefined;
  }

  const profileName = typeof annotation.profileName === 'string' ? annotation.profileName : undefined;
  const floorNumeric = Number(annotation.confidenceFloor);
  const confidenceFloor = Number.isFinite(floorNumeric)
    ? Math.min(Math.max(floorNumeric, 0), 1)
    : 0;

  let preprocessors: string[] = [];
  if (Array.isArray(annotation.preprocessors)) {
    preprocessors = annotation.preprocessors
      .map(entry => (typeof entry === 'string' ? entry.trim() : String(entry)))
      .filter(entry => entry.length > 0);
  }

  return {
    profileId,
    profileName,
    confidenceFloor,
    preprocessors
  };
}
