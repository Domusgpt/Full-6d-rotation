import { describe, expect, it } from 'vitest';
import { DatasetExportService } from './datasetExport';
import { encodeFrameToBlob } from './frameEncoding';

interface WorkerRequest {
  id: number;
  format: 'image/png';
  frame: {
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
    metadata: {
      timestamp: number;
      rotationAngles: [number, number, number, number, number, number];
      confidence?: number;
    };
  };
}

interface WorkerResponse {
  id: number;
  success: boolean;
  blob?: Blob;
  error?: string;
}

class FakeWorker extends EventTarget implements Worker {
  onmessage: ((this: Worker, ev: MessageEvent<WorkerResponse>) => unknown) | null = null;
  onerror: ((this: Worker, ev: ErrorEvent) => unknown) | null = null;
  onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null;

  constructor(private readonly handler: (data: WorkerRequest) => Promise<WorkerResponse>) {
    super();
  }

  postMessage(message: WorkerRequest, _transfer?: Transferable[]): void {
    void this.handler(message)
      .then(response => {
        this.onmessage?.call(this, { data: response } as MessageEvent<WorkerResponse>);
      })
      .catch(error => {
        this.onerror?.call(this, new ErrorEvent('error', { message: (error as Error).message }));
      });
  }

  terminate(): void {}
}

describe('DatasetExportService', () => {
  it('encodes frames via JSON fallback when OffscreenCanvas is unavailable', async () => {
    const service = new DatasetExportService();
    expect(service.getMetrics()).toMatchObject({ pending: 0, totalEncoded: 0, lastFormat: null });
    service.enqueue({
      width: 2,
      height: 2,
      pixels: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
      metadata: {
        timestamp: 1,
        rotationAngles: [0, 0, 0, 0, 0, 0],
        confidence: 0.83,
        latency: {
          uniformMs: 2,
          uniformTimestamp: 3,
          captureMs: 4,
          captureTimestamp: 5
        }
      }
    });
    expect(service.getMetrics().pending).toBe(1);
    const [frame] = await service.flush();
    expect(frame.metadata.timestamp).toBe(1);
    expect(frame.metadata.confidence).toBeCloseTo(0.83, 5);
    const text = await frame.blob.text();
    expect(text).toContain('checksum');
    const latency = frame.metadata.latency;
    expect(latency).toBeDefined();
    expect(latency?.uniformMs).toBe(2);
    expect(latency?.captureMs).toBe(4);
    expect(latency?.captureTimestamp).toBe(5);
    expect(latency?.encodeMs).toBeGreaterThanOrEqual(0);
    expect(latency?.encodeCompletedTimestamp).toBeGreaterThanOrEqual(latency!.captureTimestamp);
    expect(latency?.totalMs).toBeCloseTo((latency?.encodeCompletedTimestamp ?? 0) - frame.metadata.timestamp, 5);
    const metrics = service.getMetrics();
    expect(metrics.pending).toBe(0);
    expect(metrics.totalEncoded).toBe(1);
    expect(metrics.lastFormat).toBe('image/png');
    expect(metrics.lastLatencyMs).toBeGreaterThanOrEqual(0);
    expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('dispatches frames through a worker when provided', async () => {
    const workerFactory = () =>
      new FakeWorker(async (message: WorkerRequest) => {
        const blob = await encodeFrameToBlob(message.frame, message.format);
        return { id: message.id, success: true, blob } satisfies WorkerResponse;
      }) as unknown as Worker;

    let samples: number[] = [];
    const service = new DatasetExportService({
      workerFactory,
      onLatencySample: latency => samples.push(latency)
    });

    service.enqueue({
      width: 2,
      height: 2,
      pixels: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 64, 64, 64, 255, 128, 128, 128, 255]),
      metadata: {
        timestamp: 2,
        rotationAngles: [0, 0, 0, 0, 0, 0],
        confidence: 0.75,
        latency: {
          uniformMs: 1.5,
          captureMs: 3,
          captureTimestamp: 10
        }
      }
    });

    const frames = await service.flush('image/png');
    expect(frames).toHaveLength(1);
    const latency = frames[0].metadata.latency;
    expect(frames[0].metadata.confidence).toBeCloseTo(0.75, 5);
    expect(latency?.encodeMs).toBeGreaterThanOrEqual(0);
    expect(latency?.totalMs).toBeGreaterThan(0);
    expect(samples.length).toBeGreaterThan(0);
    expect(service.getMetrics().totalEncoded).toBe(1);
    expect(service.getMetrics().lastLatencyMs).toBeGreaterThan(0);
  });

  it('annotates latency when metadata does not provide an envelope', async () => {
    const service = new DatasetExportService();
    service.enqueue({
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray([0, 0, 0, 255]),
      metadata: { timestamp: 4, rotationAngles: [0, 0, 0, 0, 0, 0] }
    });

    const [frame] = await service.flush();
    expect(frame.metadata.latency).toBeDefined();
    expect(frame.metadata.latency?.captureTimestamp).toBeGreaterThan(0);
    expect(frame.metadata.latency?.totalMs).toBeGreaterThanOrEqual(0);
  });
});
