import type { RotationAngles, RotationSnapshot } from '../core/rotationUniforms';

export type RotationListener = (snapshot: RotationSnapshot) => void;

export class RotationBus {
  private listeners = new Set<RotationListener>();
  private latest: RotationSnapshot | null = null;

  push(snapshot: RotationSnapshot) {
    this.latest = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  subscribe(listener: RotationListener): () => void {
    this.listeners.add(listener);
    if (this.latest) {
      listener(this.latest);
    }
    return () => this.listeners.delete(listener);
  }

  getLatest(defaultValue: RotationSnapshot): RotationSnapshot {
    return this.latest ?? defaultValue;
  }
}
