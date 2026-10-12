/** The lake's shape, as content: its shore, its bed and its banks, and the sums the rest are built on. */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  BANK_TOP,
  BANK_RISE,
  BOULDERS,
  CLIFF,
  NOTCHES,
  STRETCH,
  channel,
  cliffRise,
  onFace,
  onFall,
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
    // east, away from the cliff on the north bank
    const e = shoreRadius(0) * STRETCH;
    expect(ground(e * 3, 0)).toBeLessThanOrEqual(BANK_TOP + 1e-9);
    // the ground has no step anywhere along a line out from the middle
    let was = ground(0, 0);
    for (let k = 1; k <= 300; k++) {
      const z = ground((k / 300) * e * 3, 0);
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

/** The ground point `k` shore radii out at an angle round from east, in the lake's own stretched frame. */
const at = (k: number, angle: number): [number, number] => {
  const r = k * shoreRadius(angle);
  return [Math.cos(angle) * r * STRETCH, Math.sin(angle) * r];
};
const angleOf = (x: number, y: number) => Math.atan2(y, x / STRETCH);

describe('the cliff behind the north bank', () => {
  it('leaves the shore and everything in it, and every bank outside its sector, exactly as the lake was', () => {
    const zs: number[] = [];
    for (let x = -120; x <= 120; x += 2.5)
      for (let y = -100; y <= 100; y += 2.5)
        if (inShore(x, y) || Math.abs(angleOf(x, y) - CLIFF.middle) > CLIFF.half) zs.push(groundUnder(x, y));
    expect(zs).toHaveLength(6104);
    // taken from the lake as it was before the cliff (sha256 of the JSON of every height on the grid)
    expect(createHash('sha256').update(JSON.stringify(zs)).digest('hex')).toBe(
      '89704b4e690e201e74f72b486c55b05fc43f505aee7beb71bbaff01239d68c09',
    );
  });

  it('stands the plateau its height over the bank, behind the wall, in the middle of the sector', () => {
    const [x, y] = at(1.3, CLIFF.middle);
    expect(cliffRise(x, y)).toBeCloseTo(CLIFF.height, 6);
    expect(groundUnder(x, y)).toBeGreaterThan(CLIFF.height);
    expect(ground(x, y)).toBe(groundUnder(x, y));
    // the plateau goes on behind
    for (const k of [1.6, 2.2, 3.3]) expect(cliffRise(...at(k, CLIFF.middle))).toBeCloseTo(CLIFF.height, 6);
  });

  it('rises from the foot to the top, steeply, and not at all before the foot', () => {
    let was = 0;
    for (let i = 0; i <= 100; i++) {
      const k = 1 + (i / 100) * 0.4;
      const rise = cliffRise(...at(k, CLIFF.middle));
      if (k <= CLIFF.foot) expect(rise, `at ${k}`).toBe(0);
      expect(rise, `at ${k}`).toBeGreaterThanOrEqual(was - 1e-12);
      was = rise;
    }
    // the wall is steeper than the rock slope somewhere, so it has a face
    expect(onFace(...at((CLIFF.foot + CLIFF.top) / 2, CLIFF.middle))).toBe(true);
  });

  it('dips the crest at each notch to a share of itself, over the notch’s width, and only there', () => {
    expect(NOTCHES).toHaveLength(2);
    for (const n of NOTCHES) {
      // walk out from the shore along the notch's line to its lip, just past where the wall tops out
      let k = 1,
        px = n.x,
        py = n.y;
      for (let s = 0; s < 1000 && k < CLIFF.top + 0.01; s++) {
        px = n.x - n.inward[0] * s * 0.05;
        py = n.y - n.inward[1] * s * 0.05;
        k = 1 - inwardOf(px, py);
      }
      expect(channel(px, py), 'in the middle of the notch').toBeCloseTo(1, 6);
      expect(cliffRise(px, py)).toBeCloseTo(CLIFF.height * CLIFF.dip, 0);
      // a notch's width to the side, the crest is whole again
      const side = [
        px - n.inward[0] * 6 + n.along[0] * n.width * 1.3,
        py - n.inward[1] * 6 + n.along[1] * n.width * 1.3,
      ];
      expect(cliffRise(side[0], side[1])).toBeGreaterThan(CLIFF.height * 0.95);
      // and far back in the plateau it is whole too
      const back = [px - n.inward[0] * 30, py - n.inward[1] * 30];
      expect(cliffRise(back[0], back[1])).toBeCloseTo(CLIFF.height, 3);
    }
  });

  it('blends into the banks at its ends: the rise falls monotonically from the middle out to nothing', () => {
    for (const side of [1, -1]) {
      let was = Infinity;
      for (let i = 0; i <= 200; i++) {
        const d = CLIFF.half * 0.5 + (i / 200) * (CLIFF.half * 0.7);
        const rise = cliffRise(...at(2, CLIFF.middle + side * d));
        expect(rise, `at ${d}`).toBeLessThanOrEqual(was + 1e-9);
        was = rise;
      }
      expect(was).toBe(0);
    }
    // the soft edge is the content’s: whole inside it, nothing outside the half-width
    expect(cliffRise(...at(2, CLIFF.middle + CLIFF.half - CLIFF.edge - 0.01))).toBeCloseTo(CLIFF.height, 6);
    expect(cliffRise(...at(2, CLIFF.middle + CLIFF.half + 0.01))).toBe(0);
  });

  it('has no step in the ground along any line out from the middle (the wall is steep, never a cliff edge)', () => {
    for (const angle of [CLIFF.middle - 0.5, CLIFF.middle, CLIFF.middle + 0.1, CLIFF.middle + 0.62]) {
      let was = ground(...at(0.9, angle));
      for (let i = 1; i <= 600; i++) {
        const z = ground(...at(0.9 + (i / 600) * 2, angle));
        expect(Math.abs(z - was), `at ${angle} step ${i}`).toBeLessThan(0.6);
        was = z;
      }
    }
  });

  it('calls steep what is steeper than the rock slope, and the bank, the plateau and the water not', () => {
    for (const p of [at(0.5, CLIFF.middle), at(1.5, CLIFF.middle), at(2.5, 0), at(1.5, -1), at(1.01, CLIFF.middle)])
      expect(onFace(...p), `${p.join(',')}`).toBe(false);
    expect(CLIFF.rockSlope).toBeGreaterThan(0.6);
    expect(CLIFF.rockSlope).toBeLessThan(1.2);
  });

  it('calls a fall’s channel the water’s own place: its width from the foot to the lip’s back, and no more', () => {
    for (const n of NOTCHES) {
      const on = (s: number, side = 0) => {
        const x = n.x - n.inward[0] * s + n.along[0] * side,
          y = n.y - n.inward[1] * s + n.along[1] * side;
        return [x, y] as const;
      };
      // k = 1.15 is on the wall, k = 1.3 behind the lip, k = 1.7 well back, and k below the foot is the ledge
      expect(onFall(...on(6.5)), 'on the wall').toBe(true);
      expect(onFall(...on(9.5)), 'behind the lip').toBe(true);
      expect(onFall(...on(15)), 'well back').toBe(false);
      expect(onFall(...on(0.2)), 'at the water').toBe(false);
      expect(onFall(...on(9.5, n.width)), 'beside the channel').toBe(false);
    }
  });

  it('keeps the old bank on top of the plateau', () => {
    const [ax, ay] = at(1.5, CLIFF.middle);
    const [bx, by] = at(3.5, CLIFF.middle);
    const bank = (x: number, y: number) => groundUnder(x, y) - cliffRise(x, y);
    expect(bank(bx, by)).toBeGreaterThan(bank(ax, ay));
    expect(bank(bx, by)).toBeLessThanOrEqual(BANK_TOP);
    void BANK_RISE;
  });
});

/** How far in a point is, as the lake counts it; here so the test needs no more of the lake than it exports. */
function inwardOf(x: number, y: number): number {
  return 1 - Math.hypot(x / STRETCH, y) / shoreRadius(angleOf(x, y));
}
