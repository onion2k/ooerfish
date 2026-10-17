/** The lake without its picture: its clock, and that it is played the same from a seed. */
import { describe, expect, it } from 'vitest';
import { depthRange } from '../src/fish';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { ANGLER, CLOCK, FISH_COUNT, RELEASE, inside } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { nearestTime } from '../src/look';
import { DT, newGame, settle } from './helpers';

describe('the lake', () => {
  it('starts at the beginning of its time, and keeps time a step at a time', () => {
    const { game } = newGame();
    expect(game.t).toBe(0);
    settle(game, 60);
    expect(game.t).toBeCloseTo(1, 10);
    game.step(DT / 2);
    expect(game.t).toBeCloseTo(1 + DT / 2, 10);
  });

  it('stands still for a step of no time', () => {
    const { game } = newGame();
    settle(game, 10);
    const t = game.t;
    game.step(0);
    expect(game.t).toBe(t);
  });

  it('writes nothing to the save until asked', () => {
    const { game, store } = newGame();
    settle(game);
    expect(store.json).toBe(null);
    game.persist();
    expect(store.json).toBe('{"cured":0}');
  });
});

describe('the day', () => {
  it('starts at dawn, and runs on by game time, a day in CLOCK.daySeconds', () => {
    const { game } = newGame();
    expect(CLOCK).toEqual({ daySeconds: 720, startsAt: 0.25 });
    expect(game.timeOfDay).toBe(CLOCK.startsAt);
    expect(nearestTime(game.timeOfDay).name).toBe('dawn');
    settle(game, 60);
    expect(game.timeOfDay).toBeCloseTo(CLOCK.startsAt + 1 / CLOCK.daySeconds, 10);
  });

  it('comes round again after a day of steps, and never reaches one', () => {
    const { game } = newGame();
    const seen = new Set<string>();
    let most = 0;
    for (let f = 0; f < CLOCK.daySeconds * 60; f++) {
      game.step(DT);
      seen.add(nearestTime(game.timeOfDay).name);
      most = Math.max(most, game.timeOfDay);
    }
    expect(game.timeOfDay).toBeCloseTo(CLOCK.startsAt, 6);
    expect(most).toBeLessThan(1);
    // the four times are each passed through, in a day
    expect([...seen].sort()).toEqual(['dawn', 'day', 'dusk', 'night']);
  });

  it('wraps past midnight, and runs on from a time set', () => {
    const { game } = newGame();
    game.setTimeOfDay(0.9999);
    game.step(CLOCK.daySeconds * 0.001);
    expect(game.timeOfDay).toBeGreaterThanOrEqual(0);
    expect(game.timeOfDay).toBeCloseTo(0.0009, 6);
    game.setTimeOfDay(0.5);
    game.step(CLOCK.daySeconds / 4);
    expect(game.timeOfDay).toBeCloseTo(0.75, 10);
  });

  it('stands still for a step of no time', () => {
    const { game } = newGame();
    game.step(0);
    expect(game.timeOfDay).toBe(CLOCK.startsAt);
  });
});

/** A game with fish `i` landed and waiting by the rod, as the fight leaves it, and what it tells of splashes. */
function landedGame(seed = 1, json: string | null = null, i = 0) {
  const splashed: [number, number, number][] = [];
  const store = memoryStore(json);
  const game = new Game(new Progress(store), {
    random: seeded(seed),
    events: { splashed: (x, y, size) => splashed.push([x, y, size]) },
  });
  game.bite.phase = 'landed';
  game.bite.fish = i;
  game.fish.held = i;
  game.lure.phase = 'hooked';
  return { game, store, splashed };
}

describe('a cured fish goes back into the pond', () => {
  it('stow cures the landed fish where it is in the school, with no respawn, and counts one more', () => {
    const { game } = landedGame(1, null, 3);
    const before = game.fish.count;
    expect(game.fish.curedCount()).toBe(0);
    expect(game.stow()).toBe(true);
    expect(game.fish.count).toBe(before);
    expect(game.fish.cured[3]).toBe(1);
    expect(game.fish.curedCount()).toBe(1);
    // not placed afresh: its heading and stroke are the ones it had, and its depth is within the water where it was let go
    const [least, most] = depthRange(game.fish.x[3], game.fish.y[3]);
    expect(game.fish.depth[3]).toBeGreaterThanOrEqual(least);
    expect(game.fish.depth[3]).toBeLessThanOrEqual(most);
    expect(game.progress.save.cured).toBe(1);
    expect(game.fish.held).toBe(-1);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('releases it on the water, out from the angler toward the middle, facing away from the shore, with a splash', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game, splashed } = landedGame(seed);
      game.fish.x[0] = ANGLER.x + 20;
      game.fish.y[0] = ANGLER.y + 30;
      game.stow();
      const { x, y } = { x: game.fish.x[0], y: game.fish.y[0] };
      expect(inside(x, y, RELEASE.margin), `seed ${seed}`).toBe(true);
      const out = Math.hypot(x - ANGLER.x, y - ANGLER.y);
      expect(out, `seed ${seed}`).toBeGreaterThanOrEqual(RELEASE.distance);
      expect(out, `seed ${seed}`).toBeLessThanOrEqual(RELEASE.distance + RELEASE.steps * RELEASE.step + 1e-9);
      expect(y, 'toward the middle').toBeGreaterThan(ANGLER.y);
      expect(Math.sin(game.fish.heading[0]), 'facing away from the shore').toBeGreaterThan(0.9);
      expect(splashed.at(-1), `seed ${seed}`).toEqual([x, y, RELEASE.splash]);
    }
  });

  it('is clean at FISH_COUNT cures', () => {
    const { game } = landedGame(1, JSON.stringify({ cured: FISH_COUNT - 1 }), FISH_COUNT - 1);
    expect(game.pondClean).toBe(false);
    game.stow();
    expect(game.fish.curedCount()).toBe(FISH_COUNT);
    expect(game.pondClean).toBe(true);
    expect(game.contamination).toBe(0);
  });

  it('starts with min(n, FISH_COUNT) cured from a save of n, and loads one past the pond’s size', () => {
    for (const n of [0, 1, 7, FISH_COUNT, FISH_COUNT + 1, 99]) {
      const { game } = newGame(1, JSON.stringify({ cured: n }));
      expect(game.fish.curedCount(), `save of ${n}`).toBe(Math.min(n, FISH_COUNT));
      expect(game.pondClean).toBe(n >= FISH_COUNT);
      expect(checkInvariants(game), `save of ${n}`).toEqual([]);
      settle(game, 30);
    }
  });

  it('places the fish the same whatever is cured', () => {
    const at = (n: number) => {
      const { game } = newGame(7, JSON.stringify({ cured: n }));
      return [Array.from(game.fish.x), Array.from(game.fish.y), Array.from(game.fish.depth)];
    };
    expect(at(5)).toEqual(at(0));
    expect(at(99)).toEqual(at(0));
  });
});
