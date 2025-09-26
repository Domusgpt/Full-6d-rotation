export function flipPixelsVertically(
  width: number,
  height: number,
  source: Uint8Array | Uint8ClampedArray
): Uint8ClampedArray {
  const bytesPerRow = width * 4;
  const flipped = new Uint8ClampedArray(source.length);
  for (let row = 0; row < height; row++) {
    const srcStart = row * bytesPerRow;
    const destStart = (height - 1 - row) * bytesPerRow;
    flipped.set(source.subarray(srcStart, srcStart + bytesPerRow), destStart);
  }
  return flipped;
}
