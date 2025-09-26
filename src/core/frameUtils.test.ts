import { describe, expect, it } from 'vitest';
import { flipPixelsVertically } from './frameUtils';

function createCheckerboard(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const on = (x + y) % 2 === 0;
      data[index + 0] = on ? 255 : 0;
      data[index + 1] = on ? 128 : 0;
      data[index + 2] = on ? 64 : 0;
      data[index + 3] = 255;
    }
  }
  return data;
}

describe('flipPixelsVertically', () => {
  it('returns a vertically flipped copy of the pixel buffer', () => {
    const width = 2;
    const height = 3;
    const source = createCheckerboard(width, height);
    const flipped = flipPixelsVertically(width, height, source);

    // Top row in source should become bottom row in flipped
    const sourceTop = Array.from(source.slice(0, width * 4));
    const flippedBottom = Array.from(flipped.slice((height - 1) * width * 4));
    expect(flippedBottom).toEqual(sourceTop);

    // Bottom row in source should become top row in flipped
    const sourceBottom = Array.from(source.slice((height - 1) * width * 4));
    const flippedTop = Array.from(flipped.slice(0, width * 4));
    expect(flippedTop).toEqual(sourceBottom);
  });
});
