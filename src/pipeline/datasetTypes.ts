export type FrameFormat = 'image/png' | 'image/webp' | 'video/webm';

export interface PipelineLatencyEnvelope {
  /** Time from the originating sensor sample to the uniform upload that consumed it. */
  uniformMs: number;
  /** Wall-clock timestamp (performance.now) when the uniform upload completed. */
  uniformTimestamp?: number;
  /** Time from the originating sensor sample to when the frame pixels were captured. */
  captureMs: number;
  /** Wall-clock timestamp when the capture completed. */
  captureTimestamp: number;
  /** Time spent encoding the captured frame. */
  encodeMs?: number;
  /** Wall-clock timestamp when encoding finished. */
  encodeCompletedTimestamp?: number;
  /** Aggregate end-to-end latency from sensor sample to encoded payload availability. */
  totalMs?: number;
}

export interface FrameMetadata {
  timestamp: number;
  rotationAngles: [number, number, number, number, number, number];
  confidence?: number;
  latency?: PipelineLatencyEnvelope;
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
