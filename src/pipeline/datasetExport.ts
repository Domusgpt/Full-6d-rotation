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

export class DatasetExportService {
  private readonly queue: FramePayload[] = [];
  private totalEncoded = 0;
  private lastFormat: FrameFormat | null = null;

  enqueue(frame: FramePayload) {
    this.queue.push(frame);
  }

  async flush(format: FrameFormat = 'image/png'): Promise<EncodedFrame[]> {
    const results: EncodedFrame[] = [];
    const frames = this.queue.splice(0);
    for (const frame of frames) {
      results.push({
        blob: await this.encodeFrame(frame, format),
        metadata: frame.metadata
      });
    }
    if (results.length > 0) {
      this.totalEncoded += results.length;
      this.lastFormat = format;
    }
    return results;
  }

  getMetrics(): DatasetExportMetrics {
    return {
      pending: this.queue.length,
      totalEncoded: this.totalEncoded,
      lastFormat: this.lastFormat
    };
  }

  private async encodeFrame(frame: FramePayload, format: FrameFormat): Promise<Blob> {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(frame.width, frame.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to allocate offscreen context');
      const imageData = new ImageData(frame.pixels, frame.width, frame.height);
      context.putImageData(imageData, 0, 0);
      return canvas.convertToBlob({ type: format });
    }

    // Fallback: encode metadata + raw pixels as JSON for deterministic testing environments
    const payload = {
      format,
      width: frame.width,
      height: frame.height,
      metadata: frame.metadata,
      checksum: checksum(frame.pixels)
    };
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
  }
}

function checksum(pixels: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) {
    sum = (sum + pixels[i]) % 65536;
  }
  return sum;
}
