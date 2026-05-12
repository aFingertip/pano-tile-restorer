import { describe, expect, it } from 'vitest';
import { renderTileUrl } from '../src/core/urlTemplate.js';

describe('renderTileUrl', () => {
  it('renders index based template', () => {
    expect(
      renderTileUrl('https://example.com/l{level}_{face}_{index}.jpg', {
        level: 3,
        face: 'r',
        index: 4,
        row: 1,
        col: 0
      })
    ).toBe('https://example.com/l3_r_4.jpg');
  });

  it('renders row and col template', () => {
    expect(
      renderTileUrl('https://example.com/l{level}/{face}/{row}_{col}.jpg', {
        level: 2,
        face: 'f',
        index: 13,
        row: 3,
        col: 4
      })
    ).toBe('https://example.com/l2/f/3_4.jpg');
  });

  it('keeps query parameters', () => {
    expect(
      renderTileUrl(
        'https://example.com/pano/l{level}_{face}_{index}.jpg?t=1234567890',
        {
          level: 4,
          face: 'u',
          index: 7,
          row: 1,
          col: 3
        }
      )
    ).toBe('https://example.com/pano/l4_u_7.jpg?t=1234567890');
  });
});
