import type { FocusDirector, FocusHint } from './focusDirector';

export interface JsonRpcRequest {
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class HaosBridge {
  constructor(private readonly focusDirector: FocusDirector) {}

  handleRequest(request: JsonRpcRequest): JsonRpcResponse {
    try {
      switch (request.method) {
        case 'setFocusProfile':
          this.applyFocus(request.params as FocusHint);
          return { id: request.id, result: 'ok' };
        case 'queueRotationScript':
          return { id: request.id, result: 'queued' };
        case 'requestSnapshot':
          return { id: request.id, result: { timestamp: performance.now() } };
        default:
          return { id: request.id, error: { code: -32601, message: 'Method not found' } };
      }
    } catch (error) {
      return { id: request.id, error: { code: -32000, message: (error as Error).message } };
    }
  }

  private applyFocus(params?: FocusHint) {
    if (!params) return;
    this.focusDirector.ingestHint(params);
  }
}
