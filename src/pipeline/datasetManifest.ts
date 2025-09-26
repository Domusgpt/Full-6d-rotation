import type { FrameFormat, FrameMetadata, PipelineLatencyEnvelope } from './datasetTypes';

export interface DatasetManifestFrame {
  assetName: string;
  format: FrameFormat;
  timestamp: number;
  rotationAngles: [number, number, number, number, number, number];
  latency?: PipelineLatencyEnvelope;
}

export interface DatasetManifestStatistics {
  totalFrames: number;
  averageTotalLatencyMs: number;
  p95TotalLatencyMs: number;
  minTotalLatencyMs: number;
  maxTotalLatencyMs: number;
  lastUpdated: number;
}

export interface DatasetManifest {
  id: string;
  createdAt: number;
  prefix: string;
  frames: DatasetManifestFrame[];
  stats: DatasetManifestStatistics;
}

export interface DatasetManifestBuilderOptions {
  sessionId?: string;
  prefix?: string;
  startIndex?: number;
  hydrateFrom?: DatasetManifest;
}

export const DATASET_MANIFEST_STORAGE_KEY = 'hypercube-core-dataset-manifest';

const DEFAULT_PREFIX = 'frame';
const DEFAULT_SESSION_PREFIX = 'dataset';

export class DatasetManifestBuilder {
  private readonly prefix: string;
  private manifest: DatasetManifest;
  private nextIndex: number;
  private readonly totalLatencies: number[] = [];

  constructor(options: DatasetManifestBuilderOptions = {}) {
    this.prefix = options.prefix ?? options.hydrateFrom?.prefix ?? DEFAULT_PREFIX;

    if (options.hydrateFrom) {
      this.manifest = cloneManifest(options.hydrateFrom);
      this.nextIndex = this.manifest.frames.length + (options.startIndex ?? 0);
      for (const frame of this.manifest.frames) {
        const latency = computeTotalLatency(frame.latency);
        if (latency !== null) {
          this.totalLatencies.push(latency);
        }
      }
      this.updateStatistics();
    } else {
      const sessionId = options.sessionId ?? createSessionId();
      this.manifest = {
        id: sessionId,
        createdAt: Date.now(),
        prefix: this.prefix,
        frames: [],
        stats: createEmptyStats()
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
      latency: metadata.latency
    };

    this.manifest.frames.push(frame);
    this.nextIndex += 1;

    const latency = computeTotalLatency(metadata.latency);
    if (latency !== null) {
      this.totalLatencies.push(latency);
    }

    this.updateStatistics();

    return frame;
  }

  getManifest(): DatasetManifest {
    return cloneManifest(this.manifest);
  }

  private createAssetName(format: FrameFormat): string {
    const extension = formatToExtension(format);
    const index = this.nextIndex + 1;
    return `${this.prefix}-${index.toString().padStart(6, '0')}.${extension}`;
  }

  private updateStatistics() {
    const count = this.manifest.frames.length;
    if (count === 0) {
      this.manifest.stats = createEmptyStats();
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
      lastUpdated: Date.now()
    };
  }
}

function createSessionId() {
  return `${DEFAULT_SESSION_PREFIX}-${Date.now().toString(36)}`;
}

function createEmptyStats(): DatasetManifestStatistics {
  return {
    totalFrames: 0,
    averageTotalLatencyMs: 0,
    p95TotalLatencyMs: 0,
    minTotalLatencyMs: 0,
    maxTotalLatencyMs: 0,
    lastUpdated: Date.now()
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

function cloneManifest(manifest: DatasetManifest): DatasetManifest {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(manifest);
  }
  return JSON.parse(JSON.stringify(manifest)) as DatasetManifest;
}
