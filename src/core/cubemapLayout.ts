import type { Face } from '../types/index.js';

export type CubemapCell = {
  face: Face;
  x: number;
  y: number;
};

export const defaultOrder: Face[] = ['f', 'r', 'b', 'l', 'u', 'd'];

export const create3x2Layout = (order: Face[] = defaultOrder): CubemapCell[] => {
  if (order.length !== 6) {
    throw new Error('3x2 cubemap layout 需要 6 个面');
  }
  return order.map((face, index) => ({
    face,
    x: index % 3,
    y: Math.floor(index / 3)
  }));
};

export const create6x1Layout = (order: Face[] = defaultOrder): CubemapCell[] => {
  if (order.length !== 6) {
    throw new Error('6x1 cubemap layout 需要 6 个面');
  }
  return order.map((face, index) => ({
    face,
    x: index,
    y: 0
  }));
};
