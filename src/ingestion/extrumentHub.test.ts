import { describe, expect, it, vi } from 'vitest';
import type { RotationSnapshot } from '../core/rotationUniforms';
import { ExtrumentHub, normalizeSnapshot, describeSnapshot, type ExtrumentAdapter } from './extrumentHub';

const baseSnapshot: RotationSnapshot = {
  xy: Math.PI / 4,
  xz: -Math.PI / 6,
  yz: Math.PI / 8,
  xw: -Math.PI / 3,
  yw: 0.2,
  zw: -0.15,
  timestamp: 42,
  confidence: 0.9
};

describe('normalizeSnapshot', () => {
  it('normalizes angles into 0..1 range with default clamp', () => {
    const normalized = normalizeSnapshot(baseSnapshot);
    expect(normalized.planes.xy).toBeCloseTo(0.5 + 0.5 * (baseSnapshot.xy / Math.PI), 5);
    expect(normalized.planes.xz).toBeLessThan(0.5);
    expect(normalized.timestamp).toBe(baseSnapshot.timestamp);
    expect(normalized.raw.xy).toBe(baseSnapshot.xy);
  });

  it('respects unclamped mode', () => {
    const snapshot = { ...baseSnapshot, xy: Math.PI * 2 };
    const normalized = normalizeSnapshot(snapshot, { clamp: false });
    expect(normalized.planes.xy).toBeGreaterThan(1);
  });

  it('reports magnitude as mean absolute angle', () => {
    const normalized = normalizeSnapshot(baseSnapshot);
    const manual =
      (Math.abs(baseSnapshot.xy) +
        Math.abs(baseSnapshot.xz) +
        Math.abs(baseSnapshot.yz) +
        Math.abs(baseSnapshot.xw) +
        Math.abs(baseSnapshot.yw) +
        Math.abs(baseSnapshot.zw)) /
      6;
    expect(normalized.magnitude).toBeCloseTo(manual, 6);
  });

  it('describes snapshot with concise summary', () => {
    const normalized = normalizeSnapshot(baseSnapshot);
    const summary = describeSnapshot(normalized);
    expect(summary).toContain('σ=');
    expect(summary).toContain('xy:');
  });
});

describe('ExtrumentHub', () => {
  const createAdapter = (id: string): ExtrumentAdapter<number> => ({
    id,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined)
  });

  it('registers adapters and broadcasts transformed payloads', async () => {
    const adapter = createAdapter('alpha');
    const hub = new ExtrumentHub<number>({
      transform: (snapshot) => Math.round(snapshot.xy * 100)
    });
    hub.register(adapter);
    await hub.connect('alpha');
    await hub.broadcast(baseSnapshot);
    expect(adapter.send).toHaveBeenCalledWith(Math.round(baseSnapshot.xy * 100));
  });

  it('disconnects adapters that throw during send and surfaces errors', async () => {
    const adapter = createAdapter('beta');
    const error = new Error('failed');
    (adapter.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
    const onError = vi.fn();
    const hub = new ExtrumentHub<number>({ transform: () => 0, onError });
    hub.register(adapter);
    await hub.connect('beta');
    await hub.broadcast(baseSnapshot);
    expect(onError).toHaveBeenCalledWith(error, adapter);
  });

  it('throws when connecting unknown adapters', async () => {
    const hub = new ExtrumentHub();
    await expect(hub.connect('missing')).rejects.toThrow('Unknown adapter');
  });
});
