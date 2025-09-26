export interface GeometryData {
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  drawMode: number;
  vertexStride: number;
  indexType?: number;
}

export const GL_LINES = 0x0001;
export const GL_UNSIGNED_SHORT = 0x1403;
export const GL_UNSIGNED_INT = 0x1405;

export interface GeometryDescriptor {
  id: string;
  name: string;
  data: GeometryData;
}
