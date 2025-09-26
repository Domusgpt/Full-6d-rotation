export interface GeometryTopology {
  vertices: number;
  edges: number;
  faces: number;
  cells: number;
}

export interface GeometryData {
  positions: Float32Array;
  indices: Uint16Array;
  drawMode: number;
  vertexStride: number;
  topology: GeometryTopology;
}

export interface GeometryDescriptor {
  id: string;
  name: string;
  data: GeometryData;
}

export const LINE_DRAW_MODE = 0x0001;
