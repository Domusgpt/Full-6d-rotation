import { SixHundredCellGeometry } from '../geometry/sixHundredCell';
import { TesseractGeometry } from '../geometry/tesseract';
import { TwentyFourCellGeometry } from '../geometry/twentyFourCell';
import type { GeometryData, GeometryDescriptor } from '../geometry/types';

export type GeometryId = 'tesseract' | 'twentyFourCell' | 'sixHundredCell';

const CATALOG: Record<GeometryId, GeometryDescriptor> = {
  tesseract: {
    id: 'tesseract',
    name: 'Tesseract',
    data: TesseractGeometry
  },
  twentyFourCell: {
    id: 'twentyFourCell',
    name: '24-Cell',
    data: TwentyFourCellGeometry
  },
  sixHundredCell: {
    id: 'sixHundredCell',
    name: '600-Cell',
    data: SixHundredCellGeometry
  }
};

export function listGeometries(): GeometryDescriptor[] {
  return Object.values(CATALOG);
}

export function getGeometry(id: GeometryId): GeometryData {
  const entry = CATALOG[id];
  if (!entry) {
    throw new Error(`Unknown geometry: ${id}`);
  }
  return entry.data;
}
