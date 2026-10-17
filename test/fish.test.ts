/** The fish of the lab's lake: where they swim, that they stay in the water, and the lake's two levers. */
import { describe, expect, it } from 'vitest';
import { School } from '../src/fish';
import { seeded } from '../src/random';
import { checkInvariants } from '../src/invariants';
import {
  BOULDERS,
  CLOCK,
  FISH_CAPACITY,
  FISH_COUNT,
  JETTY,
  STRETCH,
  bedDepth,
  boulderGap,
  inside,
  jettyGap,
  shoreRadius,
} from '../src/lake';
import { DT, newGame, settle } from './helpers';

describe('the fish', () => {
  it('start in the water, as many as the lake has', () => {
    const { game } = newGame();
    expect(game.fish.count).toBe(FISH_COUNT);
    for (let i = 0; i < game.fish.count; i++) expect(inside(game.fish.x[i], game.fish.y[i])).toBe(true);
  });

  it('swim, and stay in the water between the surface and the bed, for ten minutes of seeds', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game } = newGame(seed);
      const x0 = Array.from(game.fish.x.subarray(0, FISH_COUNT));
      for (let f = 0; f < 36000; f++) {
        game.step(DT);
        if (f % 60) continue;
        for (let i = 0; i < game.fish.count; i++) {
          const { x, y, depth } = { x: game.fish.x[i], y: game.fish.y[i], depth: game.fish.depth[i] };
          expect(inside(x, y), `seed ${seed}, fish ${i} at ${x},${y} at frame ${f}`).toBe(true);
          expect(depth).toBeGreaterThan(0);
          expect(depth).toBeLessThan(bedDepth(x, y));
        }
      }
      for (let i = 0; i < FISH_COUNT; i++)
        expect(Math.abs(game.fish.x[i] - x0[i]), `fish ${i} moved`).toBeGreaterThan(0.01);
    }
  });

  it('never swim out, even headed straight at the shore from close in at full speed, and swim off again', () => {
    const { game } = newGame();
    const north = shoreRadius(Math.PI / 2);
    for (let i = 0; i < game.fish.count; i++) {
      // each a little nearer the shore than a fish would ever choose to be, flat out toward it
      game.fish.x[i] = (i - 2.5) * 1.5;
      game.fish.y[i] = north - 0.8;
      game.fish.heading[i] = Math.PI / 2;
      game.fish.speed[i] = 2.8;
      game.fish.depth[i] = 0.1;
    }
    for (let f = 0; f < 120; f++) {
      game.step(DT);
      for (let i = 0; i < game.fish.count; i++)
        expect(inside(game.fish.x[i], game.fish.y[i]), `fish ${i} at frame ${f}`).toBe(true);
    }
    // and none is stuck there turning about: each has swum off toward the middle
    for (let i = 0; i < game.fish.count; i++) expect(game.fish.y[i], `fish ${i} swam off`).toBeLessThan(north - 1.5);
  });

  it('never swim into a boulder, even headed straight at one from close in at full speed, and swim off again', () => {
    // the boulder out in the shallows, with open water all round it
    const b = BOULDERS[1];
    const { game } = newGame();
    for (let i = 0; i < game.fish.count; i++) {
      // round it, each half a unit off its waterline, flat out at its middle
      const a = (i / game.fish.count) * Math.PI * 2;
      game.fish.x[i] = b.x + Math.cos(a) * (b.radius + 0.6);
      game.fish.y[i] = b.y + Math.sin(a) * (b.radius + 0.6);
      game.fish.heading[i] = a + Math.PI;
      game.fish.speed[i] = 2.8;
      game.fish.depth[i] = 0.1;
    }
    for (let f = 0; f < 120; f++) {
      game.step(DT);
      for (let i = 0; i < game.fish.count; i++)
        expect(inside(game.fish.x[i], game.fish.y[i]), `fish ${i} at frame ${f}`).toBe(true);
    }
    for (let i = 0; i < game.fish.count; i++)
      expect(boulderGap(game.fish.x[i], game.fish.y[i]), `fish ${i} swam off`).toBeGreaterThan(1.2);
  });

  it('never swim under the jetty, even headed straight at its side or its end from close in at full speed, and swim off again', () => {
    // the deck's own frame, worked out afresh: a point `u` along it from its start and `v` across from its middle line
    const r = JETTY.k * shoreRadius(JETTY.angle);
    const sx = Math.cos(JETTY.angle) * r * STRETCH,
      sy = Math.sin(JETTY.angle) * r;
    const l = Math.hypot(sx, sy);
    const ix = -sx / l,
      iy = -sy / l;
    const onDeck = (u: number, v: number): [number, number] => [sx + ix * u - iy * v, sy + iy * u + ix * v];
    const heading = Math.atan2(iy, ix);
    // each starts 0.6 of a unit off an edge, headed in at its middle: from either side, and from beyond the end
    const starts: [number, number, number][] = [
      [...onDeck(5, JETTY.width / 2 + 0.6), heading - Math.PI / 2],
      [...onDeck(9, -(JETTY.width / 2 + 0.6)), heading + Math.PI / 2],
      [...onDeck(JETTY.length + 0.6, 0), heading + Math.PI],
      [...onDeck(7, JETTY.width / 2 + 0.6), heading - Math.PI / 2 + 0.3],
      [...onDeck(11, -(JETTY.width / 2 + 0.6)), heading + Math.PI / 2 - 0.3],
      [...onDeck(JETTY.length + 0.6, 0.5), heading + Math.PI - 0.2],
    ];
    const { game } = newGame();
    // only these six are placed, so only they are swum: the rest of the pond is left out of it
    game.fish.count = starts.length;
    starts.forEach(([x, y, h], i) => {
      game.fish.x[i] = x;
      game.fish.y[i] = y;
      game.fish.heading[i] = h;
      game.fish.speed[i] = 2.8;
      game.fish.depth[i] = 0.1;
    });
    for (let f = 0; f < 120; f++) {
      game.step(DT);
      for (let i = 0; i < game.fish.count; i++) {
        expect(inside(game.fish.x[i], game.fish.y[i]), `fish ${i} at frame ${f}`).toBe(true);
        expect(jettyGap(game.fish.x[i], game.fish.y[i]), `fish ${i} at frame ${f}`).toBeGreaterThan(0);
      }
    }
    for (let i = 0; i < game.fish.count; i++)
      expect(jettyGap(game.fish.x[i], game.fish.y[i]), `fish ${i} swam off`).toBeGreaterThan(1.2);
  });

  it('turn from the jetty before they reach it, and one that has come within half a unit of it comes no nearer', () => {
    const r = JETTY.k * shoreRadius(JETTY.angle);
    const sx = Math.cos(JETTY.angle) * r * STRETCH,
      sy = Math.sin(JETTY.angle) * r;
    const l = Math.hypot(sx, sy);
    const ix = -sx / l,
      iy = -sy / l;
    const onDeck = (u: number, v: number): [number, number] => [sx + ix * u - iy * v, sy + iy * u + ix * v];
    const across = Math.atan2(-ix, iy);
    // a fish whose wander is stilled, headed straight at the deck from a few units off its side, begins to turn from it
    // while still well away, as it does from a boulder, and not only when a step would be refused
    const school = new School();
    school.fill(1, () => 0.5);
    const [fx, fy] = onDeck(8, JETTY.width / 2 + 3.5);
    school.x[0] = fx;
    school.y[0] = fy;
    school.heading[0] = across;
    school.speed[0] = 2.8;
    school.depth[0] = 0.1;
    for (let f = 0; f < 10; f++) school.step(DT, () => 0.5);
    expect(jettyGap(school.x[0], school.y[0]), 'still well away').toBeGreaterThan(2.5);
    const turned = Math.abs(Math.atan2(Math.sin(school.heading[0] - across), Math.cos(school.heading[0] - across)));
    expect(turned, 'the heading has turned from the deck').toBeGreaterThan(0.1);
    // and one already within half a unit, headed straight at it, is never carried nearer
    const near = newGame().game;
    const [x, y] = onDeck(8, JETTY.width / 2 + 0.3);
    near.fish.x[0] = x;
    near.fish.y[0] = y;
    near.fish.heading[0] = across;
    near.fish.speed[0] = 2.8;
    near.fish.depth[0] = 0.1;
    let was = jettyGap(x, y);
    for (let f = 0; f < 30; f++) {
      near.step(DT);
      const gap = jettyGap(near.fish.x[0], near.fish.y[0]);
      expect(gap, `frame ${f}`).toBeGreaterThanOrEqual(Math.min(was, 0.5) - 1e-9);
      was = gap;
    }
  });

  it('go where the seed says, the same twice, and elsewhere from another seed', () => {
    const one = newGame(3).game,
      two = newGame(3).game,
      other = newGame(4).game;
    for (const g of [one, two, other]) settle(g, 600);
    expect(Array.from(two.fish.x)).toEqual(Array.from(one.fish.x));
    expect(Array.from(other.fish.x)).not.toEqual(Array.from(one.fish.x));
  });

  it('can be as many as the pools hold, and no more', () => {
    const { game } = newGame();
    game.fish.fill(FISH_CAPACITY + 10, () => game.random());
    expect(game.fish.count).toBe(FISH_CAPACITY);
    settle(game, 600);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe("the lab's levers", () => {
  it('set the contamination and the time of day, within nought and one, and refuse what is not a number', () => {
    const { game } = newGame();
    expect(game.contamination).toBe(1);
    expect(game.timeOfDay).toBe(CLOCK.startsAt);
    game.setContamination(0.25);
    expect(game.contamination).toBe(0.25);
    game.setContamination(7);
    expect(game.contamination).toBe(1);
    game.setContamination(-3);
    expect(game.contamination).toBe(0);
    game.setContamination(NaN);
    expect(game.contamination).toBe(0);
    game.setTimeOfDay(0.75);
    expect(game.timeOfDay).toBe(0.75);
    game.setTimeOfDay(Infinity);
    expect(game.timeOfDay).toBe(0.75);
    // a clock: one is midnight again, and past it goes round
    game.setTimeOfDay(1);
    expect(game.timeOfDay).toBe(0);
    game.setTimeOfDay(1.25);
    expect(game.timeOfDay).toBeCloseTo(0.25, 10);
    game.setTimeOfDay(-0.25);
    expect(game.timeOfDay).toBeCloseTo(0.75, 10);
    // a hair under midnight rounds up to one in the subtraction, and a day never reaches one
    game.setTimeOfDay(-1e-17);
    expect(game.timeOfDay).toBe(0);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('what must always hold of the fish and the levers', () => {
  it('reports a fish out of the water, one under the bed, and a lever out of its range', () => {
    const { game } = newGame();
    game.fish.x[0] = 500;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 0 is out of the water/);
    game.fish.x[0] = 0;
    game.fish.y[0] = 0;
    game.fish.depth[0] = 100;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 0 is under the bed/);
    game.fish.depth[0] = -1;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 0 is out of the water/);
    game.fish.depth[0] = 1;
    game.fish.x[0] = NaN;
    expect(checkInvariants(game).join('\n')).toMatch(/fish 0 is not a number/);
    game.fish.x[0] = 0;
    game.contamination = 2;
    expect(checkInvariants(game).join('\n')).toMatch(/the contamination is 2/);
    game.contamination = 1;
    game.timeOfDay = -0.5;
    expect(checkInvariants(game).join('\n')).toMatch(/the time of day is -0.5/);
    // a day is [0, 1): one is midnight again, and is not a time
    game.timeOfDay = 1;
    expect(checkInvariants(game).join('\n')).toMatch(/the time of day is 1/);
    game.timeOfDay = 0.999;
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('the cured fish', () => {
  const stocked = (n: number, cured = 0, seed = 3) => {
    const school = new School();
    school.fill(n, seeded(seed), cured);
    return school;
  };

  it('start with none cured, and the flags are sized once for the most a lake holds', () => {
    const school = stocked(FISH_COUNT);
    expect(school.cured.length).toBe(FISH_CAPACITY);
    expect(school.curedCount()).toBe(0);
  });

  it('are marked and placed by cure, and a held fish is let go', () => {
    const school = stocked(6);
    school.held = 2;
    const depth = school.depth[2],
      phase = school.phase[2];
    school.cure(2, 3, -4, 1.25);
    expect(school.cured[2]).toBe(1);
    expect([school.x[2], school.y[2], school.heading[2]]).toEqual([3, -4, 1.25]);
    expect(school.depth[2]).toBe(depth);
    expect(school.phase[2]).toBe(phase);
    expect(school.held).toBe(-1);
    expect(school.curedCount()).toBe(1);
    expect(school.cured[1]).toBe(0);
  });

  it('leave a fish held that is not the one cured', () => {
    const school = stocked(6);
    school.held = 4;
    school.cure(1, 0, 0, 0);
    expect(school.held).toBe(4);
  });

  it('are counted among the live fish only', () => {
    const school = stocked(4);
    school.cured[10] = 1;
    school.cure(0, 0, 0, 0);
    expect(school.curedCount()).toBe(1);
  });

  it('start the first few cured when the lake is stocked with some', () => {
    const school = stocked(FISH_COUNT, 5);
    expect(school.curedCount()).toBe(5);
    for (let i = 0; i < FISH_COUNT; i++) expect(school.cured[i], `fish ${i}`).toBe(i < 5 ? 1 : 0);
  });

  it('are all of them, and no more flags, when the save has cured more than the lake holds', () => {
    const school = stocked(FISH_COUNT, FISH_COUNT + 30);
    expect(school.curedCount()).toBe(FISH_COUNT);
    expect(school.cured.subarray(FISH_COUNT).every((c) => c === 0)).toBe(true);
  });

  it('are not kept by a refill, whose flags are its own', () => {
    const school = stocked(8, 8);
    school.fill(8, seeded(4), 2);
    expect(school.curedCount()).toBe(2);
    school.fill(8, seeded(5));
    expect(school.curedCount()).toBe(0);
    school.fill(8, seeded(5), 8);
    school.fill(3, seeded(5), 0);
    expect(school.cured.every((c) => c === 0)).toBe(true);
  });

  it('are new fish when let in afresh: a respawn clears the flag', () => {
    const school = stocked(6, 6);
    school.respawn(3, seeded(9));
    expect(school.cured[3]).toBe(0);
    expect(school.curedCount()).toBe(5);
  });

  it('draw no chance of their own: a seed places the fish where it did', () => {
    const a = stocked(FISH_COUNT, 0, 7),
      b = stocked(FISH_COUNT, 7, 7);
    for (const key of ['x', 'y', 'depth', 'heading', 'speed', 'keeps'] as const)
      expect(Array.from(b[key]), key).toEqual(Array.from(a[key]));
    const ra = seeded(7),
      rb = seeded(7);
    new School().fill(FISH_COUNT, ra);
    new School().fill(FISH_COUNT, rb, 7);
    expect(rb()).toBe(ra());
  });
});
