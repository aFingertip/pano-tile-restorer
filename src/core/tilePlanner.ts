import { renderTileUrl } from './urlTemplate.js';
import type { Config, TilePlan, TileTask } from '../types/index.js';

export const getGrid = (faceSize: number, tileSize: number) => Math.ceil(faceSize / tileSize);

export const createTilePlan = (config: Config): TilePlan => {
  const { tile } = config;
  const grid = getGrid(tile.faceSize, tile.tileSize);
  const tasks: TileTask[] = [];

  for (const face of tile.faces) {
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const zeroBasedIndex = tile.order === 'row-major' ? row * grid + col : col * grid + row;
        const index = tile.indexBase + zeroBasedIndex;
        const sourceRow = row + tile.coordinateBase;
        const sourceCol = col + tile.coordinateBase;
        const left = col * tile.tileSize;
        const top = row * tile.tileSize;
        const width = Math.min(tile.tileSize, tile.faceSize - left);
        const height = Math.min(tile.tileSize, tile.faceSize - top);
        const params = {
          level: tile.level,
          face,
          index,
          row: sourceRow,
          col: sourceCol
        };

        tasks.push({
          level: tile.level,
          face,
          index,
          row,
          col,
          sourceRow,
          sourceCol,
          left,
          top,
          width,
          height,
          url: tile.urlTemplate ? renderTileUrl(tile.urlTemplate, params) : undefined,
          localPath: tile.localPattern ? renderTileUrl(tile.localPattern, params) : undefined
        });
      }
    }
  }

  return { grid, tasks };
};
