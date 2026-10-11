/**
 * The perf gate's judging, apart from the browser: how far each figure may
 * move from its baseline before it is a change. The gate itself is only
 * ever run whole, on the GPU, where a judgement that lets a change through
 * looks the same as one that passes.
 */
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { GRASS_WOBBLE, TOLERANCE, moved, pixelsApart } from '../smoke/judging';

describe('the perf gate', () => {
  it('holds the download to the byte, either way', () => {
    // the build gives the same bytes every time, so any byte more or less is a change, and one that crept a
    // kilobyte at a time under a tenth went unseen in three games until something unrelated tripped it
    expect(moved('bundleBytes', 41_513, 41_513)).toBe(false);
    expect(moved('bundleBytes', 41_513, 41_514)).toBe(true);
    expect(moved('bundleBytes', 41_513, 41_512)).toBe(true);
    expect(TOLERANCE.bundleBytes).toEqual([0, 0]);
  });

  it('holds the frame to a share of itself, both ways, and a hair more for a frame too small to share', () => {
    expect(moved('frameMs', 0.171, 0.171)).toBe(false);
    expect(moved('frameMs', 0.171, 0.19)).toBe(false);
    expect(moved('frameMs', 0.171, 0.2)).toBe(true);
    expect(moved('frameMs', 0.171, 0.14)).toBe(true);
    // a frame of half its baseline, or three times it: what the old slack of 0.6 ms let through
    expect(moved('frameMs', 0.171, 0.085)).toBe(true);
    expect(moved('frameMs', 0.171, 0.513)).toBe(true);
  });

  it('holds the boot both ways', () => {
    expect(moved('bootMs', 50, 60)).toBe(false);
    expect(moved('bootMs', 1000, 1400)).toBe(true);
    expect(moved('bootMs', 1000, 600)).toBe(true);
  });
});

describe('the pictures, drawn twice at one moment', () => {
  const picture = (paint: (x: number, y: number) => [number, number, number]) => {
    const png = new PNG({ width: 20, height: 10 });
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 20; x++) {
        const [r, g, b] = paint(x, y);
        png.data.set([r, g, b, 255], (y * 20 + x) * 4);
      }
    return PNG.sync.write(png);
  };
  const flat = picture(() => [40, 90, 30]);

  it('count the pixels that differ by more than a few of 255, and none where they are the same', () => {
    expect(pixelsApart(flat, flat)).toBe(0);
    expect(
      pixelsApart(
        flat,
        picture((x, y) => (x === 3 && y === 4 ? [200, 90, 30] : [40, 90, 30])),
      ),
    ).toBe(1);
    // a drift of a few levels in a channel is the GPU's and not a change
    expect(
      pixelsApart(
        flat,
        picture(() => [43, 88, 32]),
      ),
    ).toBe(0);
    expect(
      pixelsApart(
        flat,
        picture(() => [40, 90, 40]),
      ),
    ).toBe(200);
  });

  it('tell pictures of different sizes apart as wholly different', () => {
    const png = new PNG({ width: 4, height: 4 });
    expect(pixelsApart(flat, PNG.sync.write(png))).toBe(200);
  });

  it('forgive the grass its wobble, which is a few pixels, and not a button, which is hundreds', () => {
    expect(GRASS_WOBBLE).toBeGreaterThanOrEqual(1);
    expect(GRASS_WOBBLE).toBeLessThan(100);
  });
});
