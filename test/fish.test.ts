/** The fish of the lab's lake: where they swim, that they stay in the water, and the lake's two levers. */
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/invariants';
import { FISH_CAPACITY, FISH_COUNT, bedDepth, inside, shoreRadius } from '../src/lake';
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
    expect(game.timeOfDay).toBe(0.5);
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
    game.setTimeOfDay(2);
    expect(game.timeOfDay).toBe(1);
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
  });
});
