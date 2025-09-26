import { describe, expect, it } from 'vitest';
import { UniformSyncQueue } from './uniformSyncQueue';

describe('UniformSyncQueue', () => {
  it('only exposes the latest snapshot per frame', () => {
    const queue = new UniformSyncQueue();
    queue.enqueue({ xy: 0.1, xz: 0.2, yz: 0.3, xw: 0, yw: 0, zw: 0 });
    queue.enqueue({ xy: 0.5, xz: 0.6, yz: 0.7, xw: 0, yw: 0, zw: 0 });
    const snapshot = queue.consume();
    expect(snapshot?.xy).toBeCloseTo(0.5);
    expect(queue.consume()).toBeNull();
  });
});
