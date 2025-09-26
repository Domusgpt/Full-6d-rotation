import type { EncodedFrame } from './datasetExport';

export interface PspSubscriber {
  (frame: EncodedFrame): void;
}

export interface PspStream {
  subscribe(listener: PspSubscriber): () => void;
  publish(frame: EncodedFrame): void;
}

export class LocalPspStream implements PspStream {
  private readonly listeners = new Set<PspSubscriber>();

  subscribe(listener: PspSubscriber): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(frame: EncodedFrame): void {
    for (const listener of this.listeners) {
      listener(frame);
    }
  }
}
