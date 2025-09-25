import type { GeometryDescriptor } from '../geometry/types';
import { getGeometry, listGeometries, type GeometryId } from './geometryCatalog';
import type { HypercubeCore } from '../core/hypercubeCore';

export class GeometryController {
  private readonly descriptors: GeometryDescriptor[];
  private active: GeometryId | null = null;

  constructor(private readonly core: HypercubeCore) {
    this.descriptors = listGeometries();
  }

  getAvailableGeometries(): GeometryDescriptor[] {
    return this.descriptors.slice();
  }

  getActiveGeometry(): GeometryId | null {
    return this.active;
  }

  getDescriptor(id: GeometryId): GeometryDescriptor | undefined {
    return this.descriptors.find(descriptor => descriptor.id === id);
  }

  setActiveGeometry(id: GeometryId) {
    if (this.active === id) return;
    const geometry = getGeometry(id);
    this.core.setGeometry(geometry);
    this.active = id;
  }
}
