import { describe, expect, it } from 'vitest';
import { listGeometries } from '../pipeline/geometryCatalog';

function eulerCharacteristic(topology: { vertices: number; edges: number; faces: number; cells: number }): number {
  return topology.vertices - topology.edges + topology.faces - topology.cells;
}

describe('geometry topologies', () => {
  const geometries = listGeometries();

  it('exposes all required topologies', () => {
    expect(geometries.length).toBeGreaterThan(0);
    for (const descriptor of geometries) {
      expect(descriptor.data.topology.vertices).toBeGreaterThan(0);
      expect(descriptor.data.topology.edges).toBeGreaterThan(0);
    }
  });

  it('has Euler characteristic of zero for regular polychora', () => {
    for (const descriptor of geometries) {
      const chi = eulerCharacteristic(descriptor.data.topology);
      expect(Math.abs(chi)).toBeLessThanOrEqual(1e-9);
    }
  });
});
