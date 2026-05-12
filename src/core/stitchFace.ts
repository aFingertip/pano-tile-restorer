import path from 'node:path';
import sharp from 'sharp';
import { ensureDir } from '../utils/fs.js';
import { encodeImage, normalizeTileBuffer } from '../utils/image.js';
import { logger } from '../utils/logger.js';
import type { Config, ImageFormat, TileInput } from '../types/index.js';

export type StitchFaceOptions = {
  outputDir: string;
  faceSize: number;
  faceFormat: ImageFormat;
  quality: number;
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
};

export const stitchFace = async (
  face: string,
  tiles: TileInput[],
  options: StitchFaceOptions
): Promise<string> => {
  const outputDir = path.join(options.outputDir, 'faces');
  await ensureDir(outputDir);
  const outputPath = path.join(outputDir, `${face}.${options.faceFormat}`);

  const composites = await Promise.all(
    tiles
      .filter((tile) => tile.task.face === face)
      .map(async (tile) => ({
        input: await normalizeTileBuffer(tile.buffer, tile.task.width, tile.task.height),
        left: tile.task.left,
        top: tile.task.top
      }))
  );

  let image = sharp({
    create: {
      width: options.faceSize,
      height: options.faceSize,
      channels: 3,
      background: '#000000'
    }
  }).composite(composites);

  if (options.rotation !== undefined && options.rotation !== 0) {
    image = image.rotate(options.rotation);
  }
  if (options.flipHorizontal) {
    image = image.flop();
  }
  if (options.flipVertical) {
    image = image.flip();
  }

  await encodeImage(image, options.faceFormat, options.quality).toFile(outputPath);
  logger.success(`拼接输出：${outputPath}`);
  return outputPath;
};

export const stitchFaces = async (config: Config, tiles: TileInput[]) => {
  const outputs: string[] = [];
  for (const face of config.tile.faces) {
    const flip = config.tile.faceFlips?.[face];
    outputs.push(
      await stitchFace(face, tiles, {
        outputDir: config.outputDir,
        faceSize: config.tile.faceSize,
        faceFormat: config.output.faceFormat,
        quality: config.output.quality,
        rotation: config.tile.faceRotations?.[face],
        flipHorizontal: flip?.horizontal,
        flipVertical: flip?.vertical
      })
    );
  }
  return outputs;
};
