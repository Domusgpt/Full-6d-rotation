import { describe, expect, it } from 'vitest';
import { DatasetExportService } from './datasetExport';

describe('DatasetExportService', () => {
  it('encodes frames via JSON fallback when OffscreenCanvas is unavailable', async () => {
    const service = new DatasetExportService();
    service.enqueue({
      width: 2,
      height: 2,
      pixels: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
      metadata: {
        timestamp: 1,
        rotationAngles: [0, 0, 0, 0, 0, 0]
      }
    });
    const [frame] = await service.flush();
    expect(frame.metadata.timestamp).toBe(1);
    const text = await frame.blob.text();
    expect(text).toContain('checksum');
  });
});
