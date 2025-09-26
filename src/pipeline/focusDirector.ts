import type { GeometryId } from './geometryCatalog';
import type { GeometryController } from './geometryController';
import type { RotationBus } from './rotationBus';
import type { RotationAngles, RotationSnapshot } from '../core/rotationUniforms';

export interface FocusHint {
  geometry?: GeometryId;
  rotationBias?: Partial<RotationAngles>;
  confidenceBoost?: number;
}

export interface FocusDirectorOptions {
  fallbackGeometry?: GeometryId;
  timeoutMs?: number;
}

export class FocusDirector {
  private lastHintAt = 0;
  private readonly timeoutMs: number;
  private readonly fallbackGeometry: GeometryId;
  private rotationBias: Partial<RotationAngles> = {};
  private confidenceBoost = 0;

  constructor(
    private readonly geometryController: GeometryController,
    private readonly rotationBus: RotationBus,
    options: FocusDirectorOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fallbackGeometry = options.fallbackGeometry ?? 'tesseract';
  }

  ingestHint(hint: FocusHint) {
    this.lastHintAt = performance.now();
    if (hint.geometry) {
      this.geometryController.setActiveGeometry(hint.geometry);
    }
    if (hint.rotationBias) {
      this.rotationBias = { ...hint.rotationBias };
    }
    if (typeof hint.confidenceBoost === 'number') {
      this.confidenceBoost = hint.confidenceBoost;
    }
  }

  update(snapshotTime = performance.now()) {
    if (snapshotTime - this.lastHintAt > this.timeoutMs) {
      this.geometryController.setActiveGeometry(this.fallbackGeometry);
      this.rotationBias = {};
      this.confidenceBoost = 0;
      this.lastHintAt = snapshotTime;
    }

    const latest = this.rotationBus.getLatest({
      xy: 0,
      xz: 0,
      yz: 0,
      xw: 0,
      yw: 0,
      zw: 0,
      timestamp: snapshotTime,
      confidence: 1
    });

    let mutated = false;
    const nextSnapshot: RotationSnapshot = { ...latest };
    if (this.rotationBias) {
      (Object.keys(this.rotationBias) as (keyof RotationAngles)[]).forEach(plane => {
        const value = this.rotationBias[plane];
        if (typeof value === 'number') {
          nextSnapshot[plane] += value;
          mutated = true;
        }
      });
    }
    if (this.confidenceBoost !== 0) {
      nextSnapshot.confidence = Math.min(1, latest.confidence + this.confidenceBoost);
      mutated = true;
    }

    if (mutated) {
      nextSnapshot.timestamp = snapshotTime;
      this.rotationBus.push({ ...nextSnapshot });
    }
  }
}
