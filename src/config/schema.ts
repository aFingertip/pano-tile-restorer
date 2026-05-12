import { z } from 'zod';

const imageFormatSchema = z.enum(['jpg', 'png', 'webp']);
const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

export const configSchema = z
  .object({
    mode: z.enum(['remote', 'local']),
    outputDir: z.string().min(1),
    tile: z
      .object({
        tileSize: z.number().int().positive(),
        level: z.number().int().nonnegative(),
        faceSize: z.number().int().positive(),
        indexBase: z.number().int().default(0),
        coordinateBase: z.number().int().default(0),
        order: z.enum(['row-major', 'column-major']).default('row-major'),
        faces: z.array(z.string().min(1)).min(1),
        urlTemplate: z.string().min(1).optional(),
        localPattern: z.string().min(1).optional(),
        faceRotations: z.record(z.string(), rotationSchema).optional(),
        faceFlips: z
          .record(
            z.string(),
            z.object({
              horizontal: z.boolean().optional(),
              vertical: z.boolean().optional()
            })
          )
          .optional(),
        cubemap3x2Order: z.array(z.string()).length(6).optional(),
        cubemap6x1Order: z.array(z.string()).length(6).optional()
      })
      .strict(),
    request: z
      .object({
        headers: z.record(z.string(), z.string()).default({}),
        concurrency: z.number().int().positive().default(6),
        retry: z.number().int().nonnegative().default(3),
        timeoutMs: z.number().int().positive().default(15000),
        delayMs: z.number().int().nonnegative().default(0)
      })
      .strict()
      .default({
        headers: {},
        concurrency: 6,
        retry: 3,
        timeoutMs: 15000,
        delayMs: 0
      }),
    output: z
      .object({
        faceFormat: imageFormatSchema.default('jpg'),
        quality: z.number().int().min(1).max(100).default(95),
        createCubemap3x2: z.boolean().default(true),
        createCubemap6x1: z.boolean().default(true),
        createEquirectangular: z.boolean().default(false),
        ffmpegPath: z.string().min(1).default('ffmpeg'),
        equirectangularWidth: z.number().int().positive().optional()
      })
      .strict()
      .default({
        faceFormat: 'jpg',
        quality: 95,
        createCubemap3x2: true,
        createCubemap6x1: true,
        createEquirectangular: false,
        ffmpegPath: 'ffmpeg'
      })
  })
  .strict()
  .superRefine((config, ctx) => {
    if (config.tile.faceSize < config.tile.tileSize) {
      ctx.addIssue({
        code: 'custom',
        path: ['tile', 'faceSize'],
        message: 'tile.faceSize 必须大于或等于 tile.tileSize'
      });
    }
    if (config.mode === 'remote' && !config.tile.urlTemplate) {
      ctx.addIssue({
        code: 'custom',
        path: ['tile', 'urlTemplate'],
        message: 'remote 模式必须提供 tile.urlTemplate'
      });
    }
    if (config.mode === 'local' && !config.tile.localPattern) {
      ctx.addIssue({
        code: 'custom',
        path: ['tile', 'localPattern'],
        message: 'local 模式必须提供 tile.localPattern'
      });
    }
  });

export type ParsedConfig = z.infer<typeof configSchema>;
