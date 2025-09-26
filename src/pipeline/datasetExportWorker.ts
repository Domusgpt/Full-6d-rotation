import type { FrameFormat, FrameMetadata, FramePayload } from './datasetExport';
import { encodeFrameToBlob } from './frameEncoding';

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

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', async (event: MessageEvent<WorkerEncodeRequest>) => {
  const { id, frame, format } = event.data;
  try {
    const blob = await encodeFrameToBlob(frame, format);
    const response: WorkerEncodeResponse = { id, metadata: frame.metadata, blob };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerEncodeResponse = {
      id,
      error: error instanceof Error ? error.message : 'Failed to encode frame'
    };
    self.postMessage(response);
  }
});
