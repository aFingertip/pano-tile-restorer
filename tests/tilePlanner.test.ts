import { describe, expect, it } from 'vitest';
import { createTilePlan } from '../src/core/tilePlanner.js';
import type { Config } from '../src/types/index.js';

const baseConfig: Config = {
  mode: 'remote',
  outputDir: './output/test',
  tile: {
    tileSize: 512,
    level: 3,
    faceSize: 2048,
    indexBase: 0,
    coordinateBase: 0,
    order: 'row-major',
    faces: ['f'],
    urlTemplate: 'https://example.com/l{level}_{face}_{index}_{row}_{col}.jpg'
  },
  request: {
    headers: {},
    concurrency: 6,
    retry: 3,
    timeoutMs: 15000,
    delayMs: 0
  },
  output: {
    faceFormat: 'jpg',
    quality: 95,
    createCubemap3x2: false,
    createCubemap6x1: false,
    createEquirectangular: false,
    ffmpegPath: 'ffmpeg'
  }
};

describe('createTilePlan', () => {
  it('calculates grid and tile count', () => {
    const plan = createTilePlan(baseConfig);
    expect(plan.grid).toBe(4);
    expect(plan.tasks).toHaveLength(16);
  });

  it('plans row-major positions', () => {
    const plan = createTilePlan(baseConfig);
    expect(plan.tasks[5]).toMatchObject({
      index: 5,
      row: 1,
      col: 1,
      left: 512,
      top: 512
    });
  });

  it('plans column-major positions', () => {
    const plan = createTilePlan({
      ...baseConfig,
      tile: {
        ...baseConfig.tile,
        order: 'column-major'
      }
    });
    expect(
      plan.tasks.find((task) => task.row === 1 && task.col === 1)
    ).toMatchObject({
      index: 5,
      left: 512,
      top: 512
    });
    expect(
      plan.tasks.find((task) => task.row === 0 && task.col === 1)
    ).toMatchObject({
      index: 4
    });
  });

  it('supports indexBase=1', () => {
    const plan = createTilePlan({
      ...baseConfig,
      tile: {
        ...baseConfig.tile,
        indexBase: 1
      }
    });
    expect(plan.tasks[0].index).toBe(1);
    expect(plan.tasks[15].index).toBe(16);
  });

  it('supports coordinateBase for krpano row and column URLs', () => {
    const plan = createTilePlan({
      ...baseConfig,
      tile: {
        ...baseConfig.tile,
        level: 2,
        faceSize: 2176,
        coordinateBase: 1,
        urlTemplate:
          'https://example.com/tiles/demo-scene/{face}/l{level}/{row}/l{level}_{face}_{row}_{col}.jpg?t=1234567890'
      }
    });
    const task = plan.tasks.find(
      (item) =>
        item.face === 'f' && item.sourceRow === 3 && item.sourceCol === 4
    );
    expect(plan.grid).toBe(5);
    expect(task?.url).toBe(
      'https://example.com/tiles/demo-scene/f/l2/3/l2_f_3_4.jpg?t=1234567890'
    );
  });
});
