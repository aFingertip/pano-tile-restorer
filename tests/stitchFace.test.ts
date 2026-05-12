import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stitchFace } from '../src/core/stitchFace.js';
import type { TileInput, TileTask } from '../src/types/index.js';

let tempDir: string;

const makeTask = (index: number, row: number, col: number): TileTask => ({
  level: 1,
  face: 'f',
  index,
  row,
  col,
  sourceRow: row,
  sourceCol: col,
  left: col * 64,
  top: row * 64,
  width: 64,
  height: 64
});

const makeTile = async (index: number, row: number, col: number, color: string): Promise<TileInput> => ({
  task: makeTask(index, row, col),
  buffer: await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: color
    }
  })
    .png()
    .toBuffer()
});

describe('stitchFace', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'pano-tile-restorer-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('stitches four 64px tiles into a 128px face', async () => {
    const tiles = await Promise.all([
      makeTile(0, 0, 0, '#ff0000'),
      makeTile(1, 0, 1, '#00ff00'),
      makeTile(2, 1, 0, '#0000ff'),
      makeTile(3, 1, 1, '#ffffff')
    ]);
    const output = await stitchFace('f', tiles, {
      outputDir: tempDir,
      faceSize: 128,
      faceFormat: 'png',
      quality: 95
    });
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(128);
    expect(meta.height).toBe(128);
  });
});
