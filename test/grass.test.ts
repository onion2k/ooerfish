/**
 * The banks' grass as the renderer is handed it: where it grows, how high the ground is under it, and that the
 * renderer would take it. The blades are never listed (the renderer grows them from the field), so these hold the
 * field to the lake: nothing grows in the water or at the angler's feet, everything dry does, and the ground painted
 * under the blades is the colour they average to. A field that put grass in the water would pass every other test.
 */
import { describe, expect, it, vi } from 'vitest';
import { checkField, grassGround, levels } from 'artshape-render/game/grass';
import { BREEZE, GRASS_OPTIONS, LUSH, bankField } from '../src/grass';
import {
  ANGLER,
  BANK_RISE,
  BANK_TOP,
  CABIN,
  CLIFF,
  NOTCHES,
  SEASONS,
  SHORE_RADIUS,
  STRETCH,
  cabinGap,
  groundUnder,
  inShore,
  jettyGap,
  inside,
  onFace,
  onFall,
  shoreRadius,
} from '../src/lake';
import { PALETTE } from '../src/palette';
import { seasonGrass, seasonPalette } from '../src/season';

const field = bankField();
const cells = Array.from({ length: field.cols * field.rows }, (_, i) => {
  const c = i % field.cols,
    r = Math.floor(i / field.cols);
  const x = field.origin[0] + (c + 0.5) * field.cell,
    y = field.origin[1] + (r + 0.5) * field.cell;
  return { i, x, y, grass: field.mask[i] > 0 };
});
const planted = cells.filter((c) => c.grass);

describe('the banks field', () => {
  it('is one the renderer takes, with the options it is given', () => {
    expect(() => checkField(field, GRASS_OPTIONS)).not.toThrow();
    expect(field.kinds).toEqual([LUSH]);
  });

  it('has grass, and some cells without', () => {
    expect(planted.length).toBeGreaterThan(10_000);
    expect(planted.length).toBeLessThan(cells.length);
  });

  it('grows nothing in the water, any corner of a cell included', () => {
    const h = field.cell / 2;
    for (const c of planted)
      for (const [dx, dy] of [
        [0, 0],
        [-h, -h],
        [h, -h],
        [-h, h],
        [h, h],
      ])
        expect(inside(c.x + dx, c.y + dy, 0), `cell at ${c.x},${c.y}`).toBe(false);
  });

  it("grows nothing at the angler's feet, and the cell they stand on is bare", () => {
    for (const c of planted) expect(Math.hypot(c.x - ANGLER.x, c.y - ANGLER.y)).toBeGreaterThan(4);
    const under = cells.find((c) => Math.hypot(c.x - ANGLER.x, c.y - ANGLER.y) < field.cell);
    expect(under?.grass).toBe(false);
  });

  it('grows on every bank cell above the shore gap that is not at the angler, on the cliff’s face, in a fall’s channel, under the cabin or on the jetty’s shore end, and nowhere else', () => {
    let dry = 0;
    for (const c of cells) {
      const bank =
        !inShore(c.x, c.y, -0.9) &&
        Math.hypot(c.x - ANGLER.x, c.y - ANGLER.y) > 4 &&
        !onFace(c.x, c.y) &&
        !onFall(c.x, c.y) &&
        cabinGap(c.x, c.y) >= CABIN.clear &&
        jettyGap(c.x, c.y) >= CABIN.clear;
      if (bank) dry++;
      expect(c.grass, `cell at ${c.x},${c.y}`).toBe(bank);
    }
    expect(dry).toBe(planted.length);
  });

  it('grows no blade on the cliff’s face, where the ground leans past the rock slope, and some on the plateau above it', () => {
    const at = (k: number, angle: number) => {
      const r = k * shoreRadius(angle);
      return [Math.cos(angle) * r * STRETCH, Math.sin(angle) * r];
    };
    const near = (x: number, y: number) =>
      cells.reduce((best, c) => (Math.hypot(c.x - x, c.y - y) < Math.hypot(best.x - x, best.y - y) ? c : best));
    // down the wall's middle: every cell on the way up is bare while the ground leans past the slope
    let bare = 0;
    for (let i = 0; i <= 60; i++) {
      const [x, y] = at(CLIFF.foot + ((CLIFF.top - CLIFF.foot) * i) / 60, CLIFF.middle + 0.3);
      const c = near(x, y);
      if (onFace(c.x, c.y)) {
        expect(c.grass, `cell at ${c.x},${c.y}`).toBe(false);
        bare++;
      }
    }
    expect(bare, 'the face was reached').toBeGreaterThan(10);
    // and the plateau, level and dry, is grass
    for (const k of [1.4, 1.8, 2.1]) {
      const [x, y] = at(k, CLIFF.middle + 0.1);
      if (y < field.origin[1] + field.rows * field.cell) expect(near(x, y).grass, `at ${k}`).toBe(true);
    }
    expect(planted.some((c) => groundUnder(c.x, c.y) > CLIFF.height)).toBe(true);
    // none of the planted cells leans past the slope
    expect(planted.every((c) => !onFace(c.x, c.y))).toBe(true);
  });

  it('grows no blade in a fall’s channel, at the lip or behind it, and grows right up to its edge', () => {
    const inChannel = cells.filter((c) => onFall(c.x, c.y));
    expect(inChannel.length, 'the channels were reached').toBeGreaterThan(20);
    for (const c of inChannel) expect(c.grass, `cell at ${c.x},${c.y}`).toBe(false);
    for (const n of NOTCHES) {
      // a cell past the channel’s margin, on the plateau behind the lip, is grass
      const x = n.x - n.inward[0] * 15 + n.along[0] * (n.width + 3),
        y = n.y - n.inward[1] * 15 + n.along[1] * (n.width + 3);
      const c = cells.reduce((b, q) => (Math.hypot(q.x - x, q.y - y) < Math.hypot(b.x - x, b.y - y) ? q : b));
      expect(c.grass).toBe(true);
    }
  });

  it('grows no blade under the cabin’s roof or half a unit from its edge, nor on the jetty’s shore end, and grows right up to those', () => {
    const under = cells.filter((c) => cabinGap(c.x, c.y) < CABIN.clear);
    const deck = cells.filter((c) => jettyGap(c.x, c.y) < CABIN.clear && !inShore(c.x, c.y, -0.9));
    expect(under.length, 'cells under the cabin').toBeGreaterThan(100);
    expect(deck.length, 'cells on the shore end of the deck').toBeGreaterThan(0);
    for (const c of [...under, ...deck]) expect(c.grass, `cell at ${c.x},${c.y}`).toBe(false);
    // and the cells just outside the keep-back, on the bank, are grass
    const edge = cells.filter((c) => cabinGap(c.x, c.y) >= CABIN.clear && cabinGap(c.x, c.y) < CABIN.clear + 0.5);
    expect(edge.filter((c) => c.grass).length).toBeGreaterThan(edge.length * 0.8);
  });

  it('keeps a gap at the waterline: a cell just beyond the shore is bare', () => {
    // 0.9 out from the shore is where the grass begins
    expect(cells.some((c) => !c.grass && !inShore(c.x, c.y, 0) && inShore(c.x, c.y, -0.9))).toBe(true);
  });

  it('stands every cell on the ground under it, boulders left out as the banks sheet is drawn', () => {
    for (const c of cells) expect(field.heights[c.i], `cell at ${c.x},${c.y}`).toBe(Math.fround(groundUnder(c.x, c.y)));
  });

  it('reaches out past the banks the sun shades, on every side, and carries on to the horizon at the bank top', () => {
    const halfW = (SHORE_RADIUS * 1.5 + BANK_RISE) * STRETCH,
      halfH = SHORE_RADIUS * 1.5 + BANK_RISE;
    expect(field.origin[0]).toBeLessThanOrEqual(-halfW);
    expect(field.origin[1]).toBeLessThanOrEqual(-halfH);
    expect(field.origin[0] + field.cols * field.cell).toBeGreaterThanOrEqual(halfW);
    expect(field.origin[1] + field.rows * field.cell).toBeGreaterThanOrEqual(halfH);
    expect(field.outside).toEqual({ kind: 0, height: BANK_TOP });
  });

  it('is the same field every time it is made, whatever Math.random says', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('the grass asked Math.random');
    });
    let again;
    try {
      again = bankField();
    } finally {
      random.mockRestore();
    }
    expect(again.seed).toBe(field.seed);
    expect(again.mask).toEqual(field.mask);
    expect(again.heights).toEqual(field.heights);
  });
});

describe("the grass's figures", () => {
  it("are paid for at ooergolf's rings, and rise from near to far", () => {
    const { near, mid, far } = levels(field, GRASS_OPTIONS);
    expect([near, mid, far]).toEqual([36, 110, 300]);
  });

  it('blow a slow breeze across the lake, the long blades giving to it', () => {
    expect(BREEZE).toEqual({ direction: [1, 0.3], strength: 0.3, gustSize: 20, gustSpeed: 4 });
    expect(LUSH.give).toBeGreaterThan(0.5);
  });

  it("have the bank painted the colour the blades average to, as ooergolf holds its ground to its blades' ", () => {
    const ground = grassGround(LUSH);
    for (let c = 0; c < 3; c++) expect(PALETTE.grass[c]).toBeCloseTo(ground[c], 4);
    // and so in every season, whose ground is worked out from its blades (test/season.test.ts holds the rest)
    for (const season of SEASONS) {
      const g = grassGround(seasonGrass(season));
      for (let c = 0; c < 3; c++) expect(seasonPalette(season).grass[c]).toBeCloseTo(g[c], 4);
    }
  });

  it('take their blades colour from the palette', () => {
    expect(LUSH.base).toEqual(PALETTE.bladeBase);
    expect(LUSH.tip).toEqual(PALETTE.bladeTip);
  });
});
