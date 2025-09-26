import { describe, expect, it, vi } from 'vitest';
import { DatasetManifestBuilder, createManifestDownloadName } from './datasetManifest';

const sampleAngles: [number, number, number, number, number, number] = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

describe('DatasetManifestBuilder', () => {
  it('generates deterministic asset names and retains latency envelopes', () => {
    const builder = new DatasetManifestBuilder({ sessionId: 'test-session', prefix: 'sample' });
    builder.addFrame(
      {
        timestamp: 123,
        rotationAngles: sampleAngles,
        latency: {
          uniformMs: 2,
          captureMs: 3,
          captureTimestamp: 10,
          encodeMs: 5,
          totalMs: 10
        }
      },
      'image/png'
    );

    const manifest = builder.getManifest();
    expect(manifest.id).toBe('test-session');
    expect(manifest.frames).toHaveLength(1);
    expect(manifest.frames[0].assetName).toBe('sample-000001.png');
    expect(manifest.frames[0].latency?.totalMs).toBe(10);
    expect(manifest.stats.totalFrames).toBe(1);
    expect(manifest.stats.p95TotalLatencyMs).toBe(10);
  });

  it('rehydrates from an existing manifest and continues numbering', () => {
    const initial = new DatasetManifestBuilder({ prefix: 'frame' });
    initial.addFrame(
      {
        timestamp: 1,
        rotationAngles: sampleAngles,
        latency: { uniformMs: 1, captureMs: 2, captureTimestamp: 5, totalMs: 5 }
      },
      'image/png'
    );

    const resumed = new DatasetManifestBuilder({ hydrateFrom: initial.getManifest() });
    const added = resumed.addFrame(
      {
        timestamp: 2,
        rotationAngles: sampleAngles,
        latency: { uniformMs: 2, captureMs: 4, captureTimestamp: 8, encodeMs: 4 }
      },
      'image/webp'
    );

    expect(added.assetName).toBe('frame-000002.webp');
    const manifest = resumed.getManifest();
    expect(manifest.frames).toHaveLength(2);
    expect(manifest.stats.totalFrames).toBe(2);
    expect(manifest.stats.p95TotalLatencyMs).toBeGreaterThanOrEqual(manifest.stats.averageTotalLatencyMs);
    expect(manifest.stats.maxTotalLatencyMs).toBeGreaterThan(0);
  });

  it('calculates aggregate statistics even when total latency is omitted', () => {
    const builder = new DatasetManifestBuilder({ prefix: 'capture' });
    builder.addFrame(
      {
        timestamp: 3,
        rotationAngles: sampleAngles,
        latency: {
          uniformMs: 3,
          captureMs: 7,
          captureTimestamp: 11
        }
      },
      'image/png'
    );

    builder.addFrame(
      {
        timestamp: 4,
        rotationAngles: sampleAngles,
        latency: {
          uniformMs: 4,
          captureMs: 6,
          captureTimestamp: 12,
          encodeMs: 5
        }
      },
      'image/png'
    );

    const manifest = builder.getManifest();
    expect(manifest.stats.totalFrames).toBe(2);
    expect(manifest.stats.averageTotalLatencyMs).toBeGreaterThan(0);
    expect(manifest.stats.p95TotalLatencyMs).toBeGreaterThan(0);
  });

  it('creates sanitized manifest download names with timestamps', () => {
    vi.useFakeTimers();
    const now = new Date('2024-04-05T12:34:56.789Z');
    vi.setSystemTime(now);

    const builder = new DatasetManifestBuilder({ sessionId: 'Session 42', prefix: 'frame' });
    const manifest = builder.getManifest();

    const filename = createManifestDownloadName(manifest);
    expect(filename).toBe('session-42-2024-04-05T12-34-56-789Z.manifest.json');

    vi.useRealTimers();
  });
});
