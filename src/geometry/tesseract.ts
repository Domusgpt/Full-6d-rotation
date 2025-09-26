import { LINE_DRAW_MODE, type GeometryData } from './types';

function createTesseractGeometry(): GeometryData {
  const vertices: number[][] = [];
  const vertexIndex = new Map<string, number>();

  const coords = [-1, 1];
  let index = 0;
  for (const x of coords) {
    for (const y of coords) {
      for (const z of coords) {
        for (const w of coords) {
          const key = `${x},${y},${z},${w}`;
          vertices.push([x, y, z, w]);
          vertexIndex.set(key, index++);
        }
      }
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    for (let axis = 0; axis < 4; axis++) {
      const neighbor = v.slice();
      neighbor[axis] *= -1;
      const neighborKey = neighbor.join(',');
      const neighborIndex = vertexIndex.get(neighborKey);
      if (neighborIndex !== undefined && neighborIndex > i) {
        indices.push(i, neighborIndex);
      }
    }
  }

  return {
    positions: new Float32Array(vertices.flat()),
    indices: new Uint16Array(indices),
    drawMode: LINE_DRAW_MODE,
    vertexStride: 4,
    topology: {
      vertices: vertices.length,
      edges: indices.length / 2,
      faces: 24,
      cells: 8
    }
  };
}

export const TesseractGeometry = createTesseractGeometry();
