import { ConfidenceTrend } from './confidenceTrend';
import type { ConfidenceTrendState } from './confidenceTrend';
import type { FrameFormat, FrameMetadata, PipelineLatencyEnvelope } from './datasetTypes';
import type { TelemetryLogSnapshot, TelemetryEvent, TelemetryCategory } from './telemetryLoom';

export interface DatasetManifestFrame {
  assetName: string;
  format: FrameFormat;
  timestamp: number;
  rotationAngles: [number, number, number, number, number, number];
  confidence?: number;
  latency?: PipelineLatencyEnvelope;
}

export interface DatasetManifestStatistics {
  totalFrames: number;
  averageTotalLatencyMs: number;
  p95TotalLatencyMs: number;
  minTotalLatencyMs: number;
  maxTotalLatencyMs: number;
  lastUpdated: number;
  confidenceHistogram: ConfidenceHistogram;
}

export interface ConfidenceHistogram {
  bucketSize: number;
  counts: number[];
  totalSamples: number;
}

export interface DatasetIngestionConfig {
  profileId: string;
  profileName?: string;
  confidenceFloor: number;
  preprocessors: string[];
  updatedAt: number;
}

export interface DatasetManifest {
  id: string;
  createdAt: number;
  prefix: string;
  frames: DatasetManifestFrame[];
  stats: DatasetManifestStatistics;
  ingestion?: DatasetIngestionConfig;
  telemetry?: DatasetTelemetryLog;
  confidenceTrend?: ConfidenceTrendState;
}

export interface DatasetTelemetryLog extends TelemetryLogSnapshot {}

export interface DatasetManifestBuilderOptions {
  sessionId?: string;
  prefix?: string;
  startIndex?: number;
  hydrateFrom?: DatasetManifest;
}

export const DATASET_MANIFEST_STORAGE_KEY = 'hypercube-core-dataset-manifest';

const DEFAULT_PREFIX = 'frame';
const DEFAULT_SESSION_PREFIX = 'dataset';
const DEFAULT_CONFIDENCE_BUCKET_SIZE = 0.1;

export function createManifestDownloadName(manifest: DatasetManifest): string {
  const baseId = manifest.id.trim() || DEFAULT_SESSION_PREFIX;
  const normalizedId =
    baseId
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || DEFAULT_SESSION_PREFIX;
  const timestampSource = manifest.stats.lastUpdated || manifest.createdAt || Date.now();
  const timestamp = new Date(timestampSource).toISOString().replace(/[:.]/g, '-');
  return `${normalizedId}-${timestamp}.manifest.json`;
}

export class DatasetManifestBuilder {
  private readonly prefix: string;
  private manifest: DatasetManifest;
  private nextIndex: number;
  private readonly totalLatencies: number[] = [];
  private confidenceHistogram: ConfidenceHistogram;
  private confidenceTrend?: ConfidenceTrendState;

  constructor(options: DatasetManifestBuilderOptions = {}) {
    this.prefix = options.prefix ?? options.hydrateFrom?.prefix ?? DEFAULT_PREFIX;

    if (options.hydrateFrom) {
      this.manifest = cloneManifest(options.hydrateFrom);
      this.nextIndex = this.manifest.frames.length + (options.startIndex ?? 0);
      if (this.manifest.telemetry) {
        this.manifest.telemetry = normalizeTelemetryLog(this.manifest.telemetry);
      }
      const existingHistogram = this.manifest.stats.confidenceHistogram;
      if (existingHistogram) {
        this.confidenceHistogram = cloneHistogram(existingHistogram);
      } else {
        this.confidenceHistogram = createEmptyHistogram();
      }
      const hydratedTrend = normalizeConfidenceTrendState(this.manifest.confidenceTrend);
      if (hydratedTrend) {
        this.confidenceTrend = hydratedTrend;
      } else {
        delete this.manifest.confidenceTrend;
      }
      for (const frame of this.manifest.frames) {
        const latency = computeTotalLatency(frame.latency);
        if (latency !== null) {
          this.totalLatencies.push(latency);
        }
        if (!existingHistogram && typeof frame.confidence === 'number') {
          this.recordConfidence(frame.confidence);
        }
      }
      this.updateStatistics();
      this.syncConfidenceTrend();
    } else {
      const sessionId = options.sessionId ?? createSessionId();
      this.confidenceHistogram = createEmptyHistogram();
      this.manifest = {
        id: sessionId,
        createdAt: Date.now(),
        prefix: this.prefix,
        frames: [],
        stats: createEmptyStats(this.confidenceHistogram)
      };
      this.nextIndex = options.startIndex ?? 0;
    }
  }

  addFrame(metadata: FrameMetadata, format: FrameFormat): DatasetManifestFrame {
    const assetName = this.createAssetName(format);
    const frame: DatasetManifestFrame = {
      assetName,
      format,
      timestamp: metadata.timestamp,
      rotationAngles: metadata.rotationAngles,
      confidence: normalizeConfidence(metadata.confidence) ?? undefined,
      latency: metadata.latency
    };

    this.manifest.frames.push(frame);
    this.nextIndex += 1;

    const latency = computeTotalLatency(metadata.latency);
    if (latency !== null) {
      this.totalLatencies.push(latency);
    }

    if (typeof frame.confidence === 'number') {
      this.recordConfidence(frame.confidence);
    }

    this.updateStatistics();

    return frame;
  }

  getManifest(): DatasetManifest {
    this.syncConfidenceTrend();
    return cloneManifest(this.manifest);
  }

  updateIngestionConfig(config: Omit<DatasetIngestionConfig, 'updatedAt'>): void {
    this.manifest.ingestion = {
      ...config,
      updatedAt: Date.now()
    };
  }

  updateTelemetry(log: DatasetTelemetryLog | null | undefined): void {
    if (!log) {
      delete this.manifest.telemetry;
      return;
    }

    this.manifest.telemetry = normalizeTelemetryLog(log);
  }

  updateConfidenceTrend(state: ConfidenceTrendState | null | undefined): void {
    if (!state) {
      this.confidenceTrend = undefined;
      delete this.manifest.confidenceTrend;
      return;
    }

    const normalized = normalizeConfidenceTrendState(state);
    if (!normalized || normalized.values.length === 0) {
      this.confidenceTrend = undefined;
      delete this.manifest.confidenceTrend;
      return;
    }

    this.confidenceTrend = normalized;
    this.manifest.confidenceTrend = cloneConfidenceTrend(normalized);
  }

  private createAssetName(format: FrameFormat): string {
    const extension = formatToExtension(format);
    const index = this.nextIndex + 1;
    return `${this.prefix}-${index.toString().padStart(6, '0')}.${extension}`;
  }

  private updateStatistics() {
    const count = this.manifest.frames.length;
    if (count === 0) {
      const emptyHistogram = createEmptyHistogram(
        this.confidenceHistogram.bucketSize,
        this.confidenceHistogram.counts.length
      );
      this.confidenceHistogram = emptyHistogram;
      this.manifest.stats = createEmptyStats(emptyHistogram);
      this.syncConfidenceTrend();
      return;
    }

    const latencies = [...this.totalLatencies].sort((a, b) => a - b);
    const sum = this.totalLatencies.reduce((total, value) => total + value, 0);
    const average = this.totalLatencies.length ? sum / this.totalLatencies.length : 0;
    const min = this.totalLatencies.length ? latencies[0] : 0;
    const max = this.totalLatencies.length ? latencies[latencies.length - 1] : 0;
    const p95 = this.totalLatencies.length ? percentile(latencies, 0.95) : 0;

    this.manifest.stats = {
      totalFrames: count,
      averageTotalLatencyMs: average,
      minTotalLatencyMs: min,
      maxTotalLatencyMs: max,
      p95TotalLatencyMs: p95,
      lastUpdated: Date.now(),
      confidenceHistogram: cloneHistogram(this.confidenceHistogram)
    };
    this.syncConfidenceTrend();
  }

  private syncConfidenceTrend(): void {
    if (this.confidenceTrend && this.confidenceTrend.values.length > 0) {
      this.manifest.confidenceTrend = cloneConfidenceTrend(this.confidenceTrend);
    } else {
      delete this.manifest.confidenceTrend;
    }
  }

  private recordConfidence(value: number) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = clampConfidence(value);
    const { bucketSize, counts } = this.confidenceHistogram;
    if (counts.length === 0 || bucketSize <= 0) {
      return;
    }
    let index = Math.floor(normalized / bucketSize);
    if (normalized >= 1) {
      index = counts.length - 1;
    } else {
      index = Math.min(counts.length - 1, index);
    }
    counts[index] += 1;
    this.confidenceHistogram.totalSamples += 1;
  }
}

function createSessionId() {
  return `${DEFAULT_SESSION_PREFIX}-${Date.now().toString(36)}`;
}

function createEmptyStats(histogram: ConfidenceHistogram = createEmptyHistogram()): DatasetManifestStatistics {
  return {
    totalFrames: 0,
    averageTotalLatencyMs: 0,
    p95TotalLatencyMs: 0,
    minTotalLatencyMs: 0,
    maxTotalLatencyMs: 0,
    lastUpdated: Date.now(),
    confidenceHistogram: cloneHistogram(histogram)
  };
}

function formatToExtension(format: FrameFormat): string {
  switch (format) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/webm':
      return 'webm';
    default:
      return 'bin';
  }
}

function computeTotalLatency(envelope: PipelineLatencyEnvelope | undefined): number | null {
  if (!envelope) {
    return null;
  }
  if (typeof envelope.totalMs === 'number') {
    return envelope.totalMs;
  }
  const parts = [envelope.uniformMs, envelope.captureMs, envelope.encodeMs ?? 0].filter(
    value => typeof value === 'number' && Number.isFinite(value)
  ) as number[];
  if (!parts.length) {
    return null;
  }
  const total = parts.reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) ? total : null;
}

function percentile(sortedValues: number[], percentileRank: number): number {
  if (!sortedValues.length) {
    return 0;
  }
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * percentileRank) - 1);
  return sortedValues[index];
}

function createEmptyHistogram(
  bucketSize = DEFAULT_CONFIDENCE_BUCKET_SIZE,
  bucketCount?: number
): ConfidenceHistogram {
  const size = Math.max(bucketSize, 1e-6);
  const count = bucketCount ?? Math.max(1, Math.ceil(1 / size));
  return { bucketSize: size, counts: new Array(count).fill(0), totalSamples: 0 };
}

function cloneHistogram(histogram: ConfidenceHistogram): ConfidenceHistogram {
  return {
    bucketSize: histogram.bucketSize,
    counts: [...histogram.counts],
    totalSamples: histogram.totalSamples
  };
}

function normalizeConfidence(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return clampConfidence(value);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function cloneManifest(manifest: DatasetManifest): DatasetManifest {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(manifest);
  }
  return JSON.parse(JSON.stringify(manifest)) as DatasetManifest;
}

function normalizeTelemetryLog(log: DatasetTelemetryLog): DatasetTelemetryLog {
  const capacity = normalizeTelemetryCapacity(log.capacity);
  const events = Array.isArray(log.events)
    ? log.events
        .map(normalizeTelemetryEvent)
        .filter((event): event is TelemetryEvent => event !== null)
    : [];
  const trimmed = events.slice(-capacity);
  const updatedAt = normalizeTimestamp(log.updatedAt) ?? (trimmed.length ? trimmed[trimmed.length - 1].timestamp : Date.now());
  return {
    capacity,
    updatedAt,
    events: trimmed.map(event => ({
      ...event,
      metadata: event.metadata ? cloneMetadata(event.metadata) : undefined
    }))
  };
}

function normalizeTelemetryCapacity(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 1;
  }
  return Math.floor(numeric);
}

function normalizeTelemetryEvent(event: TelemetryEvent | undefined): TelemetryEvent | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  if (!isTelemetryCategory(event.category)) {
    return null;
  }

  if (typeof event.message !== 'string') {
    return null;
  }

  const id = Number(event.id);
  const timestamp = normalizeTimestamp(event.timestamp);
  if (!Number.isFinite(id) || typeof timestamp !== 'number') {
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

function normalizeTimestamp(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(metadata);
  }
  return JSON.parse(JSON.stringify(metadata));
}

function isTelemetryCategory(value: unknown): value is TelemetryCategory {
  return value === 'parserator' || value === 'ingestion' || value === 'extrument' || value === 'system';
}

function normalizeConfidenceTrendState(
  state: ConfidenceTrendState | null | undefined
): ConfidenceTrendState | undefined {
  if (!state) {
    return undefined;
  }

  try {
    const trend = new ConfidenceTrend({ state });
    const normalized = trend.toJSON();
    return normalized.samples && normalized.samples.length ? normalized : undefined;
  } catch {
    return undefined;
  }
}

function cloneConfidenceTrend(state: ConfidenceTrendState): ConfidenceTrendState {
  return {
    values: [...state.values],
    samples: state.samples?.map(sample => ({
      value: sample.value,
      timestamp: sample.timestamp,
      annotation: sample.annotation
        ? {
            profileId: sample.annotation.profileId,
            profileName: sample.annotation.profileName,
            confidenceFloor: sample.annotation.confidenceFloor,
            preprocessors: sample.annotation.preprocessors
              ? [...sample.annotation.preprocessors]
              : undefined
          }
        : undefined
    })),
    maxPoints: state.maxPoints,
    updatedAt: state.updatedAt
  };
}
