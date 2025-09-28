import { SIX_PLANE_KEYS } from '../core/sixPlaneOrbit';
import type { ExtrumentAdapter, NormalizedSnapshot } from './extrumentHub';

export interface MidiOutputLike {
  id: string;
  name?: string;
  send(message?: number[] | Uint8Array, timestamp?: number): void;
}

export interface MidiExtrumentOptions {
  output: MidiOutputLike;
  channel?: number;
  controlChangeMap?: number[];
  magnitudeCc?: number;
  confidenceCc?: number;
}

function clampMidi(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(127, Math.max(0, Math.round(value)));
}

function toMidiValue(normalized: number): number {
  return clampMidi(normalized * 127);
}

export class MidiExtrumentAdapter implements ExtrumentAdapter<NormalizedSnapshot> {
  readonly id: string;
  readonly label: string;
  private readonly output: MidiOutputLike;
  private readonly channel: number;
  private readonly ccMap: number[];
  private readonly magnitudeCc?: number;
  private readonly confidenceCc?: number;
  private connected = false;

  constructor(options: MidiExtrumentOptions) {
    this.output = options.output;
    this.id = `midi:${options.output.id}`;
    this.label = options.output.name ?? options.output.id;
    this.channel = Math.min(15, Math.max(0, Math.floor(options.channel ?? 0)));
    this.ccMap = options.controlChangeMap ?? [20, 21, 22, 23, 24, 25];
    this.magnitudeCc = options.magnitudeCc ?? 26;
    this.confidenceCc = options.confidenceCc ?? 27;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async send(snapshot: NormalizedSnapshot): Promise<void> {
    if (!this.connected) return;
    const status = 0xb0 | this.channel;
    const values = SIX_PLANE_KEYS.map((plane) => toMidiValue(snapshot.planes[plane]));
    for (let i = 0; i < Math.min(this.ccMap.length, values.length); i++) {
      this.output.send([status, this.ccMap[i], values[i]], snapshot.timestamp);
    }
    if (this.magnitudeCc !== undefined) {
      this.output.send([status, this.magnitudeCc, clampMidi(snapshot.magnitude * 127)], snapshot.timestamp);
    }
    if (this.confidenceCc !== undefined) {
      this.output.send([status, this.confidenceCc, clampMidi(snapshot.confidence * 127)], snapshot.timestamp);
    }
  }
}

type MidiAccessLike = {
  outputs: Iterable<MidiOutputLike> | Map<string, MidiOutputLike>;
};

type MidiAccessFactory = () => Promise<MidiAccessLike>;

function resolveOutputs(collection: MidiAccessLike['outputs']): MidiOutputLike[] {
  if (collection instanceof Map) {
    return Array.from(collection.values());
  }
  if (Symbol.iterator in Object(collection)) {
    return Array.from(collection as Iterable<MidiOutputLike>);
  }
  return [];
}

export interface MidiDiscoveryOptions {
  accessFactory: MidiAccessFactory;
  selectOutput?: (outputs: MidiOutputLike[]) => MidiOutputLike | undefined;
}

export async function discoverMidiAdapters(
  options: MidiDiscoveryOptions
): Promise<MidiExtrumentAdapter[]> {
  const access = await options.accessFactory();
  const outputs = resolveOutputs(access.outputs);
  const select = options.selectOutput ?? ((list: MidiOutputLike[]) => list[0]);
  const chosen = select(outputs);
  if (!chosen) return [];
  return [
    new MidiExtrumentAdapter({
      output: chosen
    })
  ];
}
