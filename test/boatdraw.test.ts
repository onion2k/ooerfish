/** The boat as it is drawn (`docs/boat.md`, C2): a hull of painted timber, a thwart, two oars and a winter cover, placed each frame at the boat. */
import { describe, expect, it } from 'vitest';
import { BoatDraw, boatGroups } from '../src/boatdraw';
import { BOAT } from '../src/lake';
import { HOME } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import type { Lake } from '../src/lakes/lake';
import { PALETTE } from '../src/palette';
import { newGame } from './helpers';

/** Where the boat's own point (x, y, z) is carried to by group `g`'s matrix. */
function carried(m: Float32Array, x: number, y: number, z: number): number[] {
  return [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
}

const triangles = (g: { mesh: { indices: ArrayLike<number> } }) => g.mesh.indices.length / 3;

describe('the boat’s groups', () => {
  it('are a hull, a gunwale with the thwart, the oars and the cover, in the palette’s colours, one matrix each', () => {
    const groups = boatGroups(PALETTE, HOME);
    expect(groups).toHaveLength(4);
    expect(groups.map((g) => g.albedo)).toEqual([PALETTE.hull, PALETTE.gunwale, PALETTE.oar, PALETTE.cover]);
    for (const g of groups) expect(g.matrices.length).toBe(16);
  });

  it('are the painted timber of the cabin’s, split so each triangle has its own vertices (the cover is plain canvas)', () => {
    const [hull, gunwale, oars, cover] = boatGroups(PALETTE, HOME);
    for (const g of [hull, gunwale, oars]) {
      expect(g.mesh.indices.length / 3).toBeGreaterThan(0);
      expect(g.mesh.positions.length / 3).toBe(g.mesh.indices.length);
    }
    expect(triangles(cover)).toBeGreaterThan(0);
  });

  it('are built the same each time, the same meshes for the same lake, the same bytes when built afresh', () => {
    const a = boatGroups(PALETTE, HOME),
      b = boatGroups(PALETTE, HOME);
    for (let k = 0; k < a.length; k++) {
      expect(b[k].mesh).toBe(a[k].mesh);
      expect(Array.from(b[k].mesh.positions)).toEqual(Array.from(a[k].mesh.positions));
    }
    // and a second lake’s boat is the same boat
    expect(boatGroups(PALETTE, RESERVOIR)[0].mesh).toBe(a[0].mesh);
  });

  it('are under 400 triangles each and together', () => {
    const groups = boatGroups(PALETTE, HOME);
    for (const g of groups) expect(triangles(g)).toBeLessThan(400);
    expect(groups.reduce((n, g) => n + triangles(g), 0)).toBeLessThan(400);
  });

  it('stand inside the hull’s own length and width, the gunwale at the freeboard and the cover a canvas’s height over it', () => {
    const { length, width, freeboard } = BOAT.hull;
    const groups = boatGroups(PALETTE, HOME);
    for (const g of groups) {
      const p = g.mesh.positions;
      for (let i = 0; i < p.length; i += 3) {
        expect(Math.abs(p[i])).toBeLessThanOrEqual(length / 2 + 1e-4);
        expect(Math.abs(p[i + 1])).toBeLessThanOrEqual(width / 2 + 1e-4);
      }
    }
    const top = (g: (typeof groups)[number]) => {
      let z = -Infinity;
      for (let i = 2; i < g.mesh.positions.length; i += 3) z = Math.max(z, g.mesh.positions[i]);
      return z;
    };
    expect(top(groups[3])).toBeCloseTo(freeboard + BOAT.cover, 4);
    expect(top(groups[0])).toBeGreaterThanOrEqual(freeboard - 1e-6);
  });

  it('are none for a lake with no boat', () => {
    const none: Lake = { ...HOME, boat: null };
    expect(boatGroups(PALETTE, none)).toEqual([]);
    expect(new BoatDraw(none).groups()).toEqual([]);
  });
});

describe('the boat placed', () => {
  it('has its middle at the boat’s x and y and the water’s height there, turned to its heading', () => {
    const { game } = newGame(1);
    const draw = new BoatDraw(HOME);
    game.surface = () => 0.25;
    game.boat.x = 12;
    game.boat.y = -7;
    game.boat.heading = 0.6;
    const drawn = draw.write(game, 0);
    const [hull] = draw.groups();
    expect(drawn).toMatchObject({ x: 12, y: -7, heading: 0.6 });
    const middle = carried(hull.matrices, 0, 0, 0);
    expect(middle[0]).toBeCloseTo(12, 5);
    expect(middle[1]).toBeCloseTo(-7, 5);
    expect(middle[2]).toBeCloseTo(0.25, 5);
    // the bow is ahead along the heading, within the rocking’s small angles
    const bow = carried(hull.matrices, 2, 0, 0);
    expect(Math.atan2(bow[1] - middle[1], bow[0] - middle[0])).toBeCloseTo(0.6, 1);
    expect(Math.hypot(bow[0] - middle[0], bow[1] - middle[1])).toBeGreaterThan(1.9);
  });

  it('sways by the clock and by nothing else: only the roll and the pitch, never the heading, never beyond BOAT.rock', () => {
    const { game } = newGame(1);
    const draw = new BoatDraw(HOME);
    const [hull] = draw.groups();
    let rolled = 0;
    for (let k = 0; k < 40; k++) {
      draw.write(game, k * 0.37);
      // the hull’s up axis leans from straight up by at most the roll and the pitch together
      const up = [hull.matrices[8], hull.matrices[9], hull.matrices[10]];
      expect(Math.hypot(up[0], up[1], up[2])).toBeCloseTo(1, 5);
      const lean = Math.acos(up[2]);
      expect(lean).toBeLessThanOrEqual(BOAT.rock.roll + BOAT.rock.pitch + 1e-6);
      rolled = Math.max(rolled, lean);
    }
    expect(rolled).toBeGreaterThan(0);
  });

  it('writes every part into the same matrices each frame and makes nothing', () => {
    const { game } = newGame(1);
    const draw = new BoatDraw(HOME);
    const before = draw.groups().map((g) => g.matrices);
    const first = draw.write(game, 0);
    const heap = () => process.memoryUsage().heapUsed;
    const was = heap();
    // a typed array made for each of the four parts a frame would be well over a hundred megabytes in this many; boxed
    // numbers the collector has not yet swept are a few, so the bound is the difference between the two
    for (let k = 0; k < 200000; k++) draw.write(game, k / 60);
    expect(heap() - was).toBeLessThan(40_000_000);
    expect(draw.write(game, 1)).toBe(first);
    expect(draw.groups().map((g) => g.matrices)).toEqual(before);
    draw.groups().forEach((g, k) => expect(g.matrices).toBe(before[k]));
  });

  it('is written for a lake with no boat as nothing at all', () => {
    const none: Lake = { ...HOME, boat: null };
    const { game } = newGame(1);
    expect(() => new BoatDraw(none).write(game, 0)).not.toThrow();
  });
});

describe('the winter cover', () => {
  const scale = (draw: BoatDraw) => {
    const m = draw.groups()[3].matrices;
    return Math.hypot(m[0], m[1], m[2]);
  };

  it('is shown only in winter with nobody aboard, and scaled to nothing otherwise', () => {
    const { game } = newGame(1);
    const draw = new BoatDraw(HOME);
    for (const season of ['summer', 'autumn', 'winter', 'spring'] as const)
      for (const aboard of [false, true]) {
        draw.show(season, aboard);
        draw.write(game, 0);
        expect(scale(draw) > 0.5, `${season} ${aboard ? 'aboard' : 'ashore'}`).toBe(season === 'winter' && !aboard);
        expect(draw.shown()).toBe(season === 'winter' && !aboard);
      }
  });

  it('says whether the show was a change, and so when the group is handed over again', () => {
    const draw = new BoatDraw(HOME);
    expect(draw.show('summer', false)).toBe(false);
    expect(draw.show('winter', false)).toBe(true);
    expect(draw.show('winter', false)).toBe(false);
    expect(draw.show('winter', true)).toBe(true);
    expect(draw.show('winter', true)).toBe(false);
    expect(draw.show('autumn', false)).toBe(false);
  });

  it('follows the boat when it is shown, like the hull', () => {
    const { game } = newGame(1);
    const draw = new BoatDraw(HOME);
    draw.show('winter', false);
    draw.write(game, 0);
    const m = draw.groups()[3].matrices;
    expect(m[12]).toBeCloseTo(game.boat.x, 5);
    expect(m[13]).toBeCloseTo(game.boat.y, 5);
  });
});
