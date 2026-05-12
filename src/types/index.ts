export type TileOrder = 'row-major' | 'column-major';
export type Face = string;
export type ImageFormat = 'jpg' | 'png' | 'webp';

export type FaceFlip = {
  horizontal?: boolean;
  vertical?: boolean;
};

export type Config = {
  mode: 'remote' | 'local';
  outputDir: string;
  tile: {
    tileSize: number;
    level: number;
    faceSize: number;
    indexBase: number;
    coordinateBase: number;
    order: TileOrder;
    faces: Face[];
    urlTemplate?: string;
    localPattern?: string;
    faceRotations?: Record<string, 0 | 90 | 180 | 270>;
    faceFlips?: Record<string, FaceFlip>;
    cubemap3x2Order?: Face[];
    cubemap6x1Order?: Face[];
  };
  request: {
    headers: Record<string, string>;
    concurrency: number;
    retry: number;
    timeoutMs: number;
    delayMs: number;
  };
  output: {
    faceFormat: ImageFormat;
    quality: number;
    createCubemap3x2: boolean;
    createCubemap6x1: boolean;
    createEquirectangular: boolean;
    ffmpegPath: string;
    equirectangularWidth?: number;
  };
};

export type UrlTemplateParams = {
  level: number;
  face: string;
  index: number;
  row: number;
  col: number;
};

export type TileTask = {
  level: number;
  face: string;
  index: number;
  row: number;
  col: number;
  sourceRow: number;
  sourceCol: number;
  left: number;
  top: number;
  width: number;
  height: number;
  url?: string;
  localPath?: string;
};

export type TileInput = {
  task: TileTask;
  buffer: Buffer;
  sourcePath?: string;
  fromCache?: boolean;
};

export type MissingTile = {
  face: string;
  index: number;
  row: number;
  col: number;
  path?: string;
  url?: string;
  reason: string;
};

export type TilePlan = {
  grid: number;
  tasks: TileTask[];
};

export type OutputReport = {
  success: boolean;
  mode: Config['mode'];
  level: number;
  tileSize: number;
  faceSize: number;
  grid: number;
  faces: string[];
  totalTiles: number;
  downloaded: number;
  fromCache: number;
  missing: MissingTile[];
  failed: MissingTile[];
  outputs: {
    faces: string[];
    cubemap3x2: string | null;
    cubemap6x1: string | null;
    equirectangular: string | null;
  };
};
