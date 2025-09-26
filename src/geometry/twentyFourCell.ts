import { GL_LINES, GL_UNSIGNED_SHORT, type GeometryData } from './types';

function createTwentyFourCell(): GeometryData {
  const vertices: number[][] = [];
  const vertexIndex = new Map<string, number>();

  const basis = [-1, 1];
  for (const sign of basis) {
    for (let axis = 0; axis < 4; axis++) {
      const v = [0, 0, 0, 0];
      v[axis] = sign;
      vertexIndex.set(v.join(','), vertices.push(v) - 1);
    }
  }

  const halves = [-0.5, 0.5];
  for (const x of halves) {
    for (const y of halves) {
      for (const z of halves) {
        for (const w of halves) {
          const v = [x, y, z, w];
          vertexIndex.set(v.join(','), vertices.push(v) - 1);
        }
      }
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (Math.abs(distanceSquared(vertices[i], vertices[j]) - 1) < 1e-6) {
        indices.push(i, j);
      }
    }
  }

  return {
    positions: new Float32Array(vertices.flat()),
    indices: new Uint16Array(indices),
    drawMode: GL_LINES,
    vertexStride: 4,
    indexType: GL_UNSIGNED_SHORT
  };
}

function distanceSquared(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

export const TwentyFourCellGeometry = createTwentyFourCell();
