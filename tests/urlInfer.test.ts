import { describe, expect, it } from 'vitest';
import { parseKrpanoTileUrl } from '../src/core/urlInfer.js';

describe('parseKrpanoTileUrl', () => {
  it('infers template from demo krpano l3 row/col tile url', () => {
    const parsed = parseKrpanoTileUrl(
      'https://example.com/tiles/demo-scene/f/l3/6/l3_f_6_3.jpg?t=1234567890'
    );

    expect(parsed).toMatchObject({
      mediaId: 'demo-scene',
      level: 3,
      face: 'f',
      row: 6,
      col: 3,
      coordinateBase: 1
    });
    expect(parsed.template).toBe(
      'https://example.com/tiles/demo-scene/{face}/l{level}/{row}/l{level}_{face}_{row}_{col}.jpg?t=1234567890'
    );
  });

  it('detects zero-based row/col urls', () => {
    const parsed = parseKrpanoTileUrl(
      'https://example.com/scene/f/l2/0/l2_f_0_0.jpg'
    );
    expect(parsed.coordinateBase).toBe(0);
  });
});
