export type FrameFormat = 'image/png' | 'image/webp' | 'video/webm';

export interface FrameMetadata {
  timestamp: number;
  rotationAngles: [number, number, number, number, number, number];
}

export interface FramePayload {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  metadata: FrameMetadata;
}

export interface EncodedFrame {
  blob: Blob;
  metadata: FrameMetadata;
}

export interface DatasetExportMetrics {
  pending: number;
  totalEncoded: number;
  lastFormat: FrameFormat | null;
}
