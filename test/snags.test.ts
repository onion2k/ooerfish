/** The snags as sums (`docs/boat.md`, C4): which bed a point is at, how far from its edge, where a freed lure sinks, and the posts. */
import { describe, expect, it } from 'vitest';
import { SNAG } from '../src/lake';
import { LAKES } from '../src/lakes';
import { DUCK_POND } from '../src/lakes/duckpond';
import { RESERVOIR } from '../src/lakes/reservoir';
import type { Lake } from '../src/lakes/lake';
import { freedPoint, posts, snagGap, snagNear } from '../src/snags';

/** A point `out` from the edge of bed `i` of a lake, along a bearing from its middle. */
function beside(lake: Lake, i: number, out: number, bearing = 0): [number, number] {
  const s = lake.snags[i];
  return [s.x + Math.cos(bearing) * (s.radius + out), s.y + Math.sin(bearing) * (s.radius + out)];
}

describe('the content (`docs/boat.md`, C4)', () => {
  it('has the figures the doc names', () => {
    expect(SNAG).toEqual({
      reach: 0.6,
      tug: 0.8,
      tension: 0.8,
      drop: 0.8,
      notice: 2.5,
      lureReach: 4,
      restitution: 0.1,
    });
    expect(DUCK_POND.snags).toHaveLength(3);
    expect(RESERVOIR.snags).toHaveLength(2);
    for (const s of DUCK_POND.snags) expect(s).toMatchObject({ radius: 1.4, height: 1.6, kind: 'reeds' });
  });
});

describe('snagNear', () => {
  for (const lake of Object.values(LAKES))
    describe(lake.id, () => {
      it('finds the bed a point is within reach of, and none away from every bed', () => {
        lake.snags.forEach((s, i) => {
          expect(snagNear(lake, s.x, s.y, SNAG.reach)).toBe(i);
          expect(snagNear(lake, ...beside(lake, i, SNAG.reach / 2), SNAG.reach)).toBe(i);
          expect(snagNear(lake, ...beside(lake, i, SNAG.reach + 0.05), SNAG.reach)).toBe(-1);
          expect(snagNear(lake, ...beside(lake, i, 3), SNAG.lureReach)).toBe(i);
        });
        expect(snagNear(lake, 0, 0, SNAG.lureReach)).toBe(-1);
      });
    });

  it('picks the nearer of two beds', () => {
    const two = {
      snags: [
        { x: 0, y: 0, radius: 1, height: 1, kind: 'reeds' as const },
        { x: 5, y: 0, radius: 1, height: 1, kind: 'reeds' as const },
      ],
    } as unknown as Lake;
    expect(snagNear(two, 2.2, 0, 3)).toBe(0);
    expect(snagNear(two, 2.8, 0, 3)).toBe(1);
  });

  it('is minus one in a lake with no beds', () => {
    expect(snagNear({ snags: [] } as unknown as Lake, 0, 0, 100)).toBe(-1);
  });
});

describe('snagGap', () => {
  it('is the distance to the nearest edge, negative inside, and infinite with no beds', () => {
    const lake = DUCK_POND;
    const s = lake.snags[0];
    expect(snagGap(lake, s.x + s.radius + 2, s.y)).toBeCloseTo(2, 9);
    expect(snagGap(lake, s.x, s.y)).toBeCloseTo(-s.radius, 9);
    expect(snagGap({ snags: [] } as unknown as Lake, 0, 0)).toBe(Infinity);
  });
});

describe('freedPoint', () => {
  for (const lake of Object.values(LAKES))
    describe(lake.id, () => {
      it('lies `drop` out from the edge along the line from the middle, on the water', () => {
        lake.snags.forEach((_s, i) => {
          for (let k = 0; k < 16; k++) {
            const bearing = (k / 16) * Math.PI * 2;
            const out: [number, number] = [0, 0];
            const [x, y] = beside(lake, i, SNAG.reach / 2, bearing);
            freedPoint(lake, i, x, y, out);
            expect(lake.inside(out[0], out[1], 0.5), `bed ${i} bearing ${k}`).toBe(true);
            expect(Number.isFinite(out[0] + out[1])).toBe(true);
          }
        });
      });

      it('is exactly `drop` from the edge where that point is on the water already', () => {
        lake.snags.forEach((s, i) => {
          const out: [number, number] = [0, 0];
          // toward the lake's middle, which is the way the point would be moved anyway
          const bearing = Math.atan2(-s.y, -s.x);
          const [x, y] = beside(lake, i, SNAG.reach / 2, bearing);
          freedPoint(lake, i, x, y, out);
          expect(Math.hypot(out[0] - s.x, out[1] - s.y) - s.radius).toBeCloseTo(SNAG.drop, 9);
        });
      });
    });

  it('is moved inward in steps until it is on the water', () => {
    const lake = DUCK_POND;
    const out: [number, number] = [0, 0];
    // a bed's far side from the middle, with the point put on the bank side: moved in toward (0, 0)
    const s = lake.snags[0];
    const away = Math.atan2(s.y, s.x);
    freedPoint(lake, 0, s.x + Math.cos(away) * s.radius * 2, s.y + Math.sin(away) * s.radius * 2, out);
    expect(lake.inside(out[0], out[1], 0.5)).toBe(true);
  });

  it('does not divide by nothing for a point at the bed’s middle', () => {
    const out: [number, number] = [0, 0];
    const s = DUCK_POND.snags[1];
    freedPoint(DUCK_POND, 1, s.x, s.y, out);
    expect(Number.isFinite(out[0]) && Number.isFinite(out[1])).toBe(true);
    expect(DUCK_POND.inside(out[0], out[1], 0.5)).toBe(true);
  });
});

describe('posts', () => {
  for (const lake of Object.values(LAKES))
    it(`makes ${lake.id}'s beds the physics' posts, once`, () => {
      const p = posts(lake);
      expect(p).toHaveLength(lake.snags.length);
      p.forEach((b, i) => {
        const s = lake.snags[i];
        expect(b).toEqual({ x: s.x, y: s.y, radius: s.radius, top: s.height, restitution: SNAG.restitution });
      });
      expect(posts(lake)).toBe(p);
    });
});
