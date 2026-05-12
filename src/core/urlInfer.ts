import sharp from 'sharp';
import { renderTileUrl } from './urlTemplate.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

export type ParsedKrpanoTileUrl = {
  originalUrl: string;
  mediaId: string;
  template: string;
  level: number;
  face: string;
  row: number;
  col: number;
  coordinateBase: number;
};

export type InferFromUrlOptions = {
  outputDir?: string;
  tileSize?: number;
  faceSize?: number;
  grid?: number;
  maxGrid?: number;
  faces?: string[];
  headers?: Record<string, string>;
  concurrency?: number;
  retry?: number;
  timeoutMs?: number;
  quality?: number;
  createCubemap3x2?: boolean;
  createCubemap6x1?: boolean;
  createEquirectangular?: boolean;
  equirectangularWidth?: number;
};

const DEFAULT_FACES = ['f', 'b', 'l', 'r', 'u', 'd'];

export const parseKrpanoTileUrl = (tileUrl: string): ParsedKrpanoTileUrl => {
  const url = new URL(tileUrl);
  const segments = url.pathname.split('/').filter(Boolean);
  const fileName = segments.at(-1);
  if (!fileName) {
    throw new Error('资源路径无法解析：URL 路径为空');
  }

  const match = /^l(?<level>\d+)_(?<face>[a-zA-Z]+)_(?<row>\d+)_(?<col>\d+)\.(?<ext>jpe?g|png|webp)$/i.exec(
    fileName
  );
  if (!match?.groups) {
    throw new Error(
      '资源路径无法解析：当前 from-url 支持 krpano 行列瓦片，例如 .../{face}/l3/6/l3_f_6_3.jpg'
    );
  }

  const level = Number(match.groups.level);
  const face = match.groups.face;
  const row = Number(match.groups.row);
  const col = Number(match.groups.col);
  const fileIndex = segments.length - 1;
  const rowDirIndex = fileIndex - 1;
  const levelDirIndex = fileIndex - 2;
  const faceDirIndex = fileIndex - 3;
  if (
    faceDirIndex < 0 ||
    segments[faceDirIndex] !== face ||
    segments[levelDirIndex] !== `l${level}` ||
    segments[rowDirIndex] !== String(row)
  ) {
    throw new Error(
      '资源路径无法解析：预期路径结构为 .../{face}/l{level}/{row}/l{level}_{face}_{row}_{col}.jpg'
    );
  }

  const templateSegments = [...segments];
  templateSegments[faceDirIndex] = '{face}';
  templateSegments[levelDirIndex] = 'l{level}';
  templateSegments[rowDirIndex] = '{row}';
  templateSegments[fileIndex] = `l{level}_{face}_{row}_{col}.${match.groups.ext}`;

  const mediaId = segments[faceDirIndex - 1] ?? `scene-l${level}`;
  const coordinateBase = row === 0 || col === 0 ? 0 : 1;

  return {
    originalUrl: tileUrl,
    mediaId,
    template: `${url.origin}/${templateSegments.join('/')}${url.search}`,
    level,
    face,
    row,
    col,
    coordinateBase
  };
};

const renderParsedUrl = (parsed: ParsedKrpanoTileUrl, row: number, col: number, face = parsed.face) =>
  renderTileUrl(parsed.template, {
    level: parsed.level,
    face,
    index: 0,
    row,
    col
  });

const requestOk = async (url: string, headers: Record<string, string>, timeoutMs: number) => {
  const head = await fetch(url, {
    method: 'HEAD',
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (head.ok) {
    return true;
  }
  if (![403, 405, 501].includes(head.status)) {
    return false;
  }

  const get = await fetch(url, {
    headers: {
      ...headers,
      range: 'bytes=0-0'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  return get.ok || get.status === 206;
};

const fetchTileMetadata = async (url: string, headers: Record<string, string>, timeoutMs: number) => {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`读取边缘瓦片失败：url=${url} status=${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return sharp(buffer, { failOn: 'none' }).metadata();
};

const detectAxisCount = async (
  parsed: ParsedKrpanoTileUrl,
  axis: 'row' | 'col',
  headers: Record<string, string>,
  timeoutMs: number,
  maxGrid: number
) => {
  let count = 0;
  const base = parsed.coordinateBase;

  for (let offset = 0; offset < maxGrid; offset++) {
    const value = base + offset;
    const url = axis === 'row' ? renderParsedUrl(parsed, value, base) : renderParsedUrl(parsed, base, value);
    try {
      if (await requestOk(url, headers, timeoutMs)) {
        count = offset + 1;
        continue;
      }
    } catch {
      if (count === 0) {
        throw new Error(`自动探测 ${axis} 网格失败：${url}`);
      }
    }
    if (count > 0) {
      break;
    }
  }

  return count;
};

const detectGrid = async (
  parsed: ParsedKrpanoTileUrl,
  options: Required<Pick<InferFromUrlOptions, 'headers' | 'timeoutMs' | 'maxGrid'>>
) => {
  const minGrid = Math.max(parsed.row, parsed.col) - parsed.coordinateBase + 1;
  const rowCount = await detectAxisCount(parsed, 'row', options.headers, options.timeoutMs, options.maxGrid);
  const colCount = await detectAxisCount(parsed, 'col', options.headers, options.timeoutMs, options.maxGrid);
  const grid = Math.max(rowCount, colCount);
  if (grid < minGrid) {
    throw new Error(`自动探测 grid=${grid} 小于样例瓦片所需的最小 grid=${minGrid}，请显式传入 --grid 或 --face-size`);
  }
  return grid;
};

const detectFaceSize = async (
  parsed: ParsedKrpanoTileUrl,
  grid: number,
  tileSize: number,
  headers: Record<string, string>,
  timeoutMs: number
) => {
  const base = parsed.coordinateBase;
  const edge = base + grid - 1;
  const rightEdgeUrl = renderParsedUrl(parsed, base, edge);
  const bottomEdgeUrl = renderParsedUrl(parsed, edge, base);
  const [rightEdge, bottomEdge] = await Promise.all([
    fetchTileMetadata(rightEdgeUrl, headers, timeoutMs),
    fetchTileMetadata(bottomEdgeUrl, headers, timeoutMs)
  ]);

  const edgeWidth = rightEdge.width ?? tileSize;
  const edgeHeight = bottomEdge.height ?? tileSize;
  const width = (grid - 1) * tileSize + Math.min(edgeWidth, tileSize);
  const height = (grid - 1) * tileSize + Math.min(edgeHeight, tileSize);

  if (width !== height) {
    logger.warn(`自动探测到宽高不一致：width=${width} height=${height}，将使用较大值作为 faceSize`);
  }
  return Math.max(width, height);
};

export const inferConfigFromTileUrl = async (tileUrl: string, options: InferFromUrlOptions = {}): Promise<Config> => {
  const parsed = parseKrpanoTileUrl(tileUrl);
  const tileSize = options.tileSize ?? 512;
  const headers = options.headers ?? { 'user-agent': 'Mozilla/5.0' };
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxGrid = options.maxGrid ?? 32;
  let grid = options.grid;
  if (grid === undefined && options.faceSize !== undefined) {
    grid = Math.ceil(options.faceSize / tileSize);
  }
  if (grid === undefined) {
    grid = await detectGrid(parsed, { headers, timeoutMs, maxGrid });
  }
  const faceSize = options.faceSize ?? (await detectFaceSize(parsed, grid, tileSize, headers, timeoutMs));
  const outputDir = options.outputDir ?? `./output/from-url/${parsed.mediaId}-l${parsed.level}`;

  return {
    mode: 'remote',
    outputDir,
    tile: {
      tileSize,
      level: parsed.level,
      faceSize,
      indexBase: 0,
      coordinateBase: parsed.coordinateBase,
      order: 'row-major',
      faces: options.faces ?? DEFAULT_FACES,
      urlTemplate: parsed.template
    },
    request: {
      headers,
      concurrency: options.concurrency ?? 4,
      retry: options.retry ?? 2,
      timeoutMs,
      delayMs: 0
    },
    output: {
      faceFormat: 'jpg',
      quality: options.quality ?? 95,
      createCubemap3x2: options.createCubemap3x2 ?? true,
      createCubemap6x1: options.createCubemap6x1 ?? true,
      createEquirectangular: options.createEquirectangular ?? true,
      ffmpegPath: 'ffmpeg',
      equirectangularWidth: options.equirectangularWidth ?? faceSize * 4
    }
  };
};
