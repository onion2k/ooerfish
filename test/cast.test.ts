/** The cast: its flight as a sum, and the lure through its states, headless. */
import { describe, expect, it } from 'vitest';
import { aimAt, flight, flightAt, pathPoints, rodTip } from '../src/cast';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { HOME } from '../src/lakes';
import { CAST } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, settle } from './helpers';

const BOULDERS = HOME.boulders;
const bedDepth = HOME.bedDepth;
const boulderGap = HOME.boulderGap;
const ground = HOME.ground;
const inside = HOME.inside;

const NORTH = Math.PI / 2;

function lake(seed = 1) {
  const told: string[] = [];
  const game = new Game(new Progress(memoryStore()), {
    random: seeded(seed),
    events: { splashed: (x, y, size) => told.push(`${x.toFixed(1)},${y.toFixed(1)} ${size}`) },
  });
  return { game, told };
}

describe('the flight of a cast', () => {
  it('starts at the rod tip and lands where its path first meets the water or the bank', () => {
    const tip = rodTip();
    const at = new Float64Array(3);
    flightAt(NORTH, 0.6, 0, at);
    expect([...at]).toEqual(tip);
    const f = flight(NORTH, 0.6);
    expect(f.time).toBeGreaterThan(0);
    flightAt(NORTH, 0.6, f.time, at);
    for (let k = 0; k < 3; k++) expect(at[k]).toBeCloseTo(f.landing[k], 4);
    expect(f.onWater).toBe(inside(f.landing[0], f.landing[1]));
    // on the water it lands on the surface; and nowhere along the way is it under what it lands on
    expect(f.landing[2]).toBeCloseTo(f.onWater ? 0 : ground(f.landing[0], f.landing[1]), 3);
    for (let k = 1; k < 40; k++) {
      flightAt(NORTH, 0.6, (f.time * k) / 40, at);
      const under = inside(at[0], at[1]) ? 0 : ground(at[0], at[1]);
      expect(at[2], `at ${k}/40 of the way`).toBeGreaterThan(under - 1e-6);
    }
  });

  it('reaches further the harder it is cast, up to its full reach', () => {
    const reach = (p: number) => {
      const f = flight(NORTH, p);
      return Math.hypot(f.landing[0] - rodTip()[0], f.landing[1] - rodTip()[1]);
    };
    let was = 0;
    for (const p of [0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      expect(reach(p), `power ${p}`).toBeGreaterThan(was);
      was = reach(p);
    }
    expect(reach(1)).toBeGreaterThan(HOME.castReach - 3);
    expect(reach(1)).toBeLessThan(HOME.castReach + 3);
  });

  it('lands on the bank when cast back over it, and on the water when cast across the pond', () => {
    expect(flight(NORTH, 0.6).onWater).toBe(true);
    expect(flight(-NORTH, 0.6).onWater, 'cast back over the angler').toBe(false);
  });

  it("has a preview whose last point is the cast's own landing, to the bit", () => {
    const out = new Float64Array(24 * 3);
    for (const [a, p] of [
      [NORTH, 0.5],
      [NORTH + 0.4, 0.9],
      [-NORTH, 0.3],
    ]) {
      pathPoints(a, p, 24, out);
      const f = flight(a, p);
      expect([out[69], out[70], out[71]]).toEqual([...f.landing]);
    }
  });
});

describe('the lure', () => {
  it('flies, lands on the water with a small splash, sinks under its bobber, and stops at the line', () => {
    const { game, told } = lake();
    expect(game.lure.phase).toBe('ready');
    expect(game.cast(NORTH, 0.6)).toBe(true);
    expect(game.lure.phase).toBe('flying');
    const f = flight(NORTH, 0.6);
    for (let k = 0; k < Math.ceil(f.time / DT) + 2; k++) game.step(DT);
    expect(game.lure.phase).toBe('sinking');
    expect(told.length, 'one splash').toBe(1);
    expect(told[0]).toMatch(/ 0\.\d+$/);
    expect(game.lure.bobber[0]).toBeCloseTo(f.landing[0], 6);
    // it sinks at its rate, then stops at the line's depth or just over the bed
    const stop = Math.min(CAST.lineDepth, bedDepth(f.landing[0], f.landing[1]) - CAST.aboveBed);
    settle(game, 60);
    expect(game.lure.depth).toBeCloseTo(Math.min(stop, CAST.sink * (1 + DT)), 1);
    settle(game, 60 * 20);
    expect(game.lure.depth).toBeCloseTo(stop, 6);
    expect(game.lure.sunk).toBeGreaterThan(19);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('lies on the bank with no splash when cast there, until it is reeled in', () => {
    const { game, told } = lake();
    game.cast(-NORTH, 0.6);
    settle(game, 240);
    expect(game.lure.phase).toBe('lying');
    expect(told).toEqual([]);
    expect(checkInvariants(game)).toEqual([]);
    game.reelIn();
    expect(game.lure.phase).toBe('ready');
  });

  it('lies on a boulder when cast onto one, as on the bank, at its top and with no splash', () => {
    // the aim that lands nearest the middle of the boulder in the shallows, found from the flight's own sums
    const b = BOULDERS[1];
    let best = { angle: 0, power: 0, gap: Infinity };
    for (let a = 0; a < 200; a++)
      for (let p = 1; p <= 40; p++) {
        const angle = (a / 200) * Math.PI * 2,
          power = p / 40;
        const f = flight(angle, power);
        const gap = Math.hypot(f.landing[0] - b.x, f.landing[1] - b.y);
        if (gap < best.gap) best = { angle, power, gap };
      }
    const f = flight(best.angle, best.power);
    expect(boulderGap(f.landing[0], f.landing[1]), 'it lands on the boulder').toBeLessThan(0);
    expect(f.onWater).toBe(false);
    expect(f.landing[2]).toBeCloseTo(ground(f.landing[0], f.landing[1]), 3);
    expect(f.landing[2], 'on it, out of the water').toBeGreaterThan(0);
    const { game, told } = lake();
    game.cast(best.angle, best.power);
    settle(game, 240);
    expect(game.lure.phase).toBe('lying');
    expect(told).toEqual([]);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is reeled in first when cast again while it is out', () => {
    const { game } = lake();
    game.cast(NORTH, 0.4);
    settle(game, 30);
    expect(game.cast(NORTH + 0.3, 0.8)).toBe(true);
    expect(game.lure.phase).toBe('flying');
    expect(game.lure.angle).toBeCloseTo(NORTH + 0.3, 10);
  });

  it('refuses a cast of no number, and holds a power past full to full', () => {
    const { game } = lake();
    expect(game.cast(Number.NaN, 0.5)).toBe(false);
    expect(game.cast(NORTH, Number.POSITIVE_INFINITY)).toBe(false);
    expect(game.lure.phase).toBe('ready');
    expect(game.cast(NORTH, 7)).toBe(true);
    expect(game.lure.power).toBe(1);
  });

  it('is held to what must always hold', () => {
    const { game } = lake();
    game.cast(NORTH, 0.6);
    settle(game, 300);
    game.lure.depth = 500;
    expect(checkInvariants(game).join('\n')).toMatch(/the lure is under the bed/);
    game.lure.depth = 1;
    game.lure.phase = 'swimming' as never;
    expect(checkInvariants(game).join('\n')).toMatch(/the lure is swimming/);
  });
});

describe('aimAt', () => {
  it('throws a cast that lands where it is aimed, on the water, from near to far', () => {
    for (const [x, y] of [
      [0, -10],
      [4, 0],
      [-6, 10],
      [0, 8],
    ] as const) {
      const { angle, power } = aimAt(x, y);
      const f = flight(angle, power);
      expect(f.onWater, `${x},${y}`).toBe(true);
      expect(Math.hypot(f.landing[0] - x, f.landing[1] - y), `${x},${y}`).toBeLessThan(0.05);
    }
  });

  it('is the same twice, and full power for a point past the reach', () => {
    expect(aimAt(3, 4)).toEqual(aimAt(3, 4));
    expect(aimAt(0, 500).power).toBeGreaterThan(0.999);
  });
});
