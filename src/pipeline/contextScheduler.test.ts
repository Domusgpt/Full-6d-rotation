import { describe, expect, it } from 'vitest';
import { ContextScheduler } from './contextScheduler';

describe('ContextScheduler', () => {
  it('caps contexts and memory budgets', () => {
    const scheduler = new ContextScheduler();
    for (let i = 0; i < 25; i++) {
      scheduler.registerContext({
        id: `ctx-${i}`,
        priority: i < 5 ? 'critical' : 'background',
        memoryMB: 128
      });
    }
    const snapshot = scheduler.getSnapshot();
    expect(snapshot.active.length).toBeLessThanOrEqual(20);
    expect(snapshot.rejected.length).toBeGreaterThan(0);
    expect(snapshot.totalMemory).toBeLessThanOrEqual(4096);
  });
});
