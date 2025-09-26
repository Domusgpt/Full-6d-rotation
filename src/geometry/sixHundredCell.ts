import { LINE_DRAW_MODE, type GeometryData } from './types';

const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

function createSixHundredCell(): GeometryData {
  const vertices: number[][] = [];
  const seen = new Set<string>();

  function addVertex(v: number[]) {
    const key = v.map(value => value.toFixed(6)).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      vertices.push(v);
    }
  }

  // 16 hypercube vertices (±1/2, ±1/2, ±1/2, ±1/2)
  for (const sx of [-0.5, 0.5]) {
    for (const sy of [-0.5, 0.5]) {
      for (const sz of [-0.5, 0.5]) {
        for (const sw of [-0.5, 0.5]) {
          addVertex([sx, sy, sz, sw]);
        }
      }
    }
  }

  // 8 cross-polytope vertices (±1, 0, 0, 0)
  for (let axis = 0; axis < 4; axis++) {
    for (const sign of [-1, 1]) {
      const v = [0, 0, 0, 0];
      v[axis] = sign;
      addVertex(v);
    }
  }

  // 96 permutations of (0, ±1/2, ±phi/2, ±1/(2phi))
  const base = [0, 0.5, PHI / 2, INV_PHI / 2];
  const permutations = generatePermutations([0, 1, 2, 3]);

  for (const perm of permutations) {
    const components = perm.map(index => base[index]);
    const nonZeroIndices = components
      .map((value, index) => (Math.abs(value) > 1e-6 ? index : -1))
      .filter(index => index >= 0);

    const signCombos = 1 << nonZeroIndices.length;
    for (let mask = 0; mask < signCombos; mask++) {
      const candidate = components.slice();
      let signParity = 1;
      for (let bit = 0; bit < nonZeroIndices.length; bit++) {
        const idx = nonZeroIndices[bit];
        const sign = (mask & (1 << bit)) ? -1 : 1;
        candidate[idx] *= sign;
        signParity *= sign;
      }

      // Only accept configurations with even sign parity to enforce 96 vertices
      if (signParity > 0) {
        addVertex(candidate);
      }
    }
  }

  if (vertices.length !== 120) {
    throw new Error(`600-cell vertex generation failed (expected 120, got ${vertices.length})`);
  }

  const candidates: Array<{ a: number; b: number; distance: number }> = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      candidates.push({ a: i, b: j, distance: distanceSquared(vertices[i], vertices[j]) });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);

  const indices: number[] = [];
  for (let k = 0; k < 720; k++) {
    const edge = candidates[k];
    indices.push(edge.a, edge.b);
  }

  if (indices.length / 2 !== 720) {
    throw new Error(`600-cell edge generation failed (expected 720, got ${indices.length / 2})`);
  }

  return {
    positions: new Float32Array(vertices.flat()),
    indices: new Uint16Array(indices),
    drawMode: LINE_DRAW_MODE,
    vertexStride: 4,
    topology: {
      vertices: 120,
      edges: 720,
      faces: 1200,
      cells: 600
    }
  };
}

function generatePermutations(indices: number[]): number[][] {
  if (indices.length === 1) return [indices.slice()];
  const permutations: number[][] = [];
  for (let i = 0; i < indices.length; i++) {
    const [current] = indices.splice(i, 1);
    for (const rest of generatePermutations(indices)) {
      permutations.push([current, ...rest]);
    }
    indices.splice(i, 0, current);
  }
  return permutations;
}

function distanceSquared(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

export const SixHundredCellGeometry = createSixHundredCell();
