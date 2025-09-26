import { describe, expect, it, vi } from 'vitest';
import {
  ConfidenceTrend,
  type ConfidenceTrendState
} from './confidenceTrend';

describe('ConfidenceTrend', () => {
  it('records normalized values and trims to max points', () => {
    const trend = new ConfidenceTrend({ maxPoints: 4 });
    trend.record(0.2);
    trend.record(1.5);
    trend.record(-3);
    trend.record(0.75);
    trend.record(0.5);

    expect(trend.getValues()).toEqual([1, 0, 0.75, 0.5]);
    expect(trend.getUpdatedAt()).not.toBeNull();
  });

  it('ignores non-finite samples', () => {
    const trend = new ConfidenceTrend();
    trend.record(Number.NaN);
    trend.record(Number.POSITIVE_INFINITY);

    expect(trend.isEmpty()).toBe(true);
    expect(trend.getUpdatedAt()).toBeNull();
  });

  it('hydrates from persisted state', () => {
    const past = Date.now() - 10_000;
    const state: ConfidenceTrendState = {
      values: [0.1, 0.9, 2, -1, Number.NaN],
      maxPoints: 3,
      updatedAt: past
    };

    const trend = new ConfidenceTrend({ state });

    expect(trend.getValues()).toEqual([0.9, 1, 0]);
    expect(trend.getUpdatedAt()).toBeGreaterThan(0);
  });

  it('serializes back to JSON payload', () => {
    const trend = new ConfidenceTrend({ maxPoints: 3 });
    const now = 1234567890;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    trend.record(0.25);
    trend.record(0.75, now + 5000);
    vi.useRealTimers();

    expect(trend.toJSON()).toEqual({
      values: [0.25, 0.75],
      maxPoints: 3,
      updatedAt: now + 5000
    });
  });

  it('clears stored values and timestamps', () => {
    const trend = new ConfidenceTrend({ maxPoints: 3 });
    trend.record(0.6);
    expect(trend.isEmpty()).toBe(false);

    trend.clear();

    expect(trend.isEmpty()).toBe(true);
    expect(trend.getUpdatedAt()).toBeNull();
    expect(trend.toJSON().values).toEqual([]);
  });
});
