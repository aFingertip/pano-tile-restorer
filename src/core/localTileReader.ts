import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type { MissingTile, TileInput, TileTask } from '../types/index.js';

export type LocalReadResult = {
  tiles: TileInput[];
  missing: MissingTile[];
};

export const readLocalTiles = async (tasks: TileTask[]): Promise<LocalReadResult> => {
  const tiles: TileInput[] = [];
  const missing: MissingTile[] = [];

  for (const task of tasks) {
    const localPath = task.localPath ? path.resolve(task.localPath) : undefined;
    if (!localPath || !(await fileExists(localPath))) {
      missing.push({
        face: task.face,
        index: task.index,
        row: task.row,
        col: task.col,
        path: localPath,
        reason: '本地文件缺失'
      });
      logger.warn(`本地文件缺失：face=${task.face} index=${task.index} path=${localPath ?? '<empty>'}`);
      continue;
    }
    const buffer = await readFile(localPath);
    tiles.push({ task, buffer, sourcePath: localPath });
  }

  return { tiles, missing };
};
