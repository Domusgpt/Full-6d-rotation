import { describe, expect, it, vi } from 'vitest';
import { DatasetManifestBuilder, createManifestDownloadName, type DatasetTelemetryLog } from './datasetManifest';
import type { ConfidenceTrendState } from './confidenceTrend';

const sampleAngles: [number, number, number, number, number, number] = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

describe('DatasetManifestBuilder', () => {
  it('generates deterministic asset names and retains latency envelopes', () => {
    const builder = new DatasetManifestBuilder({ sessionId: 'test-session', prefix: 'sample' });
    builder.addFrame(
      {
        timestamp: 123,
        rotationAngles: sampleAngles,
        confidence: 0.72,
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
    expect(manifest.frames[0].confidence).toBeCloseTo(0.72, 5);
    expect(manifest.frames[0].latency?.totalMs).toBe(10);
    expect(manifest.stats.totalFrames).toBe(1);
    expect(manifest.stats.p95TotalLatencyMs).toBe(10);
    expect(manifest.stats.confidenceHistogram.totalSamples).toBe(1);
    const histogram = manifest.stats.confidenceHistogram.counts;
    expect(histogram.reduce((sum, value) => sum + value, 0)).toBe(1);
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
        confidence: 0.91,
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
    expect(manifest.stats.confidenceHistogram.totalSamples).toBeGreaterThanOrEqual(1);
  });

  it('calculates aggregate statistics even when total latency is omitted', () => {
    const builder = new DatasetManifestBuilder({ prefix: 'capture' });
    builder.addFrame(
      {
        timestamp: 3,
        rotationAngles: sampleAngles,
        confidence: 0.42,
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
        confidence: 0.96,
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
    expect(manifest.stats.confidenceHistogram.totalSamples).toBe(2);
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

  it('records and rehydrates parserator ingestion metadata', () => {
    const builder = new DatasetManifestBuilder({ sessionId: 'ingestion-session' });
    builder.updateIngestionConfig({
      profileId: 'default-imu',
      profileName: 'Default IMU',
      confidenceFloor: 0.65,
      preprocessors: ['low-pass', 'gravity']
    });

    const manifest = builder.getManifest();
    expect(manifest.ingestion?.profileId).toBe('default-imu');
    expect(manifest.ingestion?.preprocessors).toEqual(['low-pass', 'gravity']);
    expect(manifest.ingestion?.updatedAt).toBeGreaterThan(0);

    const rehydrated = new DatasetManifestBuilder({ hydrateFrom: manifest });
    expect(rehydrated.getManifest().ingestion?.profileId).toBe('default-imu');
  });

  it('rehydrates confidence histograms and tracks new samples', () => {
    const builder = new DatasetManifestBuilder({ sessionId: 'confidence-session' });
    builder.addFrame(
      { timestamp: 10, rotationAngles: sampleAngles, confidence: 0.95 },
      'image/png'
    );
    builder.addFrame(
      { timestamp: 11, rotationAngles: sampleAngles, confidence: 0.45 },
      'image/png'
    );

    const manifest = builder.getManifest();
    const rehydrated = new DatasetManifestBuilder({ hydrateFrom: manifest });
    const before = rehydrated.getManifest().stats.confidenceHistogram;
    expect(before.totalSamples).toBe(2);

    rehydrated.addFrame(
      { timestamp: 12, rotationAngles: sampleAngles, confidence: 0.88 },
      'image/png'
    );

    const after = rehydrated.getManifest().stats.confidenceHistogram;
    expect(after.totalSamples).toBe(3);
    expect(after.counts.reduce((sum, value) => sum + value, 0)).toBe(3);
  });

  it('persists telemetry events and rehydrates them from storage', () => {
    const builder = new DatasetManifestBuilder({ sessionId: 'telemetry-session' });
    const snapshot: DatasetTelemetryLog = {
      capacity: 5,
      updatedAt: 5000,
      events: [
        {
          id: 1,
          category: 'parserator',
          message: 'Profile selected',
          timestamp: 1000,
          metadata: { profileId: 'default' }
        },
        {
          id: 2,
          category: 'system',
          message: 'Hydrated',
          timestamp: 2000
        }
      ]
    };

    builder.updateTelemetry(snapshot);

    const manifest = builder.getManifest();
    expect(manifest.telemetry?.capacity).toBe(5);
    expect(manifest.telemetry?.events).toHaveLength(2);
    expect(manifest.telemetry?.events[0].metadata).toEqual({ profileId: 'default' });

    const mutated = manifest.telemetry!;
    if (mutated.events[0].metadata) {
      mutated.events[0].metadata.profileId = 'mutated';
    }

    const manifestAfterMutation = builder.getManifest();
    expect(manifestAfterMutation.telemetry?.events[0].metadata).toEqual({ profileId: 'default' });

    const resumed = new DatasetManifestBuilder({ hydrateFrom: manifest });
    const resumedTelemetry = resumed.getManifest().telemetry;
    expect(resumedTelemetry?.events).toHaveLength(2);
    expect(resumedTelemetry?.events[1].message).toBe('Hydrated');

    resumed.updateTelemetry({
      capacity: 1,
      updatedAt: 9000,
      events: [
        { id: 10, category: 'parserator', message: 'Trimmed out', timestamp: 3000 },
        { id: 11, category: 'parserator', message: 'Latest', timestamp: 4000 }
      ]
    });

    const trimmed = resumed.getManifest().telemetry;
    expect(trimmed?.capacity).toBe(1);
    expect(trimmed?.events).toHaveLength(1);
    expect(trimmed?.events[0].id).toBe(11);
  });

  it('stores confidence trend samples and rehydrates them', () => {
    const builder = new DatasetManifestBuilder({ sessionId: 'trend-session' });
    const trendState: ConfidenceTrendState = {
      values: [0.2, 1.4, -0.5],
      samples: [
        {
          value: 0.2,
          timestamp: 1000,
          annotation: {
            profileId: 'default-imu',
            profileName: 'Default IMU',
            confidenceFloor: 0.6,
            preprocessors: ['low-pass']
          }
        },
        {
          value: 1.4,
          timestamp: 1100,
          annotation: {
            profileId: 'smooth-orbit',
            confidenceFloor: 0.55,
            preprocessors: []
          }
        },
        {
          value: -0.5,
          timestamp: 1200,
          annotation: {
            profileId: 'high-gain-imu',
            profileName: 'High Gain',
            confidenceFloor: 0.3
          }
        }
      ],
      maxPoints: 60,
      updatedAt: 1234
    };

    builder.updateConfidenceTrend(trendState);

    const manifest = builder.getManifest();
    expect(manifest.confidenceTrend).toBeDefined();
    expect(manifest.confidenceTrend?.values).toEqual([0.2, 1, 0]);
    expect(manifest.confidenceTrend?.samples).toEqual([
      {
        value: 0.2,
        timestamp: 1000,
        annotation: {
          profileId: 'default-imu',
          profileName: 'Default IMU',
          confidenceFloor: 0.6,
          preprocessors: ['low-pass']
        }
      },
      {
        value: 1,
        timestamp: 1100,
        annotation: {
          profileId: 'smooth-orbit',
          confidenceFloor: 0.55,
          preprocessors: []
        }
      },
      {
        value: 0,
        timestamp: 1200,
        annotation: {
          profileId: 'high-gain-imu',
          profileName: 'High Gain',
          confidenceFloor: 0.3,
          preprocessors: []
        }
      }
    ]);
    expect(manifest.confidenceTrend?.maxPoints).toBe(60);
    expect(manifest.confidenceTrend?.updatedAt).toBe(1234);

    const rehydrated = new DatasetManifestBuilder({ hydrateFrom: manifest });
    const rehydratedTrend = rehydrated.getManifest().confidenceTrend;
    expect(rehydratedTrend?.values).toEqual([0.2, 1, 0]);
    expect(rehydratedTrend?.samples).toEqual(manifest.confidenceTrend?.samples);

    builder.updateConfidenceTrend({ values: [], samples: [], maxPoints: 10, updatedAt: 0 });
    expect(builder.getManifest().confidenceTrend).toBeUndefined();
  });
});
