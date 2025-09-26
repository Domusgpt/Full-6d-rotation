import { SIX_PLANE_KEYS, writeRotationChannels } from '../core/rotationPlanes';
import type { RotationSnapshot } from '../core/rotationUniforms';
import { DEFAULT_GAINS, type ImuPacket, type MappingGains } from './imuMapper';
import { So4ImuIntegrator } from './so4Integrator';
import {
  type ParserFilter,
  type ParserFrame,
  type StatefulParserFilter,
  createConfidenceFloorFilter,
  createSmoothingFilter
} from './parserFilters';

export interface ParseratorOptions {
  channelCount?: number;
  gains?: MappingGains;
  filters?: ParserFilter[];
  smoothingAlpha?: number;
  minimumConfidence?: number;
  hyperSmoothing?: number;
}

export interface ParseratorFrame extends ParserFrame {}

export type ParseratorSubscriber = (frame: ParseratorFrame) => void;

export interface FocusDirective {
  smoothingAlpha?: number;
  reset?: boolean;
  minimumConfidence?: number;
  maxDelta?: number;
}

function cloneRotation(snapshot: RotationSnapshot): RotationSnapshot {
  return {
    xy: snapshot.xy,
    xz: snapshot.xz,
    yz: snapshot.yz,
    xw: snapshot.xw,
    yw: snapshot.yw,
    zw: snapshot.zw,
    timestamp: snapshot.timestamp,
    confidence: snapshot.confidence
  };
}

export class KerbelizedParserator {
  private readonly channelBuffer: Float32Array;
  private readonly subscribers = new Set<ParseratorSubscriber>();
  private readonly filters: StatefulParserFilter[];
  private confidenceFloor: ParserFilter;
  private gains: MappingGains;
  private frameId = 0;
  private readonly integrator: So4ImuIntegrator;

  constructor(options: ParseratorOptions = {}) {
    const channelCount = options.channelCount ?? 64;
    if (channelCount < SIX_PLANE_KEYS.length) {
      throw new Error('Parserator requires at least six channels for SO(4) rotation data');
    }
    this.channelBuffer = new Float32Array(channelCount);
    this.filters = [];
    this.gains = options.gains ?? { ...DEFAULT_GAINS };
    this.integrator = new So4ImuIntegrator(this.gains, {
      hyperSmoothing: options.hyperSmoothing ?? 0.3
    });

    const smoothing = createSmoothingFilter({ alpha: options.smoothingAlpha ?? 0.18, maxDelta: Math.PI / 8 });
    this.filters.push(smoothing);

    const userFilters = options.filters ?? [];
    for (const filter of userFilters) {
      this.filters.push(filter as StatefulParserFilter);
    }

    this.confidenceFloor = createConfidenceFloorFilter({ minimum: options.minimumConfidence ?? 0.1 });
  }

  get channels(): Float32Array {
    return this.channelBuffer;
  }

  getGainProfile(): MappingGains {
    return { spatial: [...this.gains.spatial], hyperspatial: [...this.gains.hyperspatial] };
  }

  setGainProfile(gains: MappingGains) {
    this.gains = { spatial: [...gains.spatial], hyperspatial: [...gains.hyperspatial] };
    this.integrator.setGains(this.gains);
  }

  subscribe(subscriber: ParseratorSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  ingestRotation(snapshot: RotationSnapshot) {
    const rotation = cloneRotation(snapshot);
    const frame = this.createFrame(rotation);

    let filtered: ParserFrame = frame;
    for (const filter of this.filters) {
      filtered = filter(filtered);
    }
    filtered = this.confidenceFloor(filtered);

    this.notify(filtered);
  }

  ingestImuPacket(
    packet: ImuPacket,
    dt: number,
    gains: MappingGains = this.gains
  ): RotationSnapshot {
    const snapshot = this.integrator.step(packet, dt, gains);
    this.ingestRotation(snapshot);
    return snapshot;
  }

  updateFocus(directive: FocusDirective) {
    if (directive.reset) {
      for (const filter of this.filters) {
        filter.reset?.();
      }
      this.integrator.reset();
    }
    if (directive.smoothingAlpha !== undefined) {
      for (const filter of this.filters) {
        filter.setAlpha?.(directive.smoothingAlpha);
      }
    }
    if (directive.maxDelta !== undefined) {
      for (const filter of this.filters) {
        filter.setMaxDelta?.(directive.maxDelta);
      }
    }
    if (directive.minimumConfidence !== undefined) {
      this.confidenceFloor = createConfidenceFloorFilter({ minimum: directive.minimumConfidence });
    }
  }

  private createFrame(rotation: RotationSnapshot): ParserFrame {
    writeRotationChannels(this.channelBuffer, rotation);
    return {
      frameId: this.frameId++,
      timestamp: rotation.timestamp,
      rotation,
      channels: this.channelBuffer,
      confidence: rotation.confidence
    };
  }

  private notify(frame: ParserFrame) {
    for (const subscriber of this.subscribers) {
      subscriber(frame);
    }
  }
}

