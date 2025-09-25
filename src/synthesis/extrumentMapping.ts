import { vec4 } from 'gl-matrix';
import type { GeometryData } from '../geometry/types';
import type { RotationAngles } from '../core/rotationTypes';
import { rotationMatrixFromAngles } from '../core/so4';

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

export interface ExtrumentVoice {
  index: number;
  position: [number, number, number, number];
  frequency: number;
  amplitude: number;
}

export interface ExtrumentEdgeModulation {
  from: number;
  to: number;
  modulation: number;
}

export interface ExtrumentSnapshot {
  voices: ExtrumentVoice[];
  edges: ExtrumentEdgeModulation[];
  harmonicCentroid: number;
  geometricEnergy: number;
}

export function deriveExtrumentSnapshot(geometry: GeometryData, angles: RotationAngles): ExtrumentSnapshot {
  const rotationMatrix = rotationMatrixFromAngles(angles);
  const positions = geometry.positions;
  const vertices: ExtrumentVoice[] = [];
  const tmp = vec4.create();
  let energy = 0;
  let frequencySum = 0;

  for (let i = 0; i < positions.length; i += geometry.vertexStride) {
    vec4.set(tmp, positions[i], positions[i + 1], positions[i + 2], positions[i + 3] ?? 1);
    const rotated = vec4.transformMat4(vec4.create(), tmp, rotationMatrix);
    const radius = Math.hypot(rotated[0], rotated[1], rotated[2], rotated[3]);
    const frequency = 220 * Math.pow(GOLDEN_RATIO, rotated[3]);
    const amplitude = Math.min(1, Math.max(0.05, 0.5 + rotated[2] * 0.35));
    energy += radius * amplitude;
    frequencySum += frequency;
    vertices.push({
      index: i / geometry.vertexStride,
      position: [rotated[0], rotated[1], rotated[2], rotated[3]],
      frequency,
      amplitude
    });
  }

  const edges: ExtrumentEdgeModulation[] = [];
  for (let i = 0; i < geometry.indices.length; i += 2) {
    const fromIndex = geometry.indices[i];
    const toIndex = geometry.indices[i + 1];
    const from = vertices[fromIndex];
    const to = vertices[toIndex];
    if (!from || !to) continue;
    const dx = to.position[0] - from.position[0];
    const dy = to.position[1] - from.position[1];
    const dz = to.position[2] - from.position[2];
    const dw = to.position[3] - from.position[3];
    const modulation = Math.hypot(dx, dy, dz, dw);
    edges.push({ from: fromIndex, to: toIndex, modulation });
    energy += modulation * 0.125;
  }

  const harmonicCentroid = vertices.length > 0 ? frequencySum / vertices.length : 0;

  return {
    voices: vertices,
    edges,
    harmonicCentroid,
    geometricEnergy: energy / Math.max(1, vertices.length)
  };
}

export function summariseExtrument(snapshot: ExtrumentSnapshot): string {
  if (!snapshot.voices.length) return 'No voices registered';
  const centroid = snapshot.harmonicCentroid.toFixed(1);
  const energy = snapshot.geometricEnergy.toFixed(2);
  const highest = snapshot.voices.reduce(
    (acc, voice) => (voice.frequency > acc.frequency ? voice : acc),
    snapshot.voices[0]
  );
  const richest = snapshot.edges.reduce(
    (acc, edge) => (edge.modulation > acc.modulation ? edge : acc),
    snapshot.edges[0] ?? { modulation: 0, from: 0, to: 0 }
  );
  return `Centroid ${centroid} Hz · Peak voice ${highest.index} @ ${highest.frequency.toFixed(1)} Hz · Strongest modulation ${
    richest.modulation.toFixed(2)
  } · Energy ${energy}`;
}
