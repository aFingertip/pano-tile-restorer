import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { loadConfig } from './config/loadConfig.js';
import { configSchema } from './config/schema.js';
import { downloadTiles } from './core/downloader.js';
import { convertCubemapToEquirectangular } from './core/ffmpegConvert.js';
import { extractUrlsFromHar } from './core/harParser.js';
import { readLocalTiles } from './core/localTileReader.js';
import { createTilePlan } from './core/tilePlanner.js';
import { stitchCube } from './core/stitchCube.js';
import { stitchFaces } from './core/stitchFace.js';
import { inferConfigFromTileUrl } from './core/urlInfer.js';
import { ensureDir, writeJsonFile } from './utils/fs.js';
import { logger } from './utils/logger.js';
import type {
  Config,
  MissingTile,
  OutputReport,
  TileInput
} from './types/index.js';

const defaultRemoteConfig = {
  mode: 'remote',
  outputDir: './output/demo',
  tile: {
    tileSize: 512,
    level: 3,
    faceSize: 2048,
    indexBase: 0,
    coordinateBase: 0,
    order: 'row-major',
    faces: ['f', 'b', 'l', 'r', 'u', 'd'],
    urlTemplate: 'https://example.com/path/l{level}_{face}_{index}.jpg'
  },
  request: {
    headers: {
      'user-agent': 'Mozilla/5.0'
    },
    concurrency: 6,
    retry: 3,
    timeoutMs: 15000,
    delayMs: 0
  },
  output: {
    faceFormat: 'jpg',
    quality: 95,
    createCubemap3x2: true,
    createCubemap6x1: false,
    createEquirectangular: false
  }
};

const defaultLocalConfig = {
  mode: 'local',
  outputDir: './output/local-demo',
  tile: {
    tileSize: 512,
    level: 3,
    faceSize: 2048,
    indexBase: 0,
    coordinateBase: 0,
    order: 'row-major',
    faces: ['f', 'b', 'l', 'r', 'u', 'd'],
    localPattern: './tiles/l{level}_{face}_{index}.jpg'
  },
  output: {
    faceFormat: 'png',
    quality: 95,
    createCubemap3x2: true,
    createCubemap6x1: false,
    createEquirectangular: false
  }
};

const demoKrpanoConfig = {
  mode: 'remote',
  outputDir: './output/demo-krpano/demo-scene-l2',
  tile: {
    tileSize: 512,
    level: 2,
    faceSize: 2176,
    indexBase: 0,
    coordinateBase: 1,
    order: 'row-major',
    faces: ['f', 'b', 'l', 'r', 'u', 'd'],
    urlTemplate:
      'https://example.com/tiles/demo-scene/{face}/l{level}/{row}/l{level}_{face}_{row}_{col}.jpg?t=1234567890'
  },
  request: {
    headers: {
      'user-agent': 'Mozilla/5.0'
    },
    concurrency: 4,
    retry: 2,
    timeoutMs: 15000,
    delayMs: 0
  },
  output: {
    faceFormat: 'jpg',
    quality: 95,
    createCubemap3x2: true,
    createCubemap6x1: true,
    createEquirectangular: true,
    ffmpegPath: 'ffmpeg',
    equirectangularWidth: 8704
  }
};

const resolveConfig = (configPath: string) => path.resolve(configPath);

const parseIntegerOption = (value: string | undefined, name: string) => {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return parsed;
};

const parseFacesOption = (value: string | undefined) =>
  value
    ?.split(',')
    .map((face) => face.trim())
    .filter(Boolean);

export const probeConfig = (config: Config) => {
  const plan = createTilePlan(config);
  const tilesPerFace = plan.grid * plan.grid;
  logger.info(`level: ${config.tile.level}`);
  logger.info(`faces: ${config.tile.faces.join(',')}`);
  logger.info(`tileSize: ${config.tile.tileSize}`);
  logger.info(`faceSize: ${config.tile.faceSize}`);
  logger.info(`grid: ${plan.grid} x ${plan.grid}`);
  logger.info(`tilesPerFace: ${tilesPerFace}`);
  logger.info(`totalTiles: ${plan.tasks.length}`);
  if (plan.tasks[0]?.url) {
    logger.info(`sampleUrl: ${plan.tasks[0].url}`);
  }
};

const collectTiles = async (
  config: Config,
  force: boolean
): Promise<{
  tiles: TileInput[];
  downloaded: number;
  fromCache: number;
  missing: MissingTile[];
  failed: MissingTile[];
}> => {
  const plan = createTilePlan(config);
  if (config.mode === 'remote') {
    const result = await downloadTiles(plan.tasks, config, force);
    return {
      tiles: result.tiles,
      downloaded: result.downloaded,
      fromCache: result.fromCache,
      missing: [],
      failed: result.failed
    };
  }

  const result = await readLocalTiles(plan.tasks);
  return {
    tiles: result.tiles,
    downloaded: 0,
    fromCache: 0,
    missing: result.missing,
    failed: []
  };
};

const writeReport = async (config: Config, report: OutputReport) => {
  const reportPath = path.join(config.outputDir, 'report.json');
  await writeJsonFile(reportPath, report);
  logger.success(`最终报告：${reportPath}`);
};

export const runPipeline = async (config: Config, force: boolean) => {
  const plan = createTilePlan(config);
  await ensureDir(config.outputDir);
  probeConfig(config);

  const collected = await collectTiles(config, force);
  const facePaths = await stitchFaces(config, collected.tiles);
  const cubemap = await stitchCube(config, facePaths);
  const equirectangular = await convertCubemapToEquirectangular(
    config,
    cubemap.cubemap3x2
  );

  const report: OutputReport = {
    success: collected.missing.length === 0 && collected.failed.length === 0,
    mode: config.mode,
    level: config.tile.level,
    tileSize: config.tile.tileSize,
    faceSize: config.tile.faceSize,
    grid: plan.grid,
    faces: config.tile.faces,
    totalTiles: plan.tasks.length,
    downloaded: collected.downloaded,
    fromCache: collected.fromCache,
    missing: collected.missing,
    failed: collected.failed,
    outputs: {
      faces: facePaths,
      cubemap3x2: cubemap.cubemap3x2,
      cubemap6x1: cubemap.cubemap6x1,
      equirectangular
    }
  };

  await writeReport(config, report);
  if (report.success) {
    logger.success('还原完成');
  } else {
    logger.warn(
      `还原完成，但存在 missing=${report.missing.length} failed=${report.failed.length}`
    );
  }
};

export const createCli = () => {
  const program = new Command();
  program
    .name('pano-tile-restorer')
    .description('Authorized panorama tile restorer')
    .version('0.1.0');

  program
    .command('init')
    .description('生成 pano.config.json')
    .option('--type <type>', 'remote | local | demo-krpano', 'remote')
    .option('--out <path>', '输出配置路径', 'pano.config.json')
    .action(async (options: { type: string; out: string }) => {
      const config =
        options.type === 'local'
          ? defaultLocalConfig
          : options.type === 'demo-krpano'
            ? demoKrpanoConfig
            : defaultRemoteConfig;
      const parsed = configSchema.parse(config);
      await writeJsonFile(options.out, parsed);
      logger.success(`已生成配置：${options.out}`);
    });

  program
    .command('probe')
    .description('探测配置和瓦片计划')
    .requiredOption('-c, --config <path>', '配置文件')
    .action(async (options: { config: string }) => {
      const config = await loadConfig(resolveConfig(options.config));
      probeConfig(config);
    });

  program
    .command('download')
    .description('下载远程瓦片到缓存')
    .requiredOption('-c, --config <path>', '配置文件')
    .option('--force', '强制重新下载', false)
    .action(async (options: { config: string; force: boolean }) => {
      const config = await loadConfig(resolveConfig(options.config));
      if (config.mode !== 'remote') {
        throw new Error('download 命令仅支持 remote 模式');
      }
      const plan = createTilePlan(config);
      await ensureDir(config.outputDir);
      const result = await downloadTiles(plan.tasks, config, options.force);
      await writeReport(config, {
        success: result.failed.length === 0,
        mode: config.mode,
        level: config.tile.level,
        tileSize: config.tile.tileSize,
        faceSize: config.tile.faceSize,
        grid: plan.grid,
        faces: config.tile.faces,
        totalTiles: plan.tasks.length,
        downloaded: result.downloaded,
        fromCache: result.fromCache,
        missing: [],
        failed: result.failed,
        outputs: {
          faces: [],
          cubemap3x2: null,
          cubemap6x1: null,
          equirectangular: null
        }
      });
    });

  program
    .command('stitch')
    .description('从缓存或本地文件拼接 faces 和 cubemap')
    .requiredOption('-c, --config <path>', '配置文件')
    .action(async (options: { config: string }) => {
      const config = await loadConfig(resolveConfig(options.config));
      const collected = await collectTiles(config, false);
      const plan = createTilePlan(config);
      const facePaths = await stitchFaces(config, collected.tiles);
      const cubemap = await stitchCube(config, facePaths);
      const equirectangular = await convertCubemapToEquirectangular(
        config,
        cubemap.cubemap3x2
      );
      await writeReport(config, {
        success:
          collected.missing.length === 0 && collected.failed.length === 0,
        mode: config.mode,
        level: config.tile.level,
        tileSize: config.tile.tileSize,
        faceSize: config.tile.faceSize,
        grid: plan.grid,
        faces: config.tile.faces,
        totalTiles: plan.tasks.length,
        downloaded: collected.downloaded,
        fromCache: collected.fromCache,
        missing: collected.missing,
        failed: collected.failed,
        outputs: {
          faces: facePaths,
          cubemap3x2: cubemap.cubemap3x2,
          cubemap6x1: cubemap.cubemap6x1,
          equirectangular
        }
      });
    });

  program
    .command('run')
    .description('一键下载/读取、拼接 faces、输出 cubemap 和 report')
    .requiredOption('-c, --config <path>', '配置文件')
    .option('--force', '强制重新下载', false)
    .action(async (options: { config: string; force: boolean }) => {
      const config = await loadConfig(resolveConfig(options.config));
      await runPipeline(config, options.force);
    });

  program
    .command('from-url')
    .description('输入一张 krpano 瓦片 URL，自动推导配置并直接还原全景图')
    .argument(
      '<url>',
      '任意一张同场景瓦片 URL，例如 .../f/l3/6/l3_f_6_3.jpg?t=...'
    )
    .option(
      '--out <dir>',
      '输出目录，默认 ./output/from-url/{mediaId}-l{level}'
    )
    .option('--config-out <path>', '保存自动推导出的配置 JSON')
    .option('--tile-size <px>', '瓦片尺寸，默认 512')
    .option(
      '--face-size <px>',
      '单个 cube face 尺寸；传入后跳过自动探测 faceSize'
    )
    .option('--grid <n>', '每个 face 的行列数；传入后跳过自动探测 grid')
    .option('--max-grid <n>', '自动探测最大网格，默认 32')
    .option('--faces <faces>', '逗号分隔的 face 列表，默认 f,b,l,r,u,d')
    .option('--concurrency <n>', '下载并发，默认 4')
    .option('--retry <n>', '下载重试次数，默认 2')
    .option('--timeout-ms <ms>', '请求超时，默认 15000')
    .option('--equirectangular-width <px>', '2:1 全景图宽度，默认 4 * faceSize')
    .option(
      '--skip-equirectangular',
      '只输出六面图和 cubemap，不输出 2:1 全景图',
      false
    )
    .option('--probe-only', '只推导配置和打印计划，不下载拼接', false)
    .option('--force', '强制重新下载', false)
    .action(
      async (
        url: string,
        options: {
          out?: string;
          configOut?: string;
          tileSize?: string;
          faceSize?: string;
          grid?: string;
          maxGrid?: string;
          faces?: string;
          concurrency?: string;
          retry?: string;
          timeoutMs?: string;
          equirectangularWidth?: string;
          skipEquirectangular: boolean;
          probeOnly: boolean;
          force: boolean;
        }
      ) => {
        const config = await inferConfigFromTileUrl(url, {
          outputDir: options.out,
          tileSize: parseIntegerOption(options.tileSize, '--tile-size'),
          faceSize: parseIntegerOption(options.faceSize, '--face-size'),
          grid: parseIntegerOption(options.grid, '--grid'),
          maxGrid: parseIntegerOption(options.maxGrid, '--max-grid'),
          faces: parseFacesOption(options.faces),
          concurrency: parseIntegerOption(options.concurrency, '--concurrency'),
          retry:
            options.retry === undefined
              ? undefined
              : (() => {
                  const value = Number(options.retry);
                  if (!Number.isInteger(value) || value < 0) {
                    throw new Error('--retry 必须是非负整数');
                  }
                  return value;
                })(),
          timeoutMs: parseIntegerOption(options.timeoutMs, '--timeout-ms'),
          equirectangularWidth: parseIntegerOption(
            options.equirectangularWidth,
            '--equirectangular-width'
          ),
          createEquirectangular: !options.skipEquirectangular
        });
        const parsed = configSchema.parse(config) as Config;

        if (options.configOut) {
          await writeJsonFile(options.configOut, parsed);
          logger.success(`已保存自动配置：${options.configOut}`);
        }

        if (options.probeOnly) {
          probeConfig(parsed);
          return;
        }

        await runPipeline(parsed, options.force);
      }
    );

  program
    .command('extract-har')
    .description('从 HAR request.url 中提取瓦片 URL')
    .argument('<har>', 'HAR 文件')
    .requiredOption('--pattern <regex>', '过滤 URL 的正则')
    .option('--out <path>', '输出文件', 'urls.txt')
    .action(async (har: string, options: { pattern: string; out: string }) => {
      const urls = await extractUrlsFromHar(har, options.pattern);
      await ensureDir(path.dirname(path.resolve(options.out)));
      await writeFile(options.out, `${urls.join('\n')}\n`, 'utf8');
      logger.success(`已提取 ${urls.length} 个 URL：${options.out}`);
    });

  program
    .command('show-config')
    .description('打印当前配置 JSON')
    .requiredOption('-c, --config <path>', '配置文件')
    .action(async (options: { config: string }) => {
      const raw = await readFile(resolveConfig(options.config), 'utf8');
      process.stdout.write(raw);
    });

  return program;
};
