import sharp from 'sharp';
import type { ImageFormat } from '../types/index.js';

export const encodeImage = (image: sharp.Sharp, format: ImageFormat, quality: number) => {
  if (format === 'png') {
    return image.png({ quality });
  }
  if (format === 'webp') {
    return image.webp({ quality });
  }
  return image.jpeg({ quality, mozjpeg: true });
};

export const normalizeTileBuffer = async (buffer: Buffer, width: number, height: number) => {
  const image = sharp(buffer, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  if ((meta.width ?? 0) >= width && (meta.height ?? 0) >= height) {
    return image.extract({ left: 0, top: 0, width, height }).toBuffer();
  }
  return image.resize(width, height, { fit: 'cover' }).toBuffer();
};
