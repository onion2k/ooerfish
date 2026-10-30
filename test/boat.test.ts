/** The boat as sums (`docs/boat.md`, C2): where each lake moors it, which rows it can make, and where it puts the angler. */
import { describe, expect, it } from 'vitest';
import { anglerAboard, landingAboard, newBoat, rowAt, rowDuration, rowPath, seatOf, type BoatState } from '../src/boat';
import { BOAT } from '../src/lake';
import { snagGap } from '../src/snags';
import { HOME } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
import type { Lake } from '../src/lakes/lake';

const LAKES = [HOME, RESERVOIR];
const boatOf = (lake: Lake) => lake.boat!;

/** A boat in the middle of a row from (0, 0) to (30, 40), begun at game time 10. */
function rowing(): BoatState {
  return {
    ...newBoat(HOME),
    x: 0,
    y: 0,
    heading: Math.atan2(40, 30),
    aboard: true,
    rowing: true,
    fromX: 0,
    fromY: 0,
    toX: 30,
    toY: 40,
    rowedAt: 10,
  };
}

describe('the boat’s figures', () => {
  it('are the doc’s first guesses', () => {
    expect(BOAT.speed).toBe(6);
    expect(BOAT.keepOff).toBe(3);
    expect(BOAT.hull).toEqual({ length: 4.2, width: 1.7, freeboard: 0.5, seat: { up: 0.35, aft: 0.8 } });
    expect(BOAT.tip).toEqual({ height: 3.6, reach: 2.4 });
    expect(BOAT.landAt).toBe(1.5);
  });
});

describe('where each lake moors it', () => {
  for (const lake of LAKES)
    it(`${lake.id}: the mooring and the spot are on the water by the keep-off, and the spot is a row from the mooring`, () => {
      const { mooring, spot } = boatOf(lake);
      expect(lake.inside(mooring.x, mooring.y, BOAT.keepOff)).toBe(true);
      expect(lake.inside(spot[0], spot[1], BOAT.keepOff)).toBe(true);
      expect(rowPath(lake, mooring.x, mooring.y, spot[0], spot[1])).toBe(true);
      expect(Number.isFinite(mooring.heading)).toBe(true);
    });

  it('the pond: beside the lake end of the jetty, clear of the deck by the keep-off, pointing inward', () => {
    const { mooring } = boatOf(HOME);
    const jetty = HOME.jetty!;
    expect(jetty.gap(mooring.x, mooring.y)).toBeGreaterThan(BOAT.keepOff);
    const end = [
      jetty.deck.x + jetty.deck.inward[0] * jetty.spec.length,
      jetty.deck.y + jetty.deck.inward[1] * jetty.spec.length,
    ];
    expect(Math.hypot(mooring.x - end[0], mooring.y - end[1])).toBeLessThan(BOAT.keepOff + 3);
    expect(Math.cos(mooring.heading)).toBeCloseTo(jetty.deck.inward[0], 9);
    expect(Math.sin(mooring.heading)).toBeCloseTo(jetty.deck.inward[1], 9);
  });

  it('the pond: the spot is two thirds of the way from the angler to the middle', () => {
    const [x, y] = boatOf(HOME).spot;
    expect(x).toBeCloseTo(HOME.angler.x / 3, 9);
    expect(y).toBeCloseTo(HOME.angler.y / 3, 9);
  });

  it('the reservoir: off the beach ahead of the angler by the keep-off and one, pointing north', () => {
    const { mooring, spot } = boatOf(RESERVOIR);
    const south = -RESERVOIR.shoreRadius(-Math.PI / 2);
    expect(mooring.y).toBeCloseTo(south + BOAT.keepOff + 1, 9);
    expect(mooring.y).toBeGreaterThan(RESERVOIR.angler.y);
    expect(mooring.heading).toBe(Math.PI / 2);
    expect(spot[1]).toBeCloseTo(RESERVOIR.angler.y / 3, 9);
  });
});

describe('rowPath', () => {
  for (const lake of LAKES) {
    const { mooring } = boatOf(lake);

    it(`${lake.id}: is true across open water, end included`, () => {
      expect(rowPath(lake, mooring.x, mooring.y, 0, -5)).toBe(true);
      expect(rowPath(lake, 0, -5, 0, -5)).toBe(true);
    });

    it(`${lake.id}: is false to a point within the keep-off of the shore, though the line before it is open`, () => {
      const south = -lake.shoreRadius(-Math.PI / 2);
      expect(lake.inside(0, south + BOAT.keepOff + 0.2, BOAT.keepOff)).toBe(true);
      expect(rowPath(lake, 0, 0, 0, south + BOAT.keepOff + 0.2)).toBe(true);
      expect(rowPath(lake, 0, 0, 0, south + BOAT.keepOff - 0.2)).toBe(false);
      expect(rowPath(lake, 0, 0, 0, south + 1)).toBe(false);
      expect(rowPath(lake, 0, 0, 0, south - 5)).toBe(false);
    });

    it(`${lake.id}: is false across a boulder’s flank, from clear water to clear water`, () => {
      // through the middle of each boulder in eight directions, where both ends are clear of everything
      let tried = 0;
      for (const b of lake.boulders)
        for (let k = 0; k < 8; k++) {
          const [c, s] = [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)];
          const reach = b.radius + BOAT.keepOff + 3;
          const [ax, ay, zx, zy] = [b.x - c * reach, b.y - s * reach, b.x + c * reach, b.y + s * reach];
          if (!lake.inside(ax, ay, BOAT.keepOff) || !lake.inside(zx, zy, BOAT.keepOff)) continue;
          tried++;
          expect(rowPath(lake, ax, ay, zx, zy), `${b.x},${b.y} direction ${k}`).toBe(false);
        }
      expect(tried, 'some line across a boulder has clear ends').toBeGreaterThan(0);
    });

    it(`${lake.id}: is false for what is not a number`, () => {
      expect(rowPath(lake, 0, 0, NaN, 0)).toBe(false);
      expect(rowPath(lake, 0, 0, 0, Infinity)).toBe(false);
      expect(rowPath(lake, NaN, 0, 0, 0)).toBe(false);
    });
  }

  it('the pond: is false across the jetty’s deck, between two points clear of it', () => {
    const { deck } = HOME.jetty!;
    const a = [deck.x + deck.inward[0] * 12 + deck.along[0] * 6, deck.y + deck.inward[1] * 12 + deck.along[1] * 6],
      z = [deck.x + deck.inward[0] * 12 - deck.along[0] * 6, deck.y + deck.inward[1] * 12 - deck.along[1] * 6];
    expect(HOME.inside(a[0], a[1], BOAT.keepOff), 'start is clear').toBe(true);
    expect(HOME.inside(z[0], z[1], BOAT.keepOff), 'end is clear').toBe(true);
    expect(rowPath(HOME, a[0], a[1], z[0], z[1])).toBe(false);
  });
});

describe('rowPath and the reeds (`docs/boat.md`, C4)', () => {
  for (const lake of LAKES) {
    it(`${lake.id}: is false across a bed, from clear water to clear water, and true to its side`, () => {
      let across = 0,
        beside = 0;
      lake.snags.forEach((s, i) => {
        // through the bed's middle from the lake's middle outward and back, ends well clear of it
        for (let k = 0; k < 8; k++) {
          const [c, d] = [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)];
          const reach = s.radius + BOAT.keepOff + 3;
          const [ax, ay, zx, zy] = [s.x - c * reach, s.y - d * reach, s.x + c * reach, s.y + d * reach];
          if (!lake.inside(ax, ay, BOAT.keepOff) || !lake.inside(zx, zy, BOAT.keepOff)) continue;
          if (snagGap(lake, ax, ay) < BOAT.keepOff || snagGap(lake, zx, zy) < BOAT.keepOff) continue;
          across++;
          expect(rowPath(lake, ax, ay, zx, zy), `bed ${i} direction ${k}`).toBe(false);
          // and a line parallel to it that passes the keep-off and a hair clear of the edge is rowable, if the water allows
          const off = s.radius + BOAT.keepOff + 0.3;
          const [px, py] = [-d * off, c * off];
          const [bx, by, ex, ey] = [ax + px, ay + py, zx + px, zy + py];
          if (
            lake.inside(bx, by, BOAT.keepOff) &&
            lake.inside(ex, ey, BOAT.keepOff) &&
            lake.inside(s.x + px, s.y + py, BOAT.keepOff)
          ) {
            beside++;
            expect(rowPath(lake, bx, by, ex, ey), `bed ${i} direction ${k} beside`).toBe(true);
          }
        }
      });
      expect(across, 'some line across a bed has clear ends').toBeGreaterThan(0);
      expect(beside, 'some line beside one is rowable').toBeGreaterThan(0);
    });

    it(`${lake.id}: refuses a line that passes within the keep-off of a bed’s edge, and allows one just outside`, () => {
      const s = lake.snags[0];
      // a line along the x axis past the bed, offset from its middle
      for (const [gap, want] of [
        [BOAT.keepOff - 0.4, false],
        [BOAT.keepOff + 0.4, true],
      ] as const) {
        const y = s.y + s.radius + gap;
        const a: [number, number] = [s.x - 6, y],
          z: [number, number] = [s.x + 6, y];
        if (!lake.inside(a[0], a[1], BOAT.keepOff) || !lake.inside(z[0], z[1], BOAT.keepOff)) continue;
        expect(rowPath(lake, ...a, ...z), `gap ${gap}`).toBe(want);
      }
    });
  }

  it('lets a boat held up against a bed by the post row away from it, and not back into it', () => {
    const lake = HOME;
    const s = lake.snags[2];
    // the post holds the boat's middle a hull's radius from the edge, which is nearer than the keep-off
    const at: [number, number] = [s.x - s.radius - 1.6, s.y];
    expect(snagGap(lake, ...at)).toBeLessThan(BOAT.keepOff);
    expect(rowPath(lake, ...at, at[0], at[1] + 8)).toBe(true);
    expect(rowPath(lake, ...at, at[0] + 4, at[1])).toBe(false);
  });
});

describe('a row', () => {
  it('lasts the distance at the boat’s speed', () => {
    expect(rowDuration([0, 0], [30, 40])).toBeCloseTo(50 / BOAT.speed, 12);
    expect(rowDuration([3, 3], [3, 3])).toBe(0);
  });

  it('is at the start before it began and at the start at its start', () => {
    const out = [9, 9];
    rowAt(rowing(), 5, out);
    expect(out).toEqual([0, 0]);
    rowAt(rowing(), 10, out);
    expect(out).toEqual([0, 0]);
  });

  it('is on the line, at the boat’s speed, in the middle', () => {
    const out = [0, 0];
    const half = 10 + rowDuration([0, 0], [30, 40]) / 2;
    rowAt(rowing(), half, out);
    expect(out[0]).toBeCloseTo(15, 9);
    expect(out[1]).toBeCloseTo(20, 9);
    rowAt(rowing(), 11, out);
    expect(Math.hypot(out[0], out[1])).toBeCloseTo(BOAT.speed, 9);
  });

  it('is exactly at the end at its end and after', () => {
    const out = [0, 0];
    rowAt(rowing(), 10 + rowDuration([0, 0], [30, 40]), out);
    expect(out).toEqual([30, 40]);
    rowAt(rowing(), 1000, out);
    expect(out).toEqual([30, 40]);
  });

  it('of no length is its end at once', () => {
    const state = { ...rowing(), toX: 0, toY: 0 };
    const out = [5, 5];
    rowAt(state, 10, out);
    expect(out).toEqual([0, 0]);
  });
});

describe('the seat and the landing', () => {
  const state: BoatState = { ...newBoat(HOME), x: 10, y: -4, heading: 0, aboard: true };

  it('the seat is aft of the middle along the heading', () => {
    const seat = seatOf(state);
    expect(seat[0]).toBeCloseTo(10 - BOAT.hull.seat.aft, 12);
    expect(seat[1]).toBeCloseTo(-4, 12);
    const north = seatOf({ ...state, heading: Math.PI / 2 });
    expect(north[0]).toBeCloseTo(10, 12);
    expect(north[1]).toBeCloseTo(-4 - BOAT.hull.seat.aft, 12);
  });

  it('the angler aboard stands at the seat with the boat’s tip, held over the seat’s height, facing the heading', () => {
    const at = anglerAboard(state);
    expect([at.x, at.y]).toEqual([...seatOf(state)]);
    expect(at.tipHeight).toBe(BOAT.tip.height);
    expect(at.tipReach).toBe(BOAT.tip.reach);
    expect(at.base).toBeCloseTo(BOAT.hull.seat.up, 12);
    expect(at.heading).toBe(0);
  });

  it('writes the angler into the object it is handed, and hands it back', () => {
    const into = { x: 0, y: 0, tipHeight: 0, tipReach: 0 };
    expect(anglerAboard(state, into)).toBe(into);
    expect(into.tipReach).toBe(BOAT.tip.reach);
  });

  it('the landing is beside the seat by the landing distance, across the heading, clear of the hull', () => {
    for (const heading of [0, 0.7, Math.PI / 2, 3, -2]) {
      const s = { ...state, heading };
      const seat = seatOf(s);
      const land = landingAboard(s);
      expect(Math.hypot(land[0] - seat[0], land[1] - seat[1])).toBeCloseTo(BOAT.landAt, 12);
      const across = (land[0] - seat[0]) * Math.cos(heading) + (land[1] - seat[1]) * Math.sin(heading);
      expect(across, `heading ${heading}`).toBeCloseTo(0, 12);
      expect(BOAT.landAt).toBeGreaterThan(BOAT.hull.width / 2);
    }
  });
});

describe('a boat at rest', () => {
  for (const lake of LAKES)
    it(`${lake.id}: lies at its mooring with nobody aboard`, () => {
      const b = newBoat(lake);
      expect([b.x, b.y, b.heading]).toEqual([
        boatOf(lake).mooring.x,
        boatOf(lake).mooring.y,
        boatOf(lake).mooring.heading,
      ]);
      expect(b.aboard).toBe(false);
      expect(b.rowing).toBe(false);
    });

  for (const lake of LAKES)
    it(`${lake.id}: lies at anchor, the anchor being up only aboard`, () => {
      expect(newBoat(lake).anchored).toBe(true);
    });

  it('a lake with none has one that is ashore', () => {
    expect(newBoat({ ...HOME, boat: null }).aboard).toBe(false);
  });
});
