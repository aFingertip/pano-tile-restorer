import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ensureDir = async (dir: string) => {
  await mkdir(dir, { recursive: true });
};

export const fileExists = async (filePath: string) => {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
};

export const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

export const writeJsonFile = async (filePath: string, value: unknown) => {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

export const toPosixPath = (filePath: string) => filePath.split(path.sep).join('/');
