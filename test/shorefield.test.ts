/** The lake's shore field: how far each point of the water is from the shore or a boulder, for the foam's lines. */
import { describe, expect, it } from 'vitest';
import { BOULDERS, STRETCH, inside, shoreRadius } from '../src/lake';
import { SHORE_FIELD_SIZE, distanceTransform, shoreField } from '../src/shorefield';
import { seeded } from '../src/random';

/** The distance to the nearest land, worked out by hand: the closest of many points along the shore and round each boulder. */
function byHand(x: number, y: number): number {
  let best = Infinity;
  for (let k = 0; k < 4000; k++) {
    const a = (k / 4000) * Math.PI * 2,
      r = shoreRadius(a);
    best = Math.min(best, Math.hypot(Math.cos(a) * r * STRETCH - x, Math.sin(a) * r - y));
  }
  for (const b of BOULDERS) best = Math.min(best, Math.hypot(x - b.x, y - b.y) - b.radius);
  return best;
}

describe('the shore field', () => {
  it('is a distance transform that gives the distance to the nearest marked texel, at any spacing', () => {
    // one marked texel in a seven by five grid, a texel 2 wide and 1 tall
    const marked = new Uint8Array(35);
    marked[2 * 7 + 3] = 1;
    const d = distanceTransform(marked, 7, 5, 2, 1);
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 7; i++) expect(d[j * 7 + i], `${i},${j}`).toBeCloseTo(Math.hypot((i - 3) * 2, j - 2), 9);
  });

  it('covers the lake, its texels the distance to the shore or a boulder within one texel, and nought on land', () => {
    const f = shoreField();
    expect(f.size).toBe(SHORE_FIELD_SIZE);
    expect(f.distances.length).toBe(f.size * f.size);
    const tx = (f.max[0] - f.min[0]) / f.size,
      ty = (f.max[1] - f.min[1]) / f.size,
      texel = Math.hypot(tx, ty);
    // the whole of the water is in it
    for (let k = 0; k < 360; k++) {
      const a = (k / 360) * Math.PI * 2,
        r = shoreRadius(a);
      expect(Math.abs(Math.cos(a) * r * STRETCH)).toBeLessThan(f.max[0]);
      expect(Math.abs(Math.sin(a) * r)).toBeLessThan(f.max[1]);
    }
    const random = seeded(5);
    let water = 0;
    for (let n = 0; n < 400; n++) {
      const i = Math.floor(random() * f.size),
        j = Math.floor(random() * f.size);
      const x = f.min[0] + (i + 0.5) * tx,
        y = f.min[1] + (j + 0.5) * ty;
      const d = f.distances[j * f.size + i];
      if (!inside(x, y)) {
        expect(d, `land at ${x.toFixed(1)},${y.toFixed(1)}`).toBe(0);
        continue;
      }
      water++;
      expect(Math.abs(d - byHand(x, y)), `water at ${x.toFixed(1)},${y.toFixed(1)}`).toBeLessThanOrEqual(texel);
    }
    expect(water, 'water texels checked').toBeGreaterThan(100);
  });

  it('rings each boulder: nought at it, and its radius-and-a-unit out a unit or less', () => {
    const f = shoreField();
    const at = (x: number, y: number) => {
      const i = Math.floor(((x - f.min[0]) / (f.max[0] - f.min[0])) * f.size),
        j = Math.floor(((y - f.min[1]) / (f.max[1] - f.min[1])) * f.size);
      return f.distances[j * f.size + i];
    };
    for (const b of BOULDERS) {
      expect(at(b.x, b.y)).toBe(0);
      expect(at(b.x, b.y + b.radius + 1)).toBeLessThan(1.5);
    }
  });
});
