#!/usr/bin/env node
import { createCli } from './cli.js';
import { logger } from './utils/logger.js';

createCli()
  .parseAsync(process.argv)
  .catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
