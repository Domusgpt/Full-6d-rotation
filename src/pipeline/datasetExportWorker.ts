/// <reference lib="webworker" />
import { encodeFramePayload } from './frameEncoding';
import type { FrameFormat, FramePayload } from './datasetTypes';

interface WorkerRequest {
  id: number;
  format: FrameFormat;
  frame: FramePayload;
}

interface WorkerSuccess {
  success: true;
  id: number;
  format: FrameFormat;
  metadata: FramePayload['metadata'];
  blob: Blob;
}

interface WorkerFailure {
  success: false;
  id: number;
  message: string;
}

type WorkerResponse = WorkerSuccess | WorkerFailure;

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async event => {
  const message = event.data as WorkerRequest;
  try {
    const blob = await encodeFramePayload(message.frame, message.format);
    const response: WorkerResponse = {
      success: true,
      id: message.id,
      format: message.format,
      metadata: message.frame.metadata,
      blob
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      success: false,
      id: message.id,
      message: error instanceof Error ? error.message : 'Unknown dataset export worker error'
    };
    self.postMessage(response);
  }
};

export {};
