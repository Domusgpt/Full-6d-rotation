/// <reference lib="webworker" />

import type { EncodedFrame, FrameFormat, FramePayload } from './datasetExport';
import { encodeFramePayload } from './datasetEncoder';

interface WorkerRequest {
  id: number;
  format: FrameFormat;
  frames: FramePayload[];
}

interface WorkerResponse {
  id: number;
  frames: EncodedFrame[];
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', async event => {
  const data = event.data as WorkerRequest;
  try {
    const frames: EncodedFrame[] = [];
    for (const frame of data.frames) {
      frames.push({
        blob: await encodeFramePayload(frame, data.format),
        metadata: frame.metadata
      });
    }
    ctx.postMessage({ id: data.id, frames } satisfies WorkerResponse);
  } catch (error) {
    ctx.postMessage({ id: data.id, error: serializeError(error) });
  }
});

function serializeError(error: unknown): { message: string } {
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}
