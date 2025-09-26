import type { RotationDynamics } from '../core/styleUniforms';
import type { RotationSnapshot } from '../core/rotationUniforms';

const MIN_GAIN = 0.02;
const MAX_GAIN = 0.55;

function getAudioContextConstructor(): typeof AudioContext | null {
  const ctor = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  return ctor ?? null;
}

export class ExtrumentSynth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private carriers: OscillatorNode[] = [];
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  async enable(): Promise<void> {
    if (this.active) return;
    const Ctor = getAudioContextConstructor();
    if (!Ctor) {
      throw new Error('Web Audio API is not supported in this environment.');
    }
    const context = new Ctor();
    await context.resume();

    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 6;
    filter.frequency.value = 400;
    filter.connect(master);

    const carrierFrequencies = [110, 220, 330];
    this.carriers = carrierFrequencies.map((base, index) => {
      const osc = context.createOscillator();
      osc.type = index === 0 ? 'sine' : index === 1 ? 'triangle' : 'sawtooth';
      osc.frequency.value = base;
      osc.connect(filter);
      osc.start();
      return osc;
    });

    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.detune);
    lfo.start();

    this.context = context;
    this.master = master;
    this.filter = filter;
    this.lfo = lfo;
    this.lfoGain = lfoGain;
    this.active = true;
  }

  async disable(): Promise<void> {
    if (!this.active) return;
    this.active = false;

    if (this.context) {
      const stopAt = this.context.currentTime + 0.1;
      if (this.master) {
        this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
      }
      for (const osc of this.carriers) {
        osc.stop(stopAt);
      }
      if (this.lfo) {
        this.lfo.stop(stopAt);
      }
      setTimeout(() => {
        this.context?.close();
      }, 150);
    }

    this.context = null;
    this.master = null;
    this.filter = null;
    this.carriers = [];
    this.lfo = null;
    this.lfoGain = null;
  }

  update(snapshot: RotationSnapshot, dynamics: RotationDynamics) {
    if (!this.active || !this.context || !this.master || !this.filter) {
      return;
    }

    const { currentTime } = this.context;
    const targetGain = MIN_GAIN + (MAX_GAIN - MIN_GAIN) * dynamics.energy * snapshot.confidence;
    this.master.gain.setTargetAtTime(targetGain, currentTime, 0.08);

    const spatialFundamental = 140 + 420 * dynamics.spatial;
    const hyperFundamental = 160 + 560 * dynamics.hyperspatial;
    const harmonicBend = 0.9 + dynamics.harmonic * 0.8;

    if (this.carriers[0]) {
      this.carriers[0].frequency.setTargetAtTime(spatialFundamental, currentTime, 0.05);
    }
    if (this.carriers[1]) {
      const beat = spatialFundamental * harmonicBend;
      this.carriers[1].frequency.setTargetAtTime(beat, currentTime, 0.08);
    }
    if (this.carriers[2]) {
      const hyper = hyperFundamental * (1.1 + dynamics.chaos * 0.6);
      this.carriers[2].frequency.setTargetAtTime(hyper, currentTime, 0.12);
    }

    const filterFrequency = 250 + 1850 * dynamics.harmonic;
    this.filter.frequency.setTargetAtTime(filterFrequency, currentTime, 0.1);
    this.filter.Q.setTargetAtTime(4 + dynamics.chaos * 8, currentTime, 0.1);

    if (this.lfoGain) {
      const detuneDepth = 20 + dynamics.chaos * 120;
      this.lfoGain.gain.setTargetAtTime(detuneDepth, currentTime, 0.2);
    }
  }
}
