/** The lake's shape, as content: its shore, its bed and its banks, and the sums the rest are built on. */
import { describe, expect, it } from 'vitest';
import {
  BANK_TOP,
  BOULDERS,
  MAX_DEPTH,
  SHORE_POINTS,
  bedDepth,
  boulderGap,
  ground,
  groundUnder,
  inShore,
  inside,
  nearestBoulder,
  shoreRadius,
  VIEWS,
} from '../src/lake';

describe('the lake', () => {
  it('has a shore that closes, and is the same each time it is asked', () => {
    expect(shoreRadius(0)).toBeCloseTo(shoreRadius(Math.PI * 2), 10);
    expect(shoreRadius(1.234)).toBe(shoreRadius(1.234));
    for (let k = 0; k < SHORE_POINTS; k++) {
      const r = shoreRadius((k / SHORE_POINTS) * Math.PI * 2);
      expect(r, `the shore at point ${k}`).toBeGreaterThan(15);
      expect(r).toBeLessThan(50);
    }
  });

  it('knows what is inside it, a margin in from the shore', () => {
    expect(inside(0, 0)).toBe(true);
    expect(inside(200, 0)).toBe(false);
    // due north, where the stretch east and west does not reach, so a distance out is the shore's own
    const r = shoreRadius(Math.PI / 2);
    expect(inside(0, r - 1)).toBe(true);
    expect(inside(0, r - 1, 2), 'a margin of two keeps a point a unit in out').toBe(false);
    expect(inside(0, r + 1)).toBe(false);
  });

  it('is deepest in the middle and shallow at the shore', () => {
    expect(bedDepth(0, 0)).toBeCloseTo(MAX_DEPTH, 1);
    const r = shoreRadius(Math.PI / 2);
    expect(bedDepth(0, r * 0.99)).toBeLessThan(0.3);
    expect(bedDepth(0, r * 0.5)).toBeGreaterThan(bedDepth(0, r * 0.9));
    expect(bedDepth(0, r * 2), 'no depth outside the shore').toBe(0);
  });

  it('meets the water at the shore, and rises to its banks', () => {
    const r = shoreRadius(Math.PI / 2);
    expect(ground(0, 0)).toBeCloseTo(-MAX_DEPTH, 1);
    expect(Math.abs(ground(0, r))).toBeLessThan(0.05);
    expect(ground(0, r * 1.6)).toBeGreaterThan(0.5);
    expect(ground(0, r * 3)).toBeLessThanOrEqual(BANK_TOP + 1e-9);
    // the ground has no step anywhere along a line out from the middle
    let was = ground(0, 0);
    for (let k = 1; k <= 300; k++) {
      const z = ground(0, (k / 300) * r * 3);
      expect(Math.abs(z - was), `a step at ${k}`).toBeLessThan(0.25);
      was = z;
    }
  });

  it('names its views, each looking at somewhere in or by the lake', () => {
    expect(Object.keys(VIEWS)).toEqual(['shore', 'boat', 'overhead', 'phone']);
    for (const [name, v] of Object.entries(VIEWS)) {
      expect(Math.hypot(v.x, v.y), name).toBeLessThan(40);
      expect(v.polar, name).toBeGreaterThan(0);
      expect(v.polar, name).toBeLessThan(Math.PI / 2);
      expect(v.radius, name).toBeGreaterThan(5);
    }
  });

  it('has boulders standing out of the water, each a bit of bank in it', () => {
    expect(BOULDERS.length).toBeGreaterThanOrEqual(3);
    for (const [k, b] of BOULDERS.entries()) {
      // not water within its waterline, and water just beyond it; a margin is counted from it as from the shore
      expect(inside(b.x, b.y), `boulder ${k}'s middle`).toBe(false);
      expect(inside(b.x + b.radius * 0.95, b.y), `boulder ${k} just in from its waterline`).toBe(false);
      const out = b.x - b.radius - 0.2;
      if (inShore(out, b.y)) {
        expect(inside(out, b.y), `boulder ${k} just out from its waterline`).toBe(true);
        expect(inside(out, b.y, 0.5), `boulder ${k}, a margin of half a unit`).toBe(false);
      }
      // a unit out from its waterline is a unit from it, or nearer another boulder; and at its middle it is the nearest
      expect(boulderGap(b.x + b.radius + 1, b.y)).toBeLessThanOrEqual(1 + 1e-9);
      expect(nearestBoulder(b.x, b.y)).toBe(b);
      expect(boulderGap(b.x, b.y)).toBeCloseTo(-b.radius, 9);
      // its top stands its rise out of the water, it meets the water at its waterline, and it is no water there
      expect(ground(b.x, b.y), `boulder ${k}'s top`).toBeCloseTo(b.rise, 6);
      expect(Math.abs(ground(b.x + b.radius, b.y)), `boulder ${k} at its waterline`).toBeLessThan(1e-6);
      expect(bedDepth(b.x, b.y)).toBe(0);
      // under the water its flank raises the bed, shallower than the bowl there, with no step at the waterline
      const flank = b.x + b.radius + 0.05;
      expect(bedDepth(flank, b.y), `boulder ${k}'s flank`).toBeLessThan(-groundUnder(flank, b.y));
      expect(bedDepth(flank, b.y)).toBeGreaterThan(0);
      // and the ground the bed is drawn from knows nothing of it
      expect(groundUnder(b.x, b.y)).toBeLessThan(0);
    }
  });
});
