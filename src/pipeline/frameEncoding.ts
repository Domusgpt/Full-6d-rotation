import type { FrameFormat, FramePayload } from './datasetTypes';

export async function encodeFrameToBlob(frame: FramePayload, format: FrameFormat): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to allocate offscreen context');
    }
    const pixels =
      frame.pixels instanceof Uint8ClampedArray ? frame.pixels : new Uint8ClampedArray(frame.pixels);
    const imageData = context.createImageData(frame.width, frame.height);
    imageData.data.set(pixels);
    context.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: format });
  }

  const payload = {
    format,
    width: frame.width,
    height: frame.height,
    metadata: frame.metadata,
    checksum: checksum(frame.pixels)
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export function checksum(pixels: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) {
    sum = (sum + pixels[i]) % 65536;
  }
  return sum;
}
