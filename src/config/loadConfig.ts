import path from 'node:path';
import { ZodError } from 'zod';
import { readJsonFile } from '../utils/fs.js';
import { configSchema } from './schema.js';
import type { Config } from '../types/index.js';

export const loadConfig = async (configPath: string): Promise<Config> => {
  const resolved = path.resolve(configPath);
  try {
    const json = await readJsonFile<unknown>(resolved);
    return configSchema.parse(json) as Config;
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('\n');
      throw new Error(`配置错误：${resolved}\n${details}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`配置错误：${resolved} 不是合法 JSON：${error.message}`);
    }
    throw error;
  }
};
