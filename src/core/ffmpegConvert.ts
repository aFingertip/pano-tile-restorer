import path from 'node:path';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

export const convertCubemapToEquirectangular = async (
  config: Config,
  cubemap3x2Path: string | null
): Promise<string | null> => {
  if (!config.output.createEquirectangular || !cubemap3x2Path) {
    return null;
  }

  try {
    await execa(config.output.ffmpegPath, ['-version']);
  } catch {
    logger.warn('未找到 ffmpeg，已跳过 equirectangular 输出');
    return null;
  }

  const outputPath = path.join(config.outputDir, 'equirectangular.jpg');
  const width = config.output.equirectangularWidth ?? config.tile.faceSize * 4;
  const height = Math.round(width / 2);
  const faceOrder = (config.tile.cubemap3x2Order ?? ['f', 'r', 'b', 'l', 'u', 'd']).join('');
  const filter = `v360=input=c3x2:output=e:in_forder=${faceOrder}:w=${width}:h=${height}`;

  try {
    await execa(config.output.ffmpegPath, ['-y', '-i', cubemap3x2Path, '-vf', filter, outputPath]);
    logger.success(`equirectangular 输出：${outputPath}`);
    return outputPath;
  } catch (error) {
    logger.warn(`ffmpeg 转换失败，已跳过 equirectangular 输出：${String(error)}`);
    return null;
  }
};
