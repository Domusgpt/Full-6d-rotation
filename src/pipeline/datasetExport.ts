import { encodeFramePayload } from './datasetEncoder';

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

interface WorkerRequest {
  id: number;
  format: FrameFormat;
  frames: FramePayload[];
}

interface WorkerResponse {
  id: number;
  frames?: EncodedFrame[];
  error?: { message: string };
}

type PendingJob = {
  resolve: (frames: EncodedFrame[]) => void;
  reject: (error: unknown) => void;
};

export class DatasetExportService {
  private readonly queue: FramePayload[] = [];
  private totalEncoded = 0;
  private lastFormat: FrameFormat | null = null;
  private worker: Worker | null = null;
  private nextJobId = 1;
  private readonly pendingJobs = new Map<number, PendingJob>();

  constructor() {
    if (typeof Worker !== 'undefined') {
      try {
        const worker = new Worker(new URL('./datasetExport.worker.ts', import.meta.url), {
          type: 'module'
        });
        worker.onmessage = event => this.handleWorkerMessage(event.data as WorkerResponse);
        worker.onerror = event => {
          this.failAllPending(event);
          this.disposeWorker();
        };
        this.worker = worker;
      } catch (error) {
        // Worker construction failed (e.g., unsupported environment). Fallback to inline encoding.
        this.worker = null;
      }
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

    let results: EncodedFrame[];
    if (this.worker) {
      try {
        results = await this.dispatchToWorker(frames, format);
      } catch (error) {
        // Fallback to inline encoding if the worker fails mid-flight.
        this.disposeWorker();
        results = await this.encodeInline(frames, format);
      }
    } else {
      results = await this.encodeInline(frames, format);
    }

    if (results.length > 0) {
      this.totalEncoded += results.length;
      this.lastFormat = format;
    }
    return results;
  }

  getMetrics(): DatasetExportMetrics {
    return {
      pending: this.queue.length,
      totalEncoded: this.totalEncoded,
      lastFormat: this.lastFormat
    };
  }

  private async encodeInline(frames: FramePayload[], format: FrameFormat): Promise<EncodedFrame[]> {
    const results: EncodedFrame[] = [];
    for (const frame of frames) {
      results.push({
        blob: await encodeFramePayload(frame, format),
        metadata: frame.metadata
      });
    }
    return results;
  }

  private dispatchToWorker(frames: FramePayload[], format: FrameFormat): Promise<EncodedFrame[]> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not available'));
    }

    const jobId = this.nextJobId++;
    return new Promise<EncodedFrame[]>((resolve, reject) => {
      this.pendingJobs.set(jobId, { resolve, reject });
      try {
        this.worker!.postMessage({ id: jobId, format, frames } satisfies WorkerRequest);
      } catch (error) {
        this.pendingJobs.delete(jobId);
        reject(error);
      }
    });
  }

  private handleWorkerMessage(message: WorkerResponse) {
    const job = this.pendingJobs.get(message.id);
    if (!job) {
      return;
    }
    this.pendingJobs.delete(message.id);
    if (message.error) {
      job.reject(new Error(message.error.message));
      return;
    }
    job.resolve(message.frames ?? []);
  }

  private failAllPending(error: unknown) {
    for (const [, job] of this.pendingJobs) {
      job.reject(error);
    }
    this.pendingJobs.clear();
  }

  private disposeWorker() {
    if (this.worker) {
      this.worker.terminate?.();
      this.worker = null;
    }
  }
}
