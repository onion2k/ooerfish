import { describe, expect, it } from 'vitest';
import { reedBed, snagGroups } from '../src/snagdraw';
import { HOME, LAKES } from '../src/lakes';
import { PALETTE } from '../src/palette';
import { WATER_LEVEL } from '../src/rules';

const triangles = (m: { indices: ArrayLike<number> }) => m.indices.length / 3;
const points = (m: { positions: ArrayLike<number> }) =>
  Array.from({ length: m.positions.length / 3 }, (_, i) => [
    m.positions[i * 3],
    m.positions[i * 3 + 1],
    m.positions[i * 3 + 2],
  ]);

describe('the reed beds as they are drawn', () => {
  for (const lake of Object.values(LAKES)) {
    lake.snags.forEach((snag, i) => {
      const name = `${lake.id} bed ${i}`;
      it(`${name} is built the same each time`, () => {
        const a = reedBed(lake, i),
          b = reedBed(lake, i);
        expect(Array.from(a.stems.positions)).toEqual(Array.from(b.stems.positions));
        expect(Array.from(a.heads.positions)).toEqual(Array.from(b.heads.positions));
        expect(Array.from(a.stems.indices)).toEqual(Array.from(b.stems.indices));
      });

      it(`${name} is under 800 triangles, with eight seed heads`, () => {
        const bed = reedBed(lake, i);
        expect(triangles(bed.stems) + triangles(bed.heads)).toBeLessThan(800);
        expect(triangles(bed.heads)).toBeGreaterThan(0);
      });

      it(`${name} stands from the bed under it to the water plus its height, within its radius`, () => {
        const bed = reedBed(lake, i);
        for (const m of [bed.stems, bed.heads])
          for (const [x, y, z] of points(m)) {
            expect(Math.hypot(x - snag.x, y - snag.y)).toBeLessThanOrEqual(snag.radius + 0.3);
            expect(z).toBeLessThanOrEqual(WATER_LEVEL + snag.height + 1e-6);
            expect(z).toBeGreaterThanOrEqual(lake.groundUnder(x, y) - 0.3);
          }
        // some of it breaks the water, and the tallest stands most of the height over it
        const top = Math.max(...points(bed.stems).map((p) => p[2]));
        expect(top).toBeGreaterThan(WATER_LEVEL + snag.height * 0.5);
      });
    });
  }

  it('is two static groups a lake, the stems and the heads, in the reeds’ colours', () => {
    const pond = HOME;
    const groups = snagGroups(PALETTE, pond);
    expect(groups).toHaveLength(2);
    expect(groups[0].albedo).toEqual(PALETTE.reed);
    expect(groups[1].albedo).toEqual(PALETTE.reedHead);
  });
});
