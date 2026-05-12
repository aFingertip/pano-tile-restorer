import path from 'node:path';
import sharp from 'sharp';
import { ensureDir } from '../utils/fs.js';
import { encodeImage } from '../utils/image.js';
import { logger } from '../utils/logger.js';
import { create3x2Layout, create6x1Layout } from './cubemapLayout.js';
import type { Config } from '../types/index.js';

const stitchLayout = async (
  config: Config,
  facePaths: string[],
  type: '3x2' | '6x1'
): Promise<string> => {
  const faceByName = new Map(facePaths.map((filePath) => [path.basename(filePath).split('.')[0], filePath]));
  const layout =
    type === '3x2'
      ? create3x2Layout(config.tile.cubemap3x2Order)
      : create6x1Layout(config.tile.cubemap6x1Order);
  const width = config.tile.faceSize * (type === '3x2' ? 3 : 6);
  const height = config.tile.faceSize * (type === '3x2' ? 2 : 1);
  const outputPath = path.join(config.outputDir, `cubemap_${type}.${config.output.faceFormat}`);

  const composites = await Promise.all(
    layout.map(async (cell) => {
      const filePath = faceByName.get(cell.face);
      if (!filePath) {
        throw new Error(`cubemap 拼接失败：缺少 face=${cell.face}`);
      }
      return {
        input: await sharp(filePath).resize(config.tile.faceSize, config.tile.faceSize).toBuffer(),
        left: cell.x * config.tile.faceSize,
        top: cell.y * config.tile.faceSize
      };
    })
  );

  await ensureDir(config.outputDir);
  await encodeImage(
    sharp({
      create: {
        width,
        height,
        channels: 3,
        background: '#000000'
      }
    }).composite(composites),
    config.output.faceFormat,
    config.output.quality
  ).toFile(outputPath);

  logger.success(`cubemap 输出：${outputPath}`);
  return outputPath;
};

export const stitchCube = async (config: Config, facePaths: string[]) => {
  return {
    cubemap3x2: config.output.createCubemap3x2 ? await stitchLayout(config, facePaths, '3x2') : null,
    cubemap6x1: config.output.createCubemap6x1 ? await stitchLayout(config, facePaths, '6x1') : null
  };
};
