import type { FrameFormat, FramePayload } from './datasetExport';

export async function encodeFrameToBlob(frame: FramePayload, format: FrameFormat): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to allocate offscreen context');
    const imageData = new ImageData(frame.pixels, frame.width, frame.height);
    context.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: format });
  }

  const payload = {
    format,
    width: frame.width,
    height: frame.height,
    metadata: frame.metadata,
    checksum: calculateChecksum(frame.pixels)
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export function calculateChecksum(pixels: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) {
    sum = (sum + pixels[i]) % 65536;
  }
  return sum;
}
