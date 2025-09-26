import { afterEach, describe, expect, it } from 'vitest';
import { DatasetExportService, type EncodedFrame, type FrameFormat, type FramePayload } from './datasetExport';
import { encodeFramePayload } from './datasetEncoder';

type WorkerRequest = {
  id: number;
  format: FrameFormat;
  frames: FramePayload[];
};

type WorkerResponse = {
  id: number;
  frames: EncodedFrame[];
};

describe('DatasetExportService', () => {
  const nativeWorker = globalThis.Worker as typeof Worker | undefined;

  afterEach(() => {
    if (nativeWorker) {
      globalThis.Worker = nativeWorker;
    } else {
      (globalThis as { Worker?: typeof Worker }).Worker = undefined;
    }
  });

  it('encodes frames via JSON fallback when OffscreenCanvas is unavailable', async () => {
    const service = new DatasetExportService();
    expect(service.getMetrics()).toEqual({ pending: 0, totalEncoded: 0, lastFormat: null });
    service.enqueue({
      width: 2,
      height: 2,
      pixels: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
      metadata: {
        timestamp: 1,
        rotationAngles: [0, 0, 0, 0, 0, 0]
      }
    });
    expect(service.getMetrics().pending).toBe(1);
    const [frame] = await service.flush();
    expect(frame.metadata.timestamp).toBe(1);
    const text = await frame.blob.text();
    expect(text).toContain('checksum');
    expect(service.getMetrics()).toEqual({ pending: 0, totalEncoded: 1, lastFormat: 'image/png' });
  });

  it('dispatches frames to a worker when available', async () => {
    const calls: WorkerRequest[] = [];

    class MockWorker {
      public onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
      public onerror: ((event: ErrorEvent) => void) | null = null;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_: URL, __?: WorkerOptions) {}

      postMessage(data: WorkerRequest) {
        calls.push(data);
        Promise.resolve().then(async () => {
          if (!this.onmessage) return;
          const frames = await Promise.all(
            data.frames.map(async frame => ({
              blob: await encodeFramePayload(frame, data.format),
              metadata: frame.metadata
            }))
          );
          this.onmessage({ data: { id: data.id, frames } } as MessageEvent<WorkerResponse>);
        });
      }

      terminate() {}
    }

    globalThis.Worker = MockWorker as unknown as typeof Worker;

    const service = new DatasetExportService();
    service.enqueue({
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray([0, 0, 0, 255]),
      metadata: { timestamp: 2, rotationAngles: [0, 0, 0, 0, 0, 0] }
    });

    const frames = await service.flush('image/webp');
    expect(calls).toHaveLength(1);
    expect(frames).toHaveLength(1);
    expect(frames[0].metadata.timestamp).toBe(2);
    expect(service.getMetrics()).toEqual({ pending: 0, totalEncoded: 1, lastFormat: 'image/webp' });
  });
});
