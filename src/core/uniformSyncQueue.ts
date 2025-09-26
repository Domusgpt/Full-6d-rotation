import type { RotationAngles } from './rotationUniforms';

export interface UniformSyncMetrics {
  enqueued: number;
  uploads: number;
  skipped: number;
  lastUploadTime: number;
}

export class UniformSyncQueue {
  private pending: RotationAngles | null = null;
  private metrics: UniformSyncMetrics = {
    enqueued: 0,
    uploads: 0,
    skipped: 0,
    lastUploadTime: performance.now()
  };

  enqueue(angles: RotationAngles) {
    this.metrics.enqueued += 1;
    if (this.pending) {
      this.metrics.skipped += 1;
    }
    this.pending = { ...angles };
  }

  consume(): RotationAngles | null {
    if (!this.pending) {
      return null;
    }
    const snapshot = this.pending;
    this.pending = null;
    this.metrics.uploads += 1;
    this.metrics.lastUploadTime = performance.now();
    return snapshot;
  }

  getMetrics(): UniformSyncMetrics {
    return { ...this.metrics };
  }
}
