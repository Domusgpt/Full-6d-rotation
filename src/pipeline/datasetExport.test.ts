import { afterEach, describe, expect, it } from 'vitest';
import { DatasetExportService } from './datasetExport';
import { calculateChecksum } from './frameEncoding';

const originalWorker = globalThis.Worker;

afterEach(() => {
  if (originalWorker) {
    globalThis.Worker = originalWorker;
  } else {
    delete (globalThis as { Worker?: typeof Worker }).Worker;
  }
});

describe('DatasetExportService', () => {
  it('encodes frames via JSON fallback when OffscreenCanvas is unavailable', async () => {
    delete (globalThis as { Worker?: typeof Worker }).Worker;

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

  it('dispatches frames through the worker when available', async () => {
    class FakeWorker {
      private messageListener?: (event: MessageEvent<any>) => void;
      private errorListener?: (event: ErrorEvent) => void;

      constructor(_url: string | URL) {}

      addEventListener(type: string, listener: (event: any) => void) {
        if (type === 'message') {
          this.messageListener = listener;
        } else if (type === 'error') {
          this.errorListener = listener;
        }
      }

      removeEventListener() {}

      postMessage(data: { id: number; frame: any; format: string }) {
        queueMicrotask(() => {
          try {
            const payload = {
              format: data.format,
              width: data.frame.width,
              height: data.frame.height,
              metadata: data.frame.metadata,
              checksum: calculateChecksum(data.frame.pixels)
            };
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            this.messageListener?.({ data: { id: data.id, metadata: data.frame.metadata, blob } });
          } catch (error) {
            this.errorListener?.({ error } as ErrorEvent);
          }
        });
      }

      terminate() {}
    }

    globalThis.Worker = FakeWorker as unknown as typeof Worker;

    const service = new DatasetExportService();
    service.enqueue({
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray([0, 0, 0, 255]),
      metadata: {
        timestamp: 2,
        rotationAngles: [1, 2, 3, 4, 5, 6]
      }
    });

    const [frame] = await service.flush('image/webp');
    expect(frame.metadata.timestamp).toBe(2);
    const text = await frame.blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe('image/webp');
    expect(service.getMetrics()).toEqual({ pending: 0, totalEncoded: 1, lastFormat: 'image/webp' });
  });
});
