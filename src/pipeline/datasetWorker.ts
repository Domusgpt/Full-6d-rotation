/// <reference lib="webworker" />
import { encodeFrameToBlob } from './frameEncoding';
import type { FrameFormat, FramePayload } from './datasetTypes';

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

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async event => {
  const message = event.data as WorkerRequest;
  try {
    const blob = await encodeFrameToBlob(message.frame, message.format);
    post({ id: message.id, success: true, blob });
  } catch (error) {
    post({ id: message.id, success: false, error: (error as Error).message });
  }
};

function post(response: WorkerResponse) {
  ctx.postMessage(response);
}
