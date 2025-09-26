import type { UniformSyncMetrics } from '../core/uniformSyncQueue';

interface RollingStats {
  push(value: number): void;
  average(): number;
  max(): number;
}

class FixedWindowStats implements RollingStats {
  private readonly values: number[] = [];
  private total = 0;

  constructor(private readonly windowSize = 32) {}

  push(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.values.push(value);
    this.total += value;
    if (this.values.length > this.windowSize) {
      const removed = this.values.shift();
      if (removed !== undefined) {
        this.total -= removed;
      }
    }
  }

  average(): number {
    if (this.values.length === 0) {
      return 0;
    }
    return this.total / this.values.length;
  }

  max(): number {
    if (this.values.length === 0) {
      return 0;
    }
    return Math.max(...this.values);
  }
}

export interface PipelineLatencyMetrics {
  uniformAvgMs: number;
  uniformMaxMs: number;
  captureAvgMs: number;
  captureMaxMs: number;
  encodeAvgMs: number;
  encodeMaxMs: number;
}

export class LatencyTracker {
  private readonly uniformStats: RollingStats;
  private readonly captureStats: RollingStats;
  private readonly encodeStats: RollingStats;
  private lastUniformUploads = 0;
  private lastUniformTime = 0;
  private lastCaptureTimestamp = 0;

  constructor(windowSize = 32) {
    this.uniformStats = new FixedWindowStats(windowSize);
    this.captureStats = new FixedWindowStats(windowSize);
    this.encodeStats = new FixedWindowStats(windowSize);
  }

  recordUniform(metrics: UniformSyncMetrics) {
    if (metrics.uploads === this.lastUniformUploads) {
      return;
    }
    this.lastUniformUploads = metrics.uploads;
    if (metrics.lastUploadTime === this.lastUniformTime) {
      return;
    }
    this.lastUniformTime = metrics.lastUploadTime;
    const latency = metrics.lastUploadLatency;
    if (metrics.lastSnapshotTimestamp > 0 && latency >= 0) {
      this.uniformStats.push(latency);
    }
  }

  recordCapture(snapshotTimestamp: number, captureTime: number) {
    if (snapshotTimestamp <= this.lastCaptureTimestamp) {
      return;
    }
    this.lastCaptureTimestamp = snapshotTimestamp;
    const latency = Math.max(0, captureTime - snapshotTimestamp);
    this.captureStats.push(latency);
  }

  recordEncode(latencyMs: number) {
    this.encodeStats.push(latencyMs);
  }

  getMetrics(): PipelineLatencyMetrics {
    return {
      uniformAvgMs: this.uniformStats.average(),
      uniformMaxMs: this.uniformStats.max(),
      captureAvgMs: this.captureStats.average(),
      captureMaxMs: this.captureStats.max(),
      encodeAvgMs: this.encodeStats.average(),
      encodeMaxMs: this.encodeStats.max()
    };
  }
}
