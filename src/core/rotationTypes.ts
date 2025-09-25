export interface RotationAngles {
  xy: number;
  xz: number;
  yz: number;
  xw: number;
  yw: number;
  zw: number;
}

export interface RotationSnapshot extends RotationAngles {
  timestamp: number;
  confidence: number;
}

export const ZERO_ROTATION: RotationAngles = {
  xy: 0,
  xz: 0,
  yz: 0,
  xw: 0,
  yw: 0,
  zw: 0
};
