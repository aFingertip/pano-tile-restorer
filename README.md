# pano-tile-restorer

`pano-tile-restorer` 是一个 Node.js + TypeScript 命令行工具，用于在**已授权**的前提下，从全景项目的瓦片资源中还原 cube face、cubemap，并可选生成 2:1 equirectangular 全景图。

项目适合处理 krpano 一类全景切片资源，例如 `f/b/l/r/u/d` 六个面、`l{level}` 多级清晰度、`row/col` 或连续 `index` 编号的 512 瓦片。

## 主要能力

- 支持远程 URL 模板下载瓦片，也支持读取本地瓦片文件。
- 支持从一张 krpano 瓦片 URL 自动推导配置、探测网格并直接还原全景图。
- 支持从 HAR 文件提取瓦片 URL，辅助分析资源路径。
- 支持把瓦片拼接为六个 cube face。
- 支持输出 `cubemap_3x2`、`cubemap_6x1`。
- 安装 ffmpeg 后可输出 2:1 `equirectangular.jpg`。
- 生成 `report.json`，记录下载数量、缓存命中、缺失瓦片、失败瓦片和输出文件。

## 合法授权说明

本工具只应用于你拥有版权、授权或管理权限的全景资源，例如自有项目、公司内部素材、已授权客户素材或测试环境资源。

请不要使用本工具批量抓取、复制、传播他人网站上的受版权保护资源，也不要绕过登录、验证码、签名、防盗链、付费墙、DRM 或任何访问控制。需要 cookie/header 时，只能在你有授权的情况下通过配置文件提供，并且不要把包含敏感 header 的配置提交到 Git。

## 环境要求

- Node.js `>=20`
- pnpm `9.15.4`
- 可选：ffmpeg，用于生成 `equirectangular.jpg`

安装依赖并构建：

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
pnpm build
```

## 快速开始

项目根目录自带 `pano.config.json`，其中 URL 已替换为 `example.com` 示例数据，适合查看配置结构和验证瓦片计划。实际下载和拼接前，请先把示例 URL、尺寸和 header 替换为你有权访问的真实资源。

先探测配置会生成多少瓦片、示例 URL 是否符合预期：

```bash
pnpm start probe -c pano.config.json
```

替换为已授权资源后，执行完整流程：

```bash
pnpm start run -c pano.config.json
```

强制忽略缓存重新下载：

```bash
pnpm start run -c pano.config.json --force
```

默认示例输出目录：

```text
output/demo-krpano/demo-scene-l2/
  .cache/tiles/
  faces/
  cubemap_3x2.jpg
  cubemap_6x1.jpg
  equirectangular.jpg
  report.json
```

如果本机没有安装 ffmpeg，工具会跳过 `equirectangular.jpg`，其他输出不受影响。

## 常用方式

### 1. 从一张瓦片 URL 自动还原

如果你手里已有任意一张同场景 krpano 瓦片 URL，可以直接使用 `from-url`。下面的 URL 是格式示例，实际使用时请替换成你有权访问的瓦片地址：

```bash
pnpm start from-url "https://example.com/tiles/demo-scene/f/l3/6/l3_f_6_3.jpg?t=1234567890"
```

这个命令会自动推导：

- `urlTemplate`
- `level`
- `coordinateBase`
- `grid`
- `faceSize`
- 默认六面 `f,b,l,r,u,d`
- 默认输出目录 `./output/from-url/{mediaId}-l{level}`

只查看推导结果，不下载和拼接：

```bash
pnpm start from-url "https://example.com/tiles/demo-scene/f/l3/6/l3_f_6_3.jpg?t=1234567890" --probe-only
```

保存自动推导出的配置：

```bash
pnpm start from-url "https://example.com/tiles/demo-scene/f/l3/6/l3_f_6_3.jpg?t=1234567890" \
  --config-out pano.generated.json \
  --probe-only
```

已知尺寸时可以跳过自动探测：

```bash
pnpm start from-url "https://example.com/tiles/demo-scene/f/l3/6/l3_f_6_3.jpg?t=1234567890" \
  --face-size 4352 \
  --grid 9 \
  --out ./output/demo-scene-l3
```

`from-url` 当前面向 krpano 行列路径，要求文件名类似：

```text
.../{face}/l{level}/{row}/l{level}_{face}_{row}_{col}.jpg
```

### 2. 使用远程 URL 模板

生成远程配置模板：

```bash
pnpm start init --type remote --out pano.remote.json
```

编辑 `tile.urlTemplate`、`level`、`faceSize` 等字段后运行：

```bash
pnpm start probe -c pano.remote.json
pnpm start run -c pano.remote.json
```

URL 模板支持这些占位符：

```text
{level}
{face}
{index}
{row}
{col}
```

示例：

```json
{
  "urlTemplate": "https://example.com/tiles/demo-scene/{face}/l{level}/{row}/l{level}_{face}_{row}_{col}.jpg?t=1234567890"
}
```

如果资源使用 krpano `%v/%h` 风格，行列号常常从 `1` 开始，需要设置：

```json
{
  "coordinateBase": 1
}
```

工具内部仍使用 0-based 的 `row/col` 进行拼接，只在渲染 URL 或本地路径时加上 `coordinateBase`。

### 3. 使用本地瓦片文件

生成本地配置模板：

```bash
pnpm start init --type local --out pano.local.json
```

配置 `tile.localPattern` 后执行拼接：

```bash
pnpm start stitch -c pano.local.json
```

本地模式不会下载远程文件，会按 `localPattern` 渲染出的路径读取瓦片。

### 4. 从 HAR 文件提取 URL

在 Chrome DevTools 中导出 HAR：

1. 打开目标全景页面。
2. 打开 DevTools 的 Network 面板。
3. 旋转全景或切换场景，让页面加载瓦片。
4. 右键请求列表，选择 `Save all as HAR with content`。

提取匹配的瓦片 URL：

```bash
pnpm start extract-har ./network.har --pattern "tiles/.+\\.jpg" --out urls.txt
```

提取出的 URL 可用于分析模板，或挑选其中一条交给 `from-url` 自动推导。

## CLI 命令

```bash
pnpm start init --type remote --out pano.config.json
pnpm start init --type local --out pano.config.json
pnpm start init --type demo-krpano --out pano.config.json

pnpm start probe -c pano.config.json
pnpm start download -c pano.config.json
pnpm start download -c pano.config.json --force
pnpm start stitch -c pano.config.json
pnpm start run -c pano.config.json
pnpm start run -c pano.config.json --force
pnpm start show-config -c pano.config.json

pnpm start from-url "<tile-url>"
pnpm start from-url "<tile-url>" --probe-only
pnpm start from-url "<tile-url>" --config-out pano.generated.json --probe-only

pnpm start extract-har ./network.har --pattern "l\\d+_[fblrud]_\\d+_\\d+\\.jpg" --out urls.txt
```

命令说明：

- `init`：生成配置模板。
- `probe`：根据配置生成瓦片计划，只打印信息，不下载。
- `download`：远程模式下下载瓦片到 `.cache/tiles`。
- `stitch`：从远程缓存或本地路径读取瓦片并拼接输出。
- `run`：执行完整流程，包含下载或读取、拼接 faces、输出 cubemap、写入 report。
- `from-url`：从单张 krpano 瓦片 URL 推导配置并运行完整流程。
- `extract-har`：从 HAR 的 `request.url` 中提取匹配 URL。
- `show-config`：打印当前配置文件内容。

## 配置文件

典型配置：

```json
{
  "mode": "remote",
  "outputDir": "./output/demo",
  "tile": {
    "tileSize": 512,
    "level": 3,
    "faceSize": 2048,
    "indexBase": 0,
    "coordinateBase": 0,
    "order": "row-major",
    "faces": ["f", "b", "l", "r", "u", "d"],
    "urlTemplate": "https://example.com/tiles/l{level}_{face}_{index}.jpg"
  },
  "request": {
    "headers": {
      "user-agent": "Mozilla/5.0"
    },
    "concurrency": 6,
    "retry": 3,
    "timeoutMs": 15000,
    "delayMs": 0
  },
  "output": {
    "faceFormat": "jpg",
    "quality": 95,
    "createCubemap3x2": true,
    "createCubemap6x1": true,
    "createEquirectangular": false,
    "ffmpegPath": "ffmpeg"
  }
}
```

核心字段：

- `mode`：`remote` 表示下载 URL，`local` 表示读取本地文件。
- `outputDir`：所有缓存、拼接结果和报告的输出目录。
- `tile.tileSize`：单张瓦片尺寸，常见为 `512`。
- `tile.level`：清晰度层级，例如路径里的 `l2` 对应 `2`。
- `tile.faceSize`：单个 cube face 的完整边长。krpano XML 中的 `tiledimagewidth` 通常就是这个值。
- `tile.indexBase`：`{index}` 的起始值，常见为 `0` 或 `1`。
- `tile.coordinateBase`：`{row}` 和 `{col}` 的起始值，krpano 行列路径常见为 `1`。
- `tile.order`：`{index}` 的排列方式，支持 `row-major` 和 `column-major`。
- `tile.faces`：需要处理的六面名称，默认常见为 `f,b,l,r,u,d`。
- `tile.urlTemplate`：远程模式必填。
- `tile.localPattern`：本地模式必填。
- `tile.faceRotations`：按 face 设置旋转角度，支持 `0`、`90`、`180`、`270`。
- `tile.faceFlips`：按 face 设置水平或垂直翻转。
- `tile.cubemap3x2Order`：自定义 3x2 cubemap 面顺序。
- `tile.cubemap6x1Order`：自定义 6x1 cubemap 面顺序。
- `request.headers`：远程请求 header。
- `request.concurrency`：下载并发数。
- `request.retry`：下载失败重试次数。
- `request.timeoutMs`：请求超时时间。
- `request.delayMs`：每个下载任务前的延迟。
- `output.faceFormat`：输出图片格式，支持 `jpg`、`png`、`webp`。
- `output.quality`：图片质量，`1-100`。
- `output.createCubemap3x2`：是否输出 `cubemap_3x2`。
- `output.createCubemap6x1`：是否输出 `cubemap_6x1`。
- `output.createEquirectangular`：是否调用 ffmpeg 输出 2:1 全景图。
- `output.equirectangularWidth`：2:1 全景图宽度，默认 `faceSize * 4`。

## 编号和排列方式

`row-major`：

```text
0  1  2  3
4  5  6  7
8  9  10 11
12 13 14 15
```

`column-major`：

```text
0  4  8  12
1  5  9  13
2  6  10 14
3  7  11 15
```

如果 URL 使用 `{row}` 和 `{col}`，通常更需要关注 `coordinateBase`。如果 URL 使用连续 `{index}`，通常更需要关注 `indexBase` 和 `order`。

## cubemap 和 2:1 全景图

默认 cubemap 顺序：

```text
cubemap_3x2: f r b / l u d
cubemap_6x1: f r b l u d
```

启用 2:1 输出：

```json
{
  "output": {
    "createEquirectangular": true,
    "ffmpegPath": "ffmpeg",
    "equirectangularWidth": 4096
  }
}
```

内部会调用 ffmpeg 的 `v360` 滤镜完成转换。方向不对时，优先调整 `faceRotations`、`faceFlips` 或 cubemap order，再重新运行。

## 常见问题

下载返回 403 或 404：

- 确认你有权访问资源。
- 检查 `urlTemplate` 是否正确。
- 检查 `level`、`faceSize`、`coordinateBase`、`indexBase`。
- 如果资源确实需要 header，只能在授权前提下配置 `request.headers`。

拼接错位：

- 确认 `faceSize` 等于原始资源的单面完整尺寸。
- 确认 `tileSize` 与真实瓦片尺寸一致。
- 使用连续 `{index}` 时检查 `order` 和 `indexBase`。
- 使用 `{row}/{col}` 时检查 `coordinateBase`。

输出有黑块：

- 查看 `report.json` 中的 `missing` 和 `failed`。
- 远程模式检查 `.cache/tiles` 是否有缺失。
- 本地模式检查 `localPattern` 渲染后的路径是否存在。

没有生成 `equirectangular.jpg`：

- 确认 `output.createEquirectangular` 为 `true`。
- 确认本机已安装 ffmpeg，且 `ffmpegPath` 可执行。
- 确认已启用 `createCubemap3x2`，因为转换依赖 `cubemap_3x2`。

## 开发

```bash
pnpm test
pnpm build
pnpm lint
pnpm format
```

开发时也可以直接运行 TypeScript 入口：

```bash
pnpm dev probe -c pano.config.json
```
