import { encodeFramePayload } from './frameEncoding';
import type {
  DatasetExportMetrics,
  EncodedFrame,
  FrameFormat,
  FramePayload,
  FrameMetadata
} from './datasetTypes';

interface WorkerRequest {
  id: number;
  format: FrameFormat;
  frame: FramePayload;
}

interface WorkerSuccess {
  success: true;
  id: number;
  format: FrameFormat;
  metadata: FrameMetadata;
  blob: Blob;
}

interface WorkerFailure {
  success: false;
  id: number;
  message: string;
}

type WorkerResponse = WorkerSuccess | WorkerFailure;

export interface WorkerLike {
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface DatasetExportOptions {
  createWorker?: () => WorkerLike | null;
}

interface PendingJob {
  resolve: (value: EncodedFrame) => void;
  reject: (reason: Error) => void;
}

const DEFAULT_FORMAT: FrameFormat = 'image/png';

export class DatasetExportService {
  private readonly queue: FramePayload[] = [];
  private readonly pendingJobs = new Map<number, PendingJob>();
  private readonly createWorker?: () => WorkerLike | null;
  private worker: WorkerLike | null = null;
  private workerDisabled = false;
  private totalEncoded = 0;
  private lastFormat: FrameFormat | null = null;
  private nextJobId = 1;

  constructor(options?: DatasetExportOptions) {
    this.createWorker = options?.createWorker ?? defaultWorkerFactory;
  }

  enqueue(frame: FramePayload) {
    this.queue.push(frame);
  }

  async flush(format: FrameFormat = DEFAULT_FORMAT): Promise<EncodedFrame[]> {
    const frames = this.queue.splice(0);
    if (frames.length === 0) {
      return [];
    }

    const encoded: EncodedFrame[] = [];
    const worker = this.ensureWorker();

    if (worker) {
      for (const frame of frames) {
        try {
          encoded.push(await this.encodeWithWorker(worker, frame, format));
        } catch (error) {
          this.disableWorker();
          encoded.push(await this.encodeInline(frame, format));
        }
      }
    } else {
      for (const frame of frames) {
        encoded.push(await this.encodeInline(frame, format));
      }
    }

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

  private async encodeInline(frame: FramePayload, format: FrameFormat): Promise<EncodedFrame> {
    const blob = await encodeFramePayload(frame, format);
    return {
      blob,
      metadata: frame.metadata
    };
  }

  private encodeWithWorker(worker: WorkerLike, frame: FramePayload, format: FrameFormat): Promise<EncodedFrame> {
    return new Promise<EncodedFrame>((resolve, reject) => {
      const id = this.nextJobId++;
      this.pendingJobs.set(id, { resolve, reject });
      worker.postMessage({ id, frame, format });
    });
  }

  private ensureWorker(): WorkerLike | null {
    if (this.workerDisabled) {
      return null;
    }

    if (this.worker) {
      return this.worker;
    }

    const worker = this.createWorker?.();
    if (!worker) {
      this.workerDisabled = true;
      return null;
    }

    worker.onmessage = event => this.handleWorkerResponse(event.data);
    worker.onerror = () => this.handleWorkerFailure('Dataset export worker error');
    this.worker = worker;
    return worker;
  }

  private handleWorkerResponse(response: WorkerResponse) {
    const job = this.pendingJobs.get(response.id);
    if (!job) {
      return;
    }
    this.pendingJobs.delete(response.id);

    if (response.success) {
      job.resolve({
        blob: response.blob,
        metadata: response.metadata
      });
    } else {
      job.reject(new Error(response.message));
    }
  }

  private handleWorkerFailure(message: string) {
    for (const job of this.pendingJobs.values()) {
      job.reject(new Error(message));
    }
    this.pendingJobs.clear();
    this.disableWorker();
  }

  private disableWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (error) {
        // Swallow termination errors; we're already in a fallback path.
      }
    }
    this.worker = null;
    this.workerDisabled = true;
  }
}

function defaultWorkerFactory(): WorkerLike | null {
  if (typeof Worker === 'undefined') {
    return null;
  }

  try {
    const worker = new Worker(new URL('./datasetExportWorker.ts', import.meta.url), { type: 'module' });
    return worker as unknown as WorkerLike;
  } catch (error) {
    return null;
  }
}

export type {
  DatasetExportMetrics,
  EncodedFrame,
  FrameFormat,
  FramePayload,
  FrameMetadata
} from './datasetTypes';
