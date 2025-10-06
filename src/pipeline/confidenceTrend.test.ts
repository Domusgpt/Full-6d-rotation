import { describe, expect, it, vi } from 'vitest';
import {
  ConfidenceTrend,
  type ConfidenceTrendAnnotation,
  type ConfidenceTrendState
} from './confidenceTrend';

describe('ConfidenceTrend', () => {
  it('records normalized values, annotations, and trims to max points', () => {
    const trend = new ConfidenceTrend({ maxPoints: 3 });
    const annotation: ConfidenceTrendAnnotation = {
      profileId: 'default-imu',
      profileName: 'Default',
      confidenceFloor: 0.72,
      preprocessors: ['low-pass', 'gravity']
    };

    trend.record(0.2, 1000, annotation);
    trend.record(1.5, 2000, { profileId: 'smooth', confidenceFloor: 2 });
    trend.record(-3, 3000, null);
    trend.record(0.75, 4000, { profileId: 'default-imu', confidenceFloor: 0.9, preprocessors: ['low-pass'] });

    expect(trend.getValues()).toEqual([1, 0, 0.75]);
    const samples = trend.getSamples();
    expect(samples).toHaveLength(3);
    expect(samples[0]).toMatchObject({
      value: 1,
      timestamp: 2000,
      annotation: { profileId: 'smooth', confidenceFloor: 1 }
    });
    expect(samples[1]).toMatchObject({ value: 0, annotation: undefined });
    expect(samples[2]).toMatchObject({
      value: 0.75,
      timestamp: 4000,
      annotation: { preprocessors: ['low-pass'] }
    });
    expect(trend.getUpdatedAt()).toBe(4000);
  });

  it('ignores non-finite samples', () => {
    const trend = new ConfidenceTrend();
    trend.record(Number.NaN);
    trend.record(Number.POSITIVE_INFINITY);

    expect(trend.isEmpty()).toBe(true);
    expect(trend.getSamples()).toHaveLength(0);
    expect(trend.getUpdatedAt()).toBeNull();
  });

  it('hydrates from legacy value-only state', () => {
    const past = Date.now() - 10_000;
    const state: ConfidenceTrendState = {
      values: [0.1, 0.9, 2, -1, Number.NaN],
      maxPoints: 3,
      updatedAt: past
    };

    const trend = new ConfidenceTrend({ state });

    expect(trend.getValues()).toEqual([0.9, 1, 0]);
    expect(trend.getUpdatedAt()).toBe(past);
    for (const sample of trend.getSamples()) {
      expect(sample.timestamp).toBe(past);
    }
  });

  it('hydrates annotated samples from persisted state', () => {
    const state: ConfidenceTrendState = {
      values: [0.5, 0.2],
      samples: [
        {
          value: 0.5,
          timestamp: 500,
          annotation: {
            profileId: ' default-imu ',
            profileName: 'Default',
            confidenceFloor: 1.4,
            preprocessors: [' low-pass ', '', '   ']
          }
        },
        {
          value: 0.2,
          timestamp: -10,
          annotation: { profileId: '', confidenceFloor: -1 }
        }
      ],
      maxPoints: 4,
      updatedAt: 999
    };

    const trend = new ConfidenceTrend({ state });
    const samples = trend.getSamples();
    expect(samples).toEqual([
      {
        value: 0.5,
        timestamp: 500,
        annotation: {
          profileId: 'default-imu',
          profileName: 'Default',
          confidenceFloor: 1,
          preprocessors: ['low-pass']
        }
      },
      {
        value: 0.2,
        timestamp: undefined,
        annotation: undefined
      }
    ]);
    expect(trend.getUpdatedAt()).toBe(999);
  });

  it('serializes back to JSON payload with annotations', () => {
    const trend = new ConfidenceTrend({ maxPoints: 3 });
    const now = 1234567890;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    trend.record(0.25, now, { profileId: 'default-imu', profileName: 'Default', confidenceFloor: 0.8 });
    trend.record(0.75, now + 5000);
    vi.useRealTimers();

    expect(trend.toJSON()).toEqual({
      values: [0.25, 0.75],
      samples: [
        {
          value: 0.25,
          timestamp: now,
          annotation: {
            profileId: 'default-imu',
            profileName: 'Default',
            confidenceFloor: 0.8,
            preprocessors: []
          }
        },
        {
          value: 0.75,
          timestamp: now + 5000,
          annotation: undefined
        }
      ],
      maxPoints: 3,
      updatedAt: now + 5000
    });
  });

  it('clears stored values and timestamps', () => {
    const trend = new ConfidenceTrend({ maxPoints: 3 });
    trend.record(0.6, 2500, { profileId: 'default-imu', confidenceFloor: 0.6 });
    expect(trend.isEmpty()).toBe(false);

    trend.clear();

    expect(trend.isEmpty()).toBe(true);
    expect(trend.getSamples()).toHaveLength(0);
    expect(trend.getUpdatedAt()).toBeNull();
    expect(trend.toJSON().values).toEqual([]);
    expect(trend.toJSON().samples).toEqual([]);
  });
});
