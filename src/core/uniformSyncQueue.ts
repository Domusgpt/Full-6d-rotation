import type { RotationSnapshot } from './rotationUniforms';

export interface UniformSyncMetrics {
  enqueued: number;
  uploads: number;
  skipped: number;
  lastUploadTime: number;
  lastSnapshotTimestamp: number;
  lastUploadLatency: number;
}

export class UniformSyncQueue {
  private pending: RotationSnapshot | null = null;
  private metrics: UniformSyncMetrics = {
    enqueued: 0,
    uploads: 0,
    skipped: 0,
    lastUploadTime: performance.now(),
    lastSnapshotTimestamp: 0,
    lastUploadLatency: 0
  };

  enqueue(snapshot: RotationSnapshot) {
    this.metrics.enqueued += 1;
    if (this.pending) {
      this.metrics.skipped += 1;
    }
    this.pending = { ...snapshot };
  }

  consume(): RotationSnapshot | null {
    if (!this.pending) {
      return null;
    }
    const snapshot = this.pending;
    this.pending = null;
    this.metrics.uploads += 1;
    this.metrics.lastUploadTime = performance.now();
    this.metrics.lastSnapshotTimestamp = snapshot.timestamp;
    this.metrics.lastUploadLatency = Math.max(0, this.metrics.lastUploadTime - snapshot.timestamp);
    return snapshot;
  }

  getMetrics(): UniformSyncMetrics {
    return { ...this.metrics };
  }
}
