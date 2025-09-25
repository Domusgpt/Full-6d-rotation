import type { RotationAngles } from './rotationTypes';

const TAU = Math.PI * 2;
export const SIX_PLANE_KEYS: ReadonlyArray<keyof RotationAngles> = ['xy', 'xz', 'yz', 'xw', 'yw', 'zw'];

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
