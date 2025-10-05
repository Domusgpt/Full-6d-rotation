import { describe, expect, it } from 'vitest';
import { LocalPspStream } from './pspStream';

const mockBlob = new Blob(['test'], { type: 'text/plain' });

describe('LocalPspStream', () => {
  it('notifies subscribers of frames', async () => {
    const stream = new LocalPspStream();
    let received = 0;
    stream.subscribe(frame => {
      received += frame.metadata.timestamp;
    });
    stream.publish({
      blob: mockBlob,
      metadata: { timestamp: 2, rotationAngles: [0, 0, 0, 0, 0, 0] }
    });
    expect(received).toBe(2);
  });
});
