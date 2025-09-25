import type { GeometryData } from './types';

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
    drawMode: WebGL2RenderingContext.LINES,
    vertexStride: 4
  };
}

export const TesseractGeometry = createTesseractGeometry();
