import { rotationEnergy, type RotationAngles } from './rotationUniforms';

const TAU = Math.PI * 2;
export const SIX_PLANE_KEYS: ReadonlyArray<keyof RotationAngles> = ['xy', 'xz', 'yz', 'xw', 'yw', 'zw'];

export interface RotationPlaneMetadata {
  label: string;
  summary: string;
}

export const SIX_PLANE_METADATA: Record<keyof RotationAngles, RotationPlaneMetadata> = {
  xy: {
    label: 'XY · Spatial spin',
    summary:
      'Classical rotation around the vertical axis. Watch the whole hull orbit while bloom traces the outer ring.'
  },
  xz: {
    label: 'XZ · Pitch fold',
    summary:
      'Tilts the polychoron forward/back. Reveals top and bottom cells as highlights travel across the silhouette.'
  },
  yz: {
    label: 'YZ · Lateral sweep',
    summary:
      'Slides the shape left/right around the X axis. Edge telemetry pulses from side struts as the visualizer breathes.'
  },
  xw: {
    label: 'XW · Hyper reveal',
    summary:
      'Trades the X axis with the hidden W axis. Internal cells bloom outward creating depth ripples in the reactive layers.'
  },
  yw: {
    label: 'YW · Vertical weave',
    summary:
      'Braids vertical columns into W. Expect shimmering light bands climbing the structure alongside higher confidence samples.'
  },
  zw: {
    label: 'ZW · Depth breathe',
    summary:
      'Swaps depth with W so the object expands/contracts. Waterplane and audio envelopes surge as the projection compresses.'
  }
};

export interface OrbitPlane {
  plane: keyof RotationAngles;
  ratio: number;
  amplitude?: number;
  phase?: number;
}

export interface OrbitSpec {
  baseFrequency: number;
  amplitude: number;
  planes: OrbitPlane[];
  coupling?: number;
  hyperCoupling?: number;
}

export interface LoomSample {
  time: number;
  energy: number;
  angles: RotationAngles;
}

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

function defaultSpec(): OrbitSpec {
  return {
    baseFrequency: 0.12,
    amplitude: Math.PI / 3.5,
    coupling: 0.28,
    hyperCoupling: 0.14,
    planes: [
      { plane: 'xy', ratio: 1, amplitude: 1.0 },
      { plane: 'xz', ratio: GOLDEN_RATIO, amplitude: 0.86, phase: Math.PI / 5 },
      { plane: 'yz', ratio: 5 / 3, amplitude: 0.92, phase: Math.PI / 2 },
      { plane: 'xw', ratio: 2, amplitude: 0.74, phase: Math.PI / 7 },
      { plane: 'yw', ratio: 2 * GOLDEN_RATIO, amplitude: 0.68, phase: Math.PI / 3 },
      { plane: 'zw', ratio: 3, amplitude: 0.62, phase: Math.PI * 0.77 }
    ]
  };
}

function clampAngle(angle: number, limit = Math.PI): number {
  if (angle > limit) return limit;
  if (angle < -limit) return -limit;
  return angle;
}

function createZeroAngles(): RotationAngles {
  return { xy: 0, xz: 0, yz: 0, xw: 0, yw: 0, zw: 0 };
}

export function createHarmonicOrbit(spec: OrbitSpec = defaultSpec()): (timeSeconds: number) => RotationAngles {
  const { amplitude, baseFrequency, planes, coupling = 0, hyperCoupling = 0 } = spec;
  const resolvedPlanes = planes.length ? planes : defaultSpec().planes;

  return (timeSeconds: number) => {
    const angles = createZeroAngles();

    for (const planeSpec of resolvedPlanes) {
      const planeAmplitude = amplitude * (planeSpec.amplitude ?? 1);
      const phase = planeSpec.phase ?? 0;
      const omega = TAU * baseFrequency * planeSpec.ratio;
      const value = planeAmplitude * Math.sin(omega * timeSeconds + phase);
      angles[planeSpec.plane] = clampAngle(value);
    }

    if (coupling !== 0) {
      const spatialMean = (angles.xy + angles.xz + angles.yz) / 3;
      const hyperMean = (angles.xw + angles.yw + angles.zw) / 3;
      const bias = (spatialMean - hyperMean) * coupling;
      angles.xw = clampAngle(angles.xw + bias * 0.8);
      angles.yw = clampAngle(angles.yw - bias * 0.5);
      angles.zw = clampAngle(angles.zw + bias * 0.3);
    }

    if (hyperCoupling !== 0) {
      const cross = (angles.xy - angles.yz) * hyperCoupling;
      angles.xw = clampAngle(angles.xw + cross * 0.6);
      angles.yw = clampAngle(angles.yw + cross * 0.4);
      angles.zw = clampAngle(angles.zw - cross * 0.2);
    }

    return angles;
  };
}

export function createRotationLoom(
  orbit: (timeSeconds: number) => RotationAngles,
  length = 240
): (timeSeconds: number) => LoomSample[] {
  const samples: LoomSample[] = [];
  return (timeSeconds: number) => {
    const angles = orbit(timeSeconds);
    const energy = rotationEnergy(angles);
    samples.push({
      time: timeSeconds,
      energy,
      angles: { ...angles }
    });
    if (samples.length > length) {
      samples.shift();
    }
    return samples.slice();
  };
}
