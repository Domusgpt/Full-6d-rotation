import { describe, expect, it } from 'vitest';
import { FocusDirector } from './focusDirector';
import { RotationBus } from './rotationBus';
import type { GeometryDescriptor } from '../geometry/types';
import type { GeometryId } from './geometryCatalog';

class FakeGeometryController {
  active: GeometryId | null = null;
  constructor(private readonly geometries: GeometryDescriptor[]) {}
  getAvailableGeometries() {
    return this.geometries;
  }
  setActiveGeometry(id: GeometryId) {
    this.active = id;
  }
}

describe('FocusDirector', () => {
  it('applies focus hints and falls back on timeout', () => {
    const geometries = [{
      id: 'tesseract',
      name: 'Tesseract',
      data: {
        positions: new Float32Array(0),
        indices: new Uint16Array(0),
        drawMode: 0,
        vertexStride: 4,
        topology: { vertices: 16, edges: 32, faces: 24, cells: 8 }
      }
    } as GeometryDescriptor];
    const controller = new FakeGeometryController(geometries);
    const bus = new RotationBus();
    const director = new FocusDirector(controller as any, bus, { timeoutMs: 10 });

    director.ingestHint({ geometry: 'tesseract', rotationBias: { xy: 0.5 } });
    bus.push({
      xy: 0,
      xz: 0,
      yz: 0,
      xw: 0,
      yw: 0,
      zw: 0,
      timestamp: performance.now(),
      confidence: 0.5
    });
    director.update(performance.now());
    expect(controller.active).toBe('tesseract');

    director.update(performance.now() + 20);
    expect(controller.active).toBe('tesseract');
  });
});
