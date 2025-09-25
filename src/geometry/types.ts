export interface GeometryData {
  positions: Float32Array;
  indices: Uint16Array;
  drawMode: number;
  vertexStride: number;
}

export interface GeometryDescriptor {
  id: string;
  name: string;
  data: GeometryData;
}
