/** The lake without its picture: its clock, and that it is played the same from a seed. */
import { describe, expect, it } from 'vitest';
import { flight } from '../src/cast';
import { fightFor, type Temper } from '../src/fight';
import { depthRange } from '../src/fish';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { ANGLER, CLOCK, FISH_COUNT, PERCH, RELEASE, inside } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { nearestTime } from '../src/look';
import { NIGHT } from '../src/lake';
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
    expect(store.json).toBe('{"cured":0,"day":1}');
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
    // the step across midnight began the day's end; the player wakes and goes down to the pond to fish on
    settle(game, 120);
    expect(game.out()).toBe(true);
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

/** A game with a fish just hooked, from a seed, and the tempers its events told. */
function hookedGame(seed: number) {
  const landed: [string, number, Temper][] = [];
  const game = new Game(new Progress(memoryStore()), {
    random: seeded(seed),
    events: { landed: (kind, weight, temper) => landed.push([kind, weight, temper]) },
  });
  const north = Math.PI / 2;
  let middle = 0,
    gap = Infinity;
  for (let p = 1; p <= 200; p++) {
    const f = flight(north, p / 200);
    const g = Math.hypot(f.landing[0], f.landing[1]);
    if (g < gap) [middle, gap] = [p / 200, g];
  }
  game.cast(north, middle);
  for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
  expect(game.strike()).toBe('hooked');
  return { game, landed };
}

describe('a hooked fish’s temper', () => {
  it('is drawn on the hook, and the line is started with the figures for its size and temper', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game } = hookedGame(seed);
      expect(['calm', 'steady', 'feisty'], `seed ${seed}`).toContain(game.temper);
      const heft = (game.catchWeight - PERCH.weight[0]) / (PERCH.weight[1] - PERCH.weight[0]);
      expect(game.line.figures, `seed ${seed}`).toEqual(fightFor(heft, game.temper));
    }
  });

  it('is drawn after the weight and before the line’s own first draws, so a seed gives the same fish', () => {
    const a = hookedGame(3).game,
      b = hookedGame(3).game;
    expect([a.temper, a.catchWeight]).toEqual([b.temper, b.catchWeight]);
  });

  it('is told with the landing', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const { game, landed } = hookedGame(seed);
      for (let f = 0; f < 120 / DT && game.bite.phase === 'hooked'; f++) {
        const l = game.line;
        game.reel(l.zone + l.figures.width / 2 < l.fishAt);
        game.step(DT);
      }
      expect(game.bite.phase, `seed ${seed}`).toBe('landed');
      expect(landed).toEqual([[PERCH.name, game.catchWeight, game.temper]]);
    }
  });
});

/** A game a hair before midnight, so the next step crosses it. */
function beforeMidnight(seed = 1, json: string | null = null) {
  const made = newGame(seed, json);
  made.game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
  return made;
}

/** Step until the yawn is over and the player is in the cabin. */
function sleepThrough(game: Game) {
  for (let f = 0; f < 600 && game.place !== 'cabin'; f++) game.step(DT);
}

/** A game with a fish hooked at the lure, as a strike leaves it. */
function fightingGame(seed = 1) {
  const made = newGame(seed);
  const { game } = made;
  game.bite.phase = 'hooked';
  game.bite.fish = 0;
  game.fish.held = 0;
  game.lure.phase = 'hooked';
  game.line.start(5, fightFor(0.5, 'steady', game.gear), game.random);
  return made;
}

describe('the day’s end', () => {
  it('starts on day one, at the pond, with no fade', () => {
    const { game } = newGame();
    expect(game.day).toBe(1);
    expect(game.place).toBe('pond');
    expect(game.fade()).toBe(0);
  });

  it('yawns when a step carries the clock past midnight, and not at the lever', () => {
    const told: string[] = [];
    const game = new Game(new Progress(memoryStore()), { random: seeded(1), events: { yawned: () => told.push('y') } });
    game.setTimeOfDay(0.999);
    game.setTimeOfDay(0.0001);
    game.step(DT);
    expect(game.place, 'the lever is not a midnight').toBe('pond');
    game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
    game.step(DT);
    expect(game.place).toBe('yawning');
    expect(told).toEqual(['y']);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('holds everything but the fade while yawning, and the fade rises over NIGHT.fadeOut', () => {
    const { game } = beforeMidnight();
    settle(game, 1);
    expect(game.place).toBe('yawning');
    const [t, clock, x, y] = [game.t, game.timeOfDay, game.fish.x[0], game.fish.y[0]];
    let last = game.fade();
    for (let f = 0; f < (NIGHT.fadeOut - 0.2) * 60; f++) {
      game.step(DT);
      expect(game.fade()).toBeGreaterThanOrEqual(last);
      last = game.fade();
    }
    expect(game.place).toBe('yawning');
    expect(last).toBeGreaterThan(0.8);
    expect(last).toBeLessThan(1);
    expect([game.t, game.timeOfDay, game.fish.x[0], game.fish.y[0]]).toEqual([t, clock, x, y]);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('waits for a fish on the line, the clock running on, and yawns once it is settled', () => {
    const { game } = fightingGame();
    game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
    game.step(DT);
    expect(game.place).toBe('pond');
    expect(game.timeOfDay).toBeLessThan(0.1);
    // the clock keeps going while the fight does
    const was = game.timeOfDay;
    game.step(DT);
    expect(game.timeOfDay).toBeGreaterThan(was);
    // the fish slips: the yawn comes on the first step after
    game.bite.letGo(game.t, game.fish, game.lure, true);
    game.lure.freed(game.lure.at[0], game.lure.at[1], -game.lure.at[2]);
    expect(game.place).toBe('pond');
    game.step(DT);
    expect(game.place).toBe('yawning');
  });

  it('waits for a landed fish to be stowed, and yawns on the first step after', () => {
    const { game } = fightingGame();
    game.bite.phase = 'landed';
    game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
    settle(game, 300);
    expect(game.place, 'still landed').toBe('pond');
    expect(game.stow()).toBe(true);
    expect(game.place, 'not by the stow itself').toBe('pond');
    game.step(DT);
    expect(game.place).toBe('yawning');
    expect(game.progress.save.cured).toBe(1);
  });

  it('yawns once, and wakes once, for a midnight', () => {
    const told: string[] = [];
    const game = new Game(new Progress(memoryStore()), {
      random: seeded(1),
      events: { yawned: () => told.push('yawned'), woke: (d) => told.push(`woke ${d}`) },
    });
    game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
    settle(game, 300);
    expect(told).toEqual(['yawned', 'woke 2']);
  });

  it('reels in the lure at the yawn, and a nibbling fish lets go', () => {
    const { game } = newGame(3);
    game.bite.phase = 'nibbling';
    game.bite.fish = 2;
    game.fish.held = 2;
    game.lure.phase = 'sinking';
    game.reel(true);
    game.sleep();
    expect(game.place).toBe('yawning');
    expect(game.lure.phase).toBe('ready');
    expect(game.bite.phase).toBe('none');
    expect(game.fish.held).toBe(-1);
    expect(game.reeling).toBe(false);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reels in a lure that is flying or lying on the bank', () => {
    for (const cast of [0, 1]) {
      const { game } = newGame(2);
      game.cast(0.3, 1);
      if (cast) settle(game, 30);
      expect(game.lure.phase).not.toBe('ready');
      game.sleep();
      expect(game.lure.phase).toBe('ready');
    }
  });

  it('wakes in the cabin at dawn on the next day, saved, the water healed and the splashes gone', () => {
    const woke: number[] = [];
    const store = memoryStore();
    const game = new Game(new Progress(store), { random: seeded(1), events: { woke: (d) => woke.push(d) } });
    // a heal in train: a cure just made
    game.setContamination(1);
    game.bite.phase = 'landed';
    game.bite.fish = 0;
    game.fish.held = 0;
    game.lure.phase = 'hooked';
    game.stow();
    settle(game, 30);
    expect(game.waterDirt).toBeGreaterThan(game.contamination);
    expect(game.splashes.count).toBeGreaterThan(0);
    game.sleep();
    sleepThrough(game);
    expect(game.place).toBe('cabin');
    expect(game.day).toBe(2);
    expect(woke).toEqual([2]);
    expect((JSON.parse(store.json!) as { day: number }).day).toBe(2);
    expect(game.timeOfDay).toBe(CLOCK.startsAt);
    expect(game.waterDirt).toBe(game.contamination);
    expect(game.splashes.count).toBe(0);
    expect(game.fade()).toBe(1);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('lifts the fade over NIGHT.fadeIn of time stepped in the cabin', () => {
    const { game } = newGame();
    game.sleep();
    sleepThrough(game);
    expect(game.fade()).toBe(1);
    for (let f = 0; f < (NIGHT.fadeIn / 2) * 60; f++) game.step(DT);
    expect(game.fade()).toBeCloseTo(0.5, 1);
    settle(game, 120);
    expect(game.fade()).toBe(0);
  });

  it('moves nothing in the cabin but the fade, over many steps', () => {
    const { game } = newGame(5);
    settle(game, 200);
    game.sleep();
    sleepThrough(game);
    const snap = () =>
      JSON.stringify([
        game.t,
        game.timeOfDay,
        game.waterDirt,
        game.healElapsed,
        game.lure.phase,
        game.splashes.count,
        [...game.fish.x],
        [...game.fish.y],
        [...game.fish.depth],
      ]);
    const was = snap();
    for (let f = 0; f < 3000; f++) {
      game.step(DT);
      if (f % 500 === 0) expect(checkInvariants(game)).toEqual([]);
    }
    expect(snap()).toBe(was);
    expect(game.place).toBe('cabin');
  });

  it('refuses a cast while yawning or in the cabin, the lure staying in', () => {
    const { game } = newGame();
    game.sleep();
    expect(game.cast(0.3, 1), 'yawning').toBe(false);
    sleepThrough(game);
    expect(game.cast(0.3, 1), 'in the cabin').toBe(false);
    expect(game.lure.phase).toBe('ready');
    game.out();
    expect(game.cast(0.3, 1)).toBe(true);
  });

  it('goes out to the pond, where the clock runs on from dawn', () => {
    const { game } = newGame();
    game.sleep();
    sleepThrough(game);
    expect(game.out()).toBe(true);
    expect(game.place).toBe('pond');
    expect(game.fade()).toBe(0);
    const t = game.timeOfDay;
    settle(game, 60);
    expect(game.timeOfDay).toBeGreaterThan(t);
    expect(game.out(), 'already at the pond').toBe(false);
  });

  it('refuses to go out while yawning', () => {
    const { game } = newGame();
    game.sleep();
    expect(game.out()).toBe(false);
    expect(game.place).toBe('yawning');
  });

  it('sleeps from the pond and from the cabin, a day on each time', () => {
    const { game, store } = newGame();
    expect(game.sleep()).toBe(true);
    expect(game.sleep(), 'not while yawning').toBe(false);
    sleepThrough(game);
    expect(game.day).toBe(2);
    expect(game.sleep(), 'from the cabin').toBe(true);
    expect(game.place).toBe('yawning');
    sleepThrough(game);
    expect(game.day).toBe(3);
    expect((JSON.parse(store.json!) as { day: number }).day).toBe(3);
    game.out();
    settle(game, 10);
    expect(game.day, 'the day does not go back').toBe(3);
  });

  it('refuses to sleep with a fish hooked or landed, changing nothing', () => {
    for (const phase of ['hooked', 'landed'] as const) {
      const { game } = fightingGame();
      game.bite.phase = phase;
      expect(game.sleep(), phase).toBe(false);
      expect(game.place, phase).toBe('pond');
      expect(game.bite.phase, phase).toBe(phase);
      expect(game.day, phase).toBe(1);
    }
  });

  it('does not count a midnight it has already woken from', () => {
    const { game } = beforeMidnight();
    settle(game, 300);
    expect(game.day).toBe(2);
    game.out();
    settle(game, 600);
    expect(game.day).toBe(2);
    expect(game.place).toBe('pond');
  });

  it('drops nothing away from the pond: a pebble in the cabin or the yawn is refused and changes nothing', () => {
    const { game } = newGame(4);
    game.sleep();
    for (const where of ['yawning', 'cabin'] as const) {
      expect(game.place).toBe(where);
      expect(game.drop(0, 0)).toBe(false);
      expect(game.dropNear(0, 0)).toBe(false);
      expect(game.splashes.count).toBe(0);
      if (where === 'yawning') sleepThrough(game);
    }
    game.out();
    expect(game.drop(0, 0)).toBe(true);
  });
});
