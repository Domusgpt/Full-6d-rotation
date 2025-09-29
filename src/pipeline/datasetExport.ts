import type {
  FrameFormat,
  FramePayload,
  EncodedFrame,
  FrameMetadata,
  PipelineLatencyEnvelope
} from './datasetTypes';
import { encodeFrameToBlob } from './frameEncoding';

export interface DatasetExportMetrics {
  pending: number;
  totalEncoded: number;
  lastFormat: FrameFormat | null;
  lastLatencyMs: number;
  averageLatencyMs: number;
}

export interface DatasetExportOptions {
  workerFactory?: () => Worker;
  sampleWindow?: number;
  onLatencySample?: (latencyMs: number) => void;
}

interface WorkerRequest {
  id: number;
  format: FrameFormat;
  frame: FramePayload;
}

interface WorkerSuccess {
  id: number;
  success: true;
  blob: Blob;
}

interface WorkerFailure {
  id: number;
  success: false;
  error: string;
}

type WorkerResponse = WorkerSuccess | WorkerFailure;

interface PendingJob {
  resolve: (frame: EncodedFrame) => void;
  reject: (error: Error) => void;
  metadata: FrameMetadata;
  start: number;
}

export class DatasetExportService {
  private readonly queue: FramePayload[] = [];
  private readonly latencies: number[] = [];
  private readonly maxSamples: number;
  private latencySum = 0;
  private totalEncoded = 0;
  private lastFormat: FrameFormat | null = null;
  private lastLatency = 0;
  private worker: Worker | null = null;
  private jobId = 0;
  private readonly pendingJobs = new Map<number, PendingJob>();

  constructor(private readonly options: DatasetExportOptions = {}) {
    this.maxSamples = options.sampleWindow ?? 32;
    const worker = this.createWorker();
    if (worker) {
      this.worker = worker;
      worker.onmessage = event => this.handleWorkerMessage(event.data as WorkerResponse);
      worker.onerror = event => {
        console.error('Dataset worker error', event);
      };
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

    const results = this.worker
      ? await this.encodeWithWorker(frames, format)
      : await this.encodeSequential(frames, format);

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
      lastFormat: this.lastFormat,
      lastLatencyMs: this.lastLatency,
      averageLatencyMs: this.latencies.length ? this.latencySum / this.latencies.length : 0
    };
  }

  private async encodeSequential(frames: FramePayload[], format: FrameFormat): Promise<EncodedFrame[]> {
    const results: EncodedFrame[] = [];
    for (const frame of frames) {
      const start = performance.now();
      const blob = await encodeFrameToBlob(frame, format);
      const latency = performance.now() - start;
      this.recordLatency(latency);
      results.push({ blob, metadata: this.withEncodeLatency(frame.metadata, start, latency) });
    }
    return results;
  }

  private encodeWithWorker(frames: FramePayload[], format: FrameFormat): Promise<EncodedFrame[]> {
    return Promise.all(frames.map(frame => this.enqueueJob(frame, format)));
  }

  private enqueueJob(frame: FramePayload, format: FrameFormat): Promise<EncodedFrame> {
    if (!this.worker) {
      throw new Error('Worker unavailable');
    }
    const id = ++this.jobId;
    const start = performance.now();
    return new Promise<EncodedFrame>((resolve, reject) => {
      this.pendingJobs.set(id, { resolve, reject, metadata: frame.metadata, start });
      try {
        this.worker!.postMessage({ id, format, frame } satisfies WorkerRequest, [frame.pixels.buffer]);
      } catch (error) {
        this.pendingJobs.delete(id);
        reject(error as Error);
      }
    });
  }

  private handleWorkerMessage(message: WorkerResponse) {
    const job = this.pendingJobs.get(message.id);
    if (!job) {
      return;
    }
    this.pendingJobs.delete(message.id);
    if (!message.success) {
      job.reject(new Error(message.error));
      return;
    }
    const latency = performance.now() - job.start;
    this.recordLatency(latency);
    job.resolve({ blob: message.blob, metadata: this.withEncodeLatency(job.metadata, job.start, latency) });
  }

  private recordLatency(latency: number) {
    if (!Number.isFinite(latency) || latency < 0) {
      return;
    }
    this.lastLatency = latency;
    this.latencies.push(latency);
    this.latencySum += latency;
    if (this.latencies.length > this.maxSamples) {
      const removed = this.latencies.shift();
      if (removed !== undefined) {
        this.latencySum -= removed;
      }
    }
    if (this.options.onLatencySample) {
      this.options.onLatencySample(latency);
    }
  }

  private withEncodeLatency(metadata: FrameMetadata, start: number, encodeLatency: number): FrameMetadata {
    const encodeCompletedTimestamp = start + encodeLatency;
    const latency: PipelineLatencyEnvelope = {
      uniformMs: metadata.latency?.uniformMs ?? 0,
      uniformTimestamp: metadata.latency?.uniformTimestamp,
      captureMs: metadata.latency?.captureMs ?? 0,
      captureTimestamp: metadata.latency?.captureTimestamp ?? start,
      encodeMs: encodeLatency,
      encodeCompletedTimestamp,
      totalMs: encodeCompletedTimestamp - metadata.timestamp
    };

    return {
      ...metadata,
      latency
    };
  }

  private createWorker(): Worker | null {
    if (this.options.workerFactory) {
      return this.options.workerFactory();
    }
    if (typeof Worker === 'undefined') {
      return null;
    }
    try {
      return new Worker(new URL('./datasetWorker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      console.warn('Failed to initialise dataset export worker', error);
      return null;
    }
  }
}

export type { EncodedFrame, FrameMetadata, PipelineLatencyEnvelope } from './datasetTypes';
