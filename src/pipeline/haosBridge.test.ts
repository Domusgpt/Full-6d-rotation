import { describe, expect, it, vi } from 'vitest';
import { HaosBridge } from './haosBridge';
import { FocusDirector } from './focusDirector';
import { RotationBus } from './rotationBus';

const mockFocusDirector = {
  ingestHint: vi.fn()
} as unknown as FocusDirector;

describe('HaosBridge', () => {
  it('dispatches focus profile updates', () => {
    const bridge = new HaosBridge(mockFocusDirector);
    const response = bridge.handleRequest({ id: 1, method: 'setFocusProfile', params: { geometry: 'tesseract' } });
    expect(response.result).toBe('ok');
  });

  it('returns method not found for unknown calls', () => {
    const bridge = new HaosBridge(mockFocusDirector);
    const response = bridge.handleRequest({ id: 2, method: 'unknown' });
    expect(response.error?.code).toBe(-32601);
  });
});
