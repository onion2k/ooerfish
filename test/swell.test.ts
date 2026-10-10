/** The height the water stands at, for what floats on it: the renderer's own sum, or nought for water that lies still. */
import { GRAVITY_MM, heightAt } from 'artshape-render/game/waves';
import { describe, expect, it } from 'vitest';
import { CLEAR_WAVES } from '../src/water/clear';
import { STILL, surfaceOf } from '../src/water/swell';

describe('the water where it stands', () => {
  it('is the height the renderer draws its swells at, under the world’s own gravity', () => {
    const surface = surfaceOf(CLEAR_WAVES, 100);
    for (const [x, y, t] of [
      [0, 0, 0],
      [3.5, -12, 7.25],
      [-20, 9, 120],
    ])
      expect(surface(x, y, t)).toBe(heightAt(CLEAR_WAVES, x, y, t, GRAVITY_MM / 100));
    // and it moves: the same place is not the same height a moment on
    expect(surface(1, 1, 0)).not.toBeCloseTo(surface(1, 1, 0.5), 3);
  });

  it('is the still water’s nought where there are no swells', () => {
    expect(surfaceOf(undefined, 100)).toBe(STILL);
    expect(surfaceOf([], 100)).toBe(STILL);
    expect(STILL(4, 5, 6)).toBe(0);
  });
});
