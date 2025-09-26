import { describe, expect, it } from 'vitest';
import { DatasetExportService, type WorkerLike } from './datasetExport';
import type { FrameFormat, FramePayload } from './datasetTypes';
import { encodeFramePayload } from './frameEncoding';

const SAMPLE_FRAME: FramePayload = {
  width: 2,
  height: 2,
  pixels: new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 255, 255
  ]),
  metadata: {
    timestamp: 1,
    rotationAngles: [0, 0, 0, 0, 0, 0]
  }
};

class StubWorker implements WorkerLike {
  public onmessage: ((event: MessageEvent<any>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public readonly requests: { id: number; format: FrameFormat }[] = [];
  public terminated = false;

  postMessage(message: { id: number; frame: FramePayload; format: FrameFormat }) {
    this.requests.push({ id: message.id, format: message.format });
    queueMicrotask(async () => {
      try {
        const blob = await encodeFramePayload(message.frame, message.format);
        this.onmessage?.({
          data: {
            success: true,
            id: message.id,
            format: message.format,
            metadata: message.frame.metadata,
            blob
          }
        } as MessageEvent);
      } catch (error) {
        this.onerror?.({ message: (error as Error).message } as ErrorEvent);
      }
    });
  }

  terminate() {
    this.terminated = true;
  }
}

describe('DatasetExportService', () => {
  it('encodes frames via JSON fallback when OffscreenCanvas is unavailable', async () => {
    const service = new DatasetExportService({ createWorker: () => null });
    expect(service.getMetrics()).toEqual({ pending: 0, totalEncoded: 0, lastFormat: null });
    service.enqueue(structuredClone(SAMPLE_FRAME));
    expect(service.getMetrics().pending).toBe(1);
    const [frame] = await service.flush();
    expect(frame.metadata.timestamp).toBe(1);
    const text = await frame.blob.text();
    expect(text).toContain('checksum');
    expect(service.getMetrics()).toEqual({ pending: 0, totalEncoded: 1, lastFormat: 'image/png' });
  });

  it('delegates encoding to a worker when available', async () => {
    const worker = new StubWorker();
    const service = new DatasetExportService({ createWorker: () => worker });
    service.enqueue(structuredClone(SAMPLE_FRAME));
    const [frame] = await service.flush('image/webp');
    expect(worker.requests).toHaveLength(1);
    expect(frame.metadata.timestamp).toBe(1);
    expect(service.getMetrics()).toEqual({ pending: 0, totalEncoded: 1, lastFormat: 'image/webp' });
    expect(worker.terminated).toBe(false);
  });
});
