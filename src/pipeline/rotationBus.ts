import type { RotationSnapshot, RotationUniformOverrides } from '../core/rotationUniforms';
import type { RotationDynamics } from '../core/styleUniforms';
import { ZERO_DYNAMICS } from '../core/styleUniforms';

export interface RotationEvent {
  snapshot: RotationSnapshot;
  dynamics: RotationDynamics;
  overrides: RotationUniformOverrides | null;
}

export type RotationListener = (event: RotationEvent) => void;

export class RotationBus {
  private listeners = new Set<RotationListener>();
  private latest: RotationEvent | null = null;

  push(
    snapshot: RotationSnapshot,
    dynamics: RotationDynamics,
    overrides: RotationUniformOverrides | null = null
  ) {
    this.latest = { snapshot, dynamics, overrides };
    for (const listener of this.listeners) {
      listener(this.latest);
    }
  }

  subscribe(listener: RotationListener): () => void {
    this.listeners.add(listener);
    if (this.latest) {
      listener(this.latest);
    }
    return () => this.listeners.delete(listener);
  }

  getLatest(defaultValue: RotationSnapshot): RotationEvent {
    return (
      this.latest ?? {
        snapshot: defaultValue,
        dynamics: ZERO_DYNAMICS,
        overrides: null
      }
    );
  }
}
