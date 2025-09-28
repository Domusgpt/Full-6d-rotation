import { describe, expect, it, vi } from 'vitest';
import { MidiExtrumentAdapter, discoverMidiAdapters, type MidiOutputLike } from './midiExtrument';
import { type NormalizedSnapshot } from './extrumentHub';

const snapshot: NormalizedSnapshot = {
  timestamp: 100,
  confidence: 0.8,
  magnitude: 0.5,
  planes: { xy: 0.1, xz: 0.2, yz: 0.3, xw: 0.4, yw: 0.5, zw: 0.6 },
  raw: {
    xy: 0,
    xz: 0,
    yz: 0,
    xw: 0,
    yw: 0,
    zw: 0,
    timestamp: 100,
    confidence: 0.8
  }
};

describe('MidiExtrumentAdapter', () => {
  it('sends control change messages for each plane', async () => {
    const sent: (number[] | Uint8Array)[] = [];
    const output: MidiOutputLike = {
      id: 'out-1',
      send: (message) => {
        if (!message) return;
        sent.push(message);
      }
    };
    const adapter = new MidiExtrumentAdapter({ output });
    await adapter.connect();
    await adapter.send(snapshot);
    expect(sent).toHaveLength(8); // 6 planes + magnitude + confidence
    const first = Array.from(sent[0]);
    expect(first[1]).toBe(20);
    expect(first[2]).toBeGreaterThanOrEqual(0);
    expect(adapter.label).toBe('out-1');
  });
});

describe('discoverMidiAdapters', () => {
  it('selects the first output by default', async () => {
    const outputs: MidiOutputLike[] = [
      { id: 'first', send: vi.fn() },
      { id: 'second', send: vi.fn() }
    ];
    const adapters = await discoverMidiAdapters({
      accessFactory: async () => ({ outputs })
    });
    expect(adapters).toHaveLength(1);
    expect(adapters[0].id).toBe('midi:first');
  });

  it('returns empty list when selector rejects outputs', async () => {
    const adapters = await discoverMidiAdapters({
      accessFactory: async () => ({ outputs: [] }),
      selectOutput: () => undefined
    });
    expect(adapters).toHaveLength(0);
  });
});
