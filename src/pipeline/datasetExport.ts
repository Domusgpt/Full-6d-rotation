import { encodeFrameToBlob } from './frameEncoding';

export type FrameFormat = 'image/png' | 'image/webp' | 'video/webm';

export interface FrameMetadata {
  timestamp: number;
  rotationAngles: [number, number, number, number, number, number];
}

export interface FramePayload {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  metadata: FrameMetadata;
}

export interface EncodedFrame {
  blob: Blob;
  metadata: FrameMetadata;
}

export interface DatasetExportMetrics {
  pending: number;
  totalEncoded: number;
  lastFormat: FrameFormat | null;
}

interface WorkerEncodeRequest {
  id: number;
  frame: FramePayload;
  format: FrameFormat;
}

interface WorkerEncodeSuccess {
  id: number;
  metadata: FrameMetadata;
  blob: Blob;
}

interface WorkerEncodeFailure {
  id: number;
  error: string;
}

type WorkerEncodeResponse = WorkerEncodeSuccess | WorkerEncodeFailure;

interface PendingRequest {
  resolve(value: EncodedFrame): void;
  reject(reason: unknown): void;
}

export class DatasetExportService {
  private readonly queue: FramePayload[] = [];
  private totalEncoded = 0;
  private lastFormat: FrameFormat | null = null;
  private worker?: Worker;
  private readonly workerPending = new Map<number, PendingRequest>();
  private nextWorkerId = 1;

  constructor() {
    if (typeof Worker === 'undefined') {
      return;
    }

    try {
      this.worker = new Worker(new URL('./datasetExportWorker.ts', import.meta.url), { type: 'module' });
      this.worker.addEventListener('message', this.handleWorkerMessage);
      this.worker.addEventListener('error', this.handleWorkerError);
    } catch (error) {
      this.worker = undefined;
    }
  }

  enqueue(frame: FramePayload) {
    this.queue.push(frame);
  }

  async flush(format: FrameFormat = 'image/png'): Promise<EncodedFrame[]> {
    const frames = this.queue.splice(0);
    if (frames.length === 0) {
      return [];
    }

    const encoded = await this.encodeBatch(frames, format);
    if (encoded.length > 0) {
      this.totalEncoded += encoded.length;
      this.lastFormat = format;
    }
    return encoded;
  }

  getMetrics(): DatasetExportMetrics {
    return {
      pending: this.queue.length,
      totalEncoded: this.totalEncoded,
      lastFormat: this.lastFormat
    };
  }

  private async encodeBatch(frames: FramePayload[], format: FrameFormat): Promise<EncodedFrame[]> {
    if (!this.worker) {
      return Promise.all(frames.map(frame => this.encodeInProcess(frame, format)));
    }

    const tasks = frames.map((frame, index) =>
      this.dispatchToWorker(frame, format)
        .then(result => ({ status: 'fulfilled' as const, index, result }))
        .catch(error => ({ status: 'rejected' as const, index, error }))
    );

    const settled = await Promise.all(tasks);
    const results: (EncodedFrame | undefined)[] = new Array(frames.length);
    const failedIndexes: number[] = [];
    let failureReason: unknown;

    for (const entry of settled) {
      if (entry.status === 'fulfilled') {
        results[entry.index] = entry.result;
      } else {
        failedIndexes.push(entry.index);
        if (!failureReason) {
          failureReason = entry.error;
        }
      }
    }

    if (failedIndexes.length > 0) {
      this.disableWorker(failureReason);
      for (const index of failedIndexes) {
        results[index] = await this.encodeInProcess(frames[index]!, format);
      }
    }

    const encoded: EncodedFrame[] = [];
    for (let i = 0; i < results.length; i++) {
      const frame = results[i];
      if (!frame) {
        throw new Error('Failed to encode dataset frame');
      }
      encoded.push(frame);
    }
    return encoded;
  }

  private async encodeInProcess(frame: FramePayload, format: FrameFormat): Promise<EncodedFrame> {
    return {
      blob: await encodeFrameToBlob(frame, format),
      metadata: frame.metadata
    };
  }

  private dispatchToWorker(frame: FramePayload, format: FrameFormat): Promise<EncodedFrame> {
    if (!this.worker) {
      return this.encodeInProcess(frame, format);
    }

    const id = this.nextWorkerId++;
    const request: WorkerEncodeRequest = { id, frame, format };

    return new Promise<EncodedFrame>((resolve, reject) => {
      this.workerPending.set(id, { resolve, reject });
      this.worker!.postMessage(request);
    });
  }

  private handleWorkerMessage = (event: MessageEvent<WorkerEncodeResponse>) => {
    const data = event.data;
    const pending = this.workerPending.get(data.id);
    if (!pending) {
      return;
    }

    this.workerPending.delete(data.id);
    if ('error' in data) {
      pending.reject(new Error(data.error));
      return;
    }

    pending.resolve({
      blob: data.blob,
      metadata: data.metadata
    });
  };

  private handleWorkerError = (event: ErrorEvent) => {
    this.disableWorker(event.error ?? event.message);
  };

  private disableWorker(reason: unknown) {
    if (!this.worker) {
      return;
    }

    this.worker.removeEventListener('message', this.handleWorkerMessage);
    this.worker.removeEventListener('error', this.handleWorkerError);
    this.worker.terminate();
    this.worker = undefined;

    const error = reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Dataset export worker failed');
    for (const pending of this.workerPending.values()) {
      pending.reject(error);
    }
    this.workerPending.clear();
  }
}
