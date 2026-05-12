import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { ensureDir, fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { retry, sleep } from '../utils/retry.js';
import type { Config, MissingTile, TileInput, TileTask } from '../types/index.js';

const extensionFromUrl = (url: string) => {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).replace('.', '').toLowerCase();
  return ext || 'jpg';
};

const cachePathForTask = (outputDir: string, task: TileTask) => {
  const ext = task.url ? extensionFromUrl(task.url) : 'jpg';
  return path.join(outputDir, '.cache', 'tiles', task.face, `${task.index}.${ext}`);
};

export type DownloadResult = {
  tiles: TileInput[];
  failed: MissingTile[];
  downloaded: number;
  fromCache: number;
};

export const downloadTile = async (
  task: TileTask,
  config: Config,
  force = false
): Promise<{ input: TileInput; status: 'downloaded' | 'cache' }> => {
  if (!task.url) {
    throw new Error(`下载失败：face=${task.face} index=${task.index} 未生成 URL`);
  }

  const cachePath = cachePathForTask(config.outputDir, task);
  if (!force && (await fileExists(cachePath))) {
    const buffer = await readFile(cachePath);
    return { input: { task, buffer, sourcePath: cachePath, fromCache: true }, status: 'cache' };
  }

  if (config.request.delayMs > 0) {
    await sleep(config.request.delayMs);
  }

  const buffer = await retry(
    async () => {
      const response = await fetch(task.url!, {
        headers: config.request.headers,
        signal: AbortSignal.timeout(config.request.timeoutMs)
      });
      if (!response.ok) {
        throw new Error(`status=${response.status}`);
      }
      const data = await response.arrayBuffer();
      return Buffer.from(data);
    },
    {
      retries: config.request.retry,
      onRetry(attempt, error) {
        logger.warn(
          `重试下载 attempt=${attempt} face=${task.face} index=${task.index} url=${task.url} reason=${String(error)}`
        );
      }
    }
  );

  await ensureDir(path.dirname(cachePath));
  await writeFile(cachePath, buffer);
  return { input: { task, buffer, sourcePath: cachePath, fromCache: false }, status: 'downloaded' };
};

export const downloadTiles = async (
  tasks: TileTask[],
  config: Config,
  force = false
): Promise<DownloadResult> => {
  const limit = pLimit(config.request.concurrency);
  const tiles: TileInput[] = [];
  const failed: MissingTile[] = [];
  let downloaded = 0;
  let fromCache = 0;
  let completed = 0;

  await Promise.all(
    tasks.map((task) =>
      limit(async () => {
        try {
          const result = await downloadTile(task, config, force);
          tiles.push(result.input);
          if (result.status === 'cache') {
            fromCache++;
          } else {
            downloaded++;
          }
        } catch (error) {
          failed.push({
            face: task.face,
            index: task.index,
            row: task.row,
            col: task.col,
            url: task.url,
            reason: String(error)
          });
          logger.error(`下载失败：face=${task.face} index=${task.index} url=${task.url} ${String(error)}`);
        } finally {
          completed++;
          if (completed === tasks.length || completed % 10 === 0) {
            logger.info(`下载进度 ${completed}/${tasks.length}`);
          }
        }
      })
    )
  );

  return { tiles, failed, downloaded, fromCache };
};
