/** The cast: its flight as a sum, and the lure through its states, headless. */
import { describe, expect, it } from 'vitest';
import { aimAt, bentTip, flight, flightAt, landingTime, pathPoints, rodTip } from '../src/cast';
import { anglerAboard, newBoat } from '../src/boat';
import { Lure } from '../src/lure';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { HOME } from '../src/lakes';
import { CAST, WEATHER } from '../src/lake';
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

describe('the wind on a cast', () => {
  const PUSH: readonly [number, number] = [
    WEATHER.wind.push * WEATHER.wind.direction[0],
    WEATHER.wind.push * WEATHER.wind.direction[1],
  ];
  const ANGLES = [0, 0.4, 1, NORTH, 2, 3, 4.5, 6];
  const POWERS = [0.1, 0.35, 0.6, 0.85, 1];

  it('is unchanged to the bit with no wind, over a grid of angles and powers', () => {
    const a = new Float64Array(3),
      b = new Float64Array(3);
    for (const angle of ANGLES)
      for (const power of POWERS) {
        for (const t of [0, 0.2, 0.5, 0.8]) {
          flightAt(angle, power, t, a);
          flightAt(angle, power, t, b, HOME, [0, 0]);
          expect(Array.from(b)).toEqual(Array.from(a));
        }
        expect(flight(angle, power, HOME, [0, 0])).toEqual(flight(angle, power));
      }
  });

  it('lands downwind of the same cast without it, a few units off at full power', () => {
    const calm = flight(NORTH, 1, HOME),
      blown = flight(NORTH, 1, HOME, PUSH);
    const along =
      (blown.landing[0] - calm.landing[0]) * WEATHER.wind.direction[0] +
      (blown.landing[1] - calm.landing[1]) * WEATHER.wind.direction[1];
    expect(along).toBeGreaterThan(3);
    expect(along).toBeLessThan(5);
  });

  it('has a preview whose last point is the landing', () => {
    const out = new Float64Array(24 * 3);
    for (const angle of ANGLES)
      for (const power of [0.3, 0.7, 1]) {
        pathPoints(angle, power, 24, out, HOME, PUSH);
        const f = flight(angle, power, HOME, PUSH);
        expect(out[69]).toBeCloseTo(f.landing[0], 9);
        expect(out[70]).toBeCloseTo(f.landing[1], 9);
        expect(out[71]).toBeCloseTo(f.landing[2], 9);
      }
  });

  it('is aimed at within 0.05 of the point, and as it was with no wind', () => {
    for (const [x, y] of [
      [0, -10],
      [4, 0],
      [-6, 10],
      [0, 8],
      [8, 6],
      [-9, 2],
    ] as const) {
      const { angle, power } = aimAt(x, y, HOME, PUSH);
      const f = flight(angle, power, HOME, PUSH);
      expect(f.onWater, `${x},${y}`).toBe(true);
      expect(Math.hypot(f.landing[0] - x, f.landing[1] - y), `${x},${y}`).toBeLessThan(0.05);
      expect(aimAt(x, y, HOME, [0, 0])).toEqual(aimAt(x, y));
    }
  });
});

describe('a cast from the boat’s seat (`docs/boat.md`, C2)', () => {
  const boat = { ...newBoat(HOME), x: 4, y: -6, heading: 0.9, aboard: true };
  const seat = anglerAboard(boat);

  it('has its tip over the seat on the water, ahead along the heading, and the shore’s as it was', () => {
    const tip = rodTip(HOME, seat);
    expect(tip[0]).toBeCloseTo(seat.x + Math.cos(0.9) * seat.tipReach, 12);
    expect(tip[1]).toBeCloseTo(seat.y + Math.sin(0.9) * seat.tipReach, 12);
    // over the seat’s height on the water, and not over the bed under it
    expect(tip[2]).toBeCloseTo(seat.base! + seat.tipHeight, 12);
    expect(tip[2]).toBeGreaterThan(0);
    // the shore's angler, given or not, is the very same sums
    expect(rodTip(HOME, HOME.angler)).toEqual(rodTip(HOME));
    const a = HOME.angler;
    expect(rodTip(HOME)).toEqual([a.x, a.y + a.tipReach, HOME.ground(a.x, a.y) + a.tipHeight]);
  });

  it('starts at that tip and lands where its path first meets the water, from the seat', () => {
    const at = new Float64Array(3);
    flightAt(NORTH, 0.6, 0, at, HOME, [0, 0], seat);
    expect([...at]).toEqual(rodTip(HOME, seat));
    const f = flight(NORTH, 0.6, HOME, [0, 0], seat);
    expect(f.onWater).toBe(true);
    expect(f.landing[1]).toBeGreaterThan(seat.y);
    expect(f.landing[0]).toBeCloseTo(rodTip(HOME, seat)[0], 6);
    expect(f.time).toBe(landingTime(NORTH, 0.6, HOME, [0, 0], seat));
    // from the shore's tip it is another flight altogether
    expect(f.landing).not.toEqual(flight(NORTH, 0.6).landing);
  });

  it('is thrown the full speed its own tip’s height gives, which reaches the lake’s reach over flat water', () => {
    const f = flight(Math.PI, 1, HOME, [0, 0], { ...seat, heading: Math.PI });
    const tip = rodTip(HOME, { ...seat, heading: Math.PI });
    expect(Math.hypot(f.landing[0] - tip[0], f.landing[1] - tip[1])).toBeCloseTo(HOME.castReach, 3);
  });

  it('the preview is the flight, the aim lands on its target, and the bent tip bends from the seat', () => {
    const out = new Float64Array(3 * 8);
    pathPoints(NORTH, 0.5, 8, out, HOME, [0, 0], seat);
    const f = flight(NORTH, 0.5, HOME, [0, 0], seat);
    expect([out[21], out[22], out[23]]).toEqual(f.landing);
    expect([out[0], out[1], out[2]]).toEqual(rodTip(HOME, seat));
    const { angle, power } = aimAt(10, 8, HOME, [0, 0], seat);
    const landed = flight(angle, power, HOME, [0, 0], seat);
    expect(Math.hypot(landed.landing[0] - 10, landed.landing[1] - 8)).toBeLessThan(0.05);
    const bent = bentTip(HOME, 0, [20, 20, 0], [0, 0, 0], seat);
    expect([...bent]).toEqual(rodTip(HOME, seat));
  });

  it('is kept by the lure, so a boat that moves after the cast moves nothing of the flight', () => {
    const lure = new Lure(HOME);
    const mover = { ...seat };
    lure.cast(NORTH, 0.5, 0, [0, 0], mover);
    const first = [...lure.at];
    mover.x += 30;
    mover.y += 30;
    lure.step(0, 0.01);
    const want = new Float64Array(3);
    flightAt(NORTH, 0.5, 0, want, HOME, [0, 0], seat);
    expect(first).toEqual([...want]);
    expect([...lure.at]).toEqual([...want]);
    lure.step(lure.flies / 2, 0.01);
    flightAt(NORTH, 0.5, lure.flies / 2, want, HOME, [0, 0], seat);
    expect([...lure.at]).toEqual([...want]);
  });
});
