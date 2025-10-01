import { describe, expect, it, vi } from 'vitest';
import { TelemetryLoom } from './telemetryLoom';

describe('TelemetryLoom', () => {
  it('retains the most recent events up to capacity', () => {
    const loom = new TelemetryLoom(3);
    loom.record({ category: 'system', message: 'A', timestamp: 1 });
    loom.record({ category: 'system', message: 'B', timestamp: 2 });
    loom.record({ category: 'system', message: 'C', timestamp: 3 });
    loom.record({ category: 'system', message: 'D', timestamp: 4 });

    const events = loom.list();
    expect(events).toHaveLength(3);
    expect(events.map(event => event.message)).toEqual(['B', 'C', 'D']);
  });

  it('clones metadata to avoid external mutation', () => {
    const loom = new TelemetryLoom();
    const metadata = { profileId: 'alpha' };
    loom.record({ category: 'parserator', message: 'Profile', metadata, timestamp: 10 });
    metadata.profileId = 'beta';

    const [event] = loom.list();
    expect(event.metadata).toEqual({ profileId: 'alpha' });
  });

  it('uses current time when timestamp is omitted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T03:04:05Z'));

    const loom = new TelemetryLoom(2);
    loom.record({ category: 'system', message: 'Auto time' });
    const [event] = loom.list();
    expect(event.timestamp).toBeCloseTo(Date.now(), 1);

    vi.useRealTimers();
  });

  it('creates snapshots and hydrates from persisted logs', () => {
    const loom = new TelemetryLoom(4);
    loom.record({ category: 'parserator', message: 'Profile selected', timestamp: 100 });
    loom.record({
      category: 'system',
      message: 'Hydrated',
      timestamp: 200,
      metadata: { source: 'localStorage' }
    });

    const snapshot = loom.snapshot();
    expect(snapshot.capacity).toBe(4);
    expect(snapshot.events).toHaveLength(2);

    const hydrated = new TelemetryLoom(3);
    hydrated.hydrate(snapshot);
    const events = hydrated.list();
    expect(events).toHaveLength(2);
    expect(events[1].metadata).toEqual({ source: 'localStorage' });

    hydrated.record({ category: 'system', message: 'New event', timestamp: 300 });
    const ids = hydrated.list().map(event => event.id);
    expect(ids[ids.length - 1]).toBeGreaterThan(snapshot.events[snapshot.events.length - 1].id);

    hydrated.hydrate(null);
    expect(hydrated.list()).toHaveLength(0);
  });
});
