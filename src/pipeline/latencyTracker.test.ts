import { describe, expect, it } from 'vitest';
import type { UniformSyncMetrics } from '../core/uniformSyncQueue';
import { LatencyTracker } from './latencyTracker';

const baseMetrics: UniformSyncMetrics = {
  enqueued: 0,
  uploads: 0,
  skipped: 0,
  lastUploadTime: 0,
  lastSnapshotTimestamp: 0,
  lastUploadLatency: 0
};

describe('LatencyTracker', () => {
  it('records uniform and capture latencies without duplicating samples', () => {
    const tracker = new LatencyTracker(4);
    tracker.recordUniform({ ...baseMetrics, uploads: 1, lastUploadTime: 10, lastSnapshotTimestamp: 2, lastUploadLatency: 8 });
    tracker.recordUniform({ ...baseMetrics, uploads: 1, lastUploadTime: 10, lastSnapshotTimestamp: 2, lastUploadLatency: 8 });
    tracker.recordUniform({ ...baseMetrics, uploads: 2, lastUploadTime: 22, lastSnapshotTimestamp: 5, lastUploadLatency: 17 });

    tracker.recordCapture(5, 25);
    tracker.recordCapture(5, 30);
    tracker.recordCapture(10, 32);

    const metrics = tracker.getMetrics();
    expect(metrics.uniformAvgMs).toBeCloseTo((8 + 17) / 2);
    expect(metrics.uniformMaxMs).toBeCloseTo(17);
    expect(metrics.captureAvgMs).toBeCloseTo(((25 - 5) + (32 - 10)) / 2);
    expect(metrics.captureMaxMs).toBeCloseTo(22);
  });

  it('tracks encode latency samples', () => {
    const tracker = new LatencyTracker(3);
    tracker.recordEncode(4);
    tracker.recordEncode(6);
    tracker.recordEncode(8);
    tracker.recordEncode(10);

    const metrics = tracker.getMetrics();
    expect(metrics.encodeAvgMs).toBeCloseTo((6 + 8 + 10) / 3);
    expect(metrics.encodeMaxMs).toBeCloseTo(10);
  });
});
