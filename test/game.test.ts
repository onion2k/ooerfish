/** The lake without its picture: its clock, and that it is played the same from a seed. */
import { describe, expect, it } from 'vitest';
import { flight } from '../src/cast';
import { fightFor, treasureFight, type Temper } from '../src/fight';
import { depthRange } from '../src/fish';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';
import { CLOCK, KINDS, RELEASE } from '../src/lake';
import { Progress, memoryStore, type Save } from '../src/progress';
import { seeded } from '../src/random';
import { nearestTime } from '../src/look';
import { HOME, LAKES, lakeNamed } from '../src/lakes';
import type { Lake } from '../src/lakes/lake';
import { NIGHT } from '../src/lake';
import { DT, castAtDrum, castAtTreasure, newGame, settle } from './helpers';

const ANGLER = HOME.angler;
const DRUMS = { ...DRUM_RULES, ...HOME.drums };
const FISH_COUNT = HOME.fishCount;
const TREASURES = { ...TREASURE_RULES, ...HOME.treasures };
const contaminationAfter = HOME.contaminationAfter;
const inside = HOME.inside;

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
    expect(store.json).toBe(
      `{"cured":0,"day":1,"drums":0,"journal":{},"found":[],"time":${game.timeOfDay},"place":"pond"}`,
    );
  });
});

describe('the day', () => {
  it('starts at dawn, and runs on by game time, a day in CLOCK.daySeconds', () => {
    const { game } = newGame();
    expect(CLOCK).toEqual({ daySeconds: 720, startsAt: 0.25, saveEvery: 10 });
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
    const [least, most] = depthRange(game.fish.x[3], game.fish.y[3], HOME);
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

  it('is clean at FISH_COUNT cures only with every drum hauled', () => {
    const { game } = landedGame(1, JSON.stringify({ cured: FISH_COUNT - 1, drums: DRUMS.count }), FISH_COUNT - 1);
    expect(game.pondClean).toBe(false);
    game.stow();
    expect(game.fish.curedCount()).toBe(FISH_COUNT);
    expect(game.pondClean).toBe(true);
    expect(game.contamination).toBe(0);
  });

  it('is not clean at FISH_COUNT cures with a drum left on the bed', () => {
    const { game } = landedGame(1, JSON.stringify({ cured: FISH_COUNT - 1 }), FISH_COUNT - 1);
    game.stow();
    expect(game.fish.curedCount()).toBe(FISH_COUNT);
    expect(game.pondClean).toBe(false);
    expect(game.contamination).toBeCloseTo(0.25, 12);
  });

  it('starts with min(n, FISH_COUNT) cured from a save of n, and loads one past the pond’s size', () => {
    for (const n of [0, 1, 7, FISH_COUNT, FISH_COUNT + 1, 99]) {
      const { game } = newGame(1, JSON.stringify({ cured: n }));
      expect(game.fish.curedCount(), `save of ${n}`).toBe(Math.min(n, FISH_COUNT));
      expect(game.pondClean, `save of ${n}, no drums hauled`).toBe(false);
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
      const [least, most] = KINDS[game.catchKind].weight;
      const heft = (game.catchWeight - least) / (most - least);
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
      expect(landed).toEqual([[KINDS[game.catchKind].name, game.catchWeight, game.temper]]);
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

describe('a hooked fish’s kind', () => {
  it('is the kind of the fish on the line, and its weight is drawn from that kind’s range', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { game } = hookedGame(seed);
      const i = game.bite.fish;
      expect(game.catchKind, `seed ${seed}`).toBe(game.fish.kind[i]);
      const [least, most] = KINDS[game.catchKind].weight;
      expect(game.catchWeight, `seed ${seed}`).toBeGreaterThanOrEqual(least);
      expect(game.catchWeight, `seed ${seed}`).toBeLessThanOrEqual(most);
    }
  });

  it('names the kind in the landed event', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game, landed } = hookedGame(seed);
      for (let f = 0; f < 120 / DT && game.bite.phase === 'hooked'; f++) {
        const l = game.line;
        game.reel(l.zone + l.figures.width / 2 < l.fishAt);
        game.step(DT);
      }
      expect(landed[0]?.[0], `seed ${seed}`).toBe(KINDS[game.fish.kind[game.bite.fish]].name);
    }
  });
});

describe('a drum of waste', () => {
  /** A game with every fish cured (on the save), the lure lying by drum `i`, and stepped until the drum is snagged and struck. */
  function hooked(i = 0, seed = 1, json: string | null = `{"cured": ${FISH_COUNT}}`) {
    const hauled: [number, number][] = [];
    const landedTold: [string, number, string][] = [];
    const store = memoryStore(json);
    const game = new Game(new Progress(store), {
      random: seeded(seed),
      events: {
        hauled: (n, of) => hauled.push([n, of]),
        landed: (kind, weight, temper) => landedTold.push([kind, weight, temper]),
      },
    });
    castAtDrum(game, i);
    for (let f = 0; f < 60 * 120 && game.bite.phase !== 'biting'; f++) game.step(DT);
    expect(game.bite.phase, 'the drum was snagged').toBe('biting');
    expect(game.bite.drum).toBe(i);
    expect(game.strike()).toBe('hooked');
    return { game, store, hauled, landedTold };
  }
  /** The reel held until the drum is landed. */
  function land(game: Game) {
    for (let f = 0; f < 60 * 60 && game.bite.phase === 'hooked'; f++) {
      game.reel(true);
      game.step(DT);
    }
    expect(game.bite.phase).toBe('landed');
  }

  it('can be snagged with every fish cured, and is hooked by a strike, with no weight or temper drawn', () => {
    const { game } = hooked();
    expect(game.fish.curedCount()).toBe(game.fish.count);
    expect(game.catchDrum).toBe(true);
    expect(game.catchWeight).toBe(DRUMS.weight);
    expect(game.line.figures.drum).toBe(true);
    expect(game.lure.phase).toBe('hooked');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is landed by the reel held, never slips with it let go, and is told as landed', () => {
    const { game, landedTold } = hooked();
    for (let f = 0; f < 60 * 90; f++) {
      game.reel(false);
      game.step(DT);
      expect(game.bite.phase, 'a drum never slips').toBe('hooked');
    }
    land(game);
    expect(landedTold).toEqual([['drum of waste', DRUMS.weight, 'steady']]);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is not a fish’s to stow: stow is refused, nothing cured', () => {
    const { game } = hooked();
    land(game);
    expect(game.stow()).toBe(false);
    expect(game.progress.save.cured).toBe(FISH_COUNT);
    expect(game.bucket).toBe(0);
    expect(game.bite.phase).toBe('landed');
  });

  it('is hauled by the tap on its card: saved at once, the contamination down by the formula, told, and gone from the bed', () => {
    const { game, store, hauled } = hooked(1);
    land(game);
    const before = game.contamination;
    expect(game.haul()).toBe(true);
    expect(game.progress.save.drums).toBe(1);
    expect(game.drums.found[1]).toBe(1);
    expect(game.drums.found[0]).toBe(0);
    expect(game.contamination).toBeCloseTo(contaminationAfter(game.progress.save.cured, 1), 12);
    expect(game.contamination).toBeLessThan(before);
    expect(before - game.contamination, 'a drum is worth two fish, two sixteenths').toBeCloseTo(2 / 16, 12);
    expect(hauled).toEqual([[1, DRUMS.count]]);
    expect(JSON.parse(store.json!)).toEqual({
      cured: FISH_COUNT,
      day: 1,
      drums: 1,
      journal: {},
      found: [],
      time: game.timeOfDay,
      place: 'pond',
    });
    expect(game.bite.phase).toBe('none');
    expect(game.bite.drum).toBe(-1);
    expect(game.lure.phase).toBe('ready');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('heals the water to the new truth from where it is, as after a cure', () => {
    const { game } = hooked();
    land(game);
    const was = game.waterDirt;
    game.haul();
    expect(game.waterDirt, 'not at once').toBe(was);
    expect(game.healTo).toBeCloseTo(game.contamination, 12);
    settle(game, 60 * 40);
    expect(game.waterDirt).toBeCloseTo(game.contamination, 6);
  });

  it('is refused a haul with nothing landed, with a fish landed, and twice', () => {
    const none = newGame().game;
    expect(none.haul()).toBe(false);
    const { game: fish } = landedGame(1);
    expect(fish.haul(), 'a fish is stowed, not hauled').toBe(false);
    expect(fish.bite.phase).toBe('landed');
    const { game } = hooked();
    land(game);
    expect(game.haul()).toBe(true);
    expect(game.haul()).toBe(false);
    expect(game.progress.save.drums).toBe(1);
  });

  it('is never snagged again once hauled, however long the lure lies where it was', () => {
    const { game } = hooked();
    land(game);
    game.haul();
    castAtDrum(game, 0);
    for (let f = 0; f < 60 * 120; f++) {
      game.step(DT);
      expect(game.bite.phase).toBe('none');
    }
  });

  it('cleans the pond only when every fish is cured and every drum hauled, with a drum snaggable in between', () => {
    const { game } = hooked(0);
    expect(game.pondClean, 'every fish cured, drums on the bed').toBe(false);
    land(game);
    game.haul();
    expect(game.pondClean, 'one drum left').toBe(false);
    castAtDrum(game, 1);
    for (let f = 0; f < 60 * 120 && game.bite.phase !== 'biting'; f++) game.step(DT);
    expect(game.bite.drum, 'the second drum is still snagged').toBe(1);
    game.strike();
    land(game);
    game.haul();
    expect(game.progress.save.drums).toBe(DRUMS.count);
    expect(game.pondClean).toBe(true);
    expect(game.contamination).toBe(0);
  });

  it('loads hauled by count: the first drums gone, the contamination from both counts', () => {
    for (const n of [0, 1, DRUMS.count]) {
      const { game } = newGame(1, JSON.stringify({ cured: 3, drums: n }));
      expect(game.drums.foundCount()).toBe(n);
      for (let i = 0; i < DRUMS.count; i++) expect(game.drums.found[i], `drum ${i} of ${n}`).toBe(i < n ? 1 : 0);
      expect(game.contamination).toBeCloseTo(contaminationAfter(3, n), 12);
      expect(game.waterDirt).toBe(game.contamination);
      expect(checkInvariants(game)).toEqual([]);
    }
    expect(newGame(1, '{"drums": 9}').game.drums.foundCount()).toBe(DRUMS.count);
  });

  it('holds the day open while the drum is on the line, as a fish does, and yawns once it is hauled', () => {
    const { game } = hooked();
    game.setTimeOfDay(0.9999);
    for (let f = 0; f < 60; f++) game.step(DT);
    expect(game.place, 'midnight passed, the fight not settled').toBe('pond');
    expect(game.sleep(), 'no bed with a drum on the line').toBe(false);
    land(game);
    for (let f = 0; f < 10; f++) game.step(DT);
    expect(game.place, 'landed, still waiting to be hauled').toBe('pond');
    game.haul();
    game.step(DT);
    expect(game.place).toBe('yawning');
  });

  it('is the same from the same seed, and draws nothing of the game’s chance to place', () => {
    const a = newGame(3).game,
      b = newGame(4).game;
    expect(Array.from(a.drums.x)).toEqual(Array.from(b.drums.x));
    expect(Array.from(a.drums.y)).toEqual(Array.from(b.drums.y));
    // the school is the same whether the drums are placed or not: the stream is untouched by them
    expect(Array.from(newGame(3).game.fish.x)).toEqual(Array.from(a.fish.x));
  });
});

describe('the journal', () => {
  /** The slots of a kind, in order. */
  const slotsOf = (game: Game, kind: number) =>
    Array.from({ length: game.fish.count }, (_, i) => i).filter((i) => game.fish.kind[i] === kind);

  /** A game with the first fish of `kind` landed, weighing `weight`, on the day `day`. */
  function landedKind(kind: number, weight: number, day = 1, json: string | null = null, nth = 0) {
    const { game, store } = landedGame(1, json ?? JSON.stringify({ day }), slotsOf(newGame().game, kind)[nth]);
    game.catchKind = kind;
    game.catchWeight = weight;
    return { game, store };
  }

  it('is written by a stow: the kind’s count one, its weight the best and today the first day, and saved at once', () => {
    const [least] = KINDS[2].weight;
    const { game, store } = landedKind(2, least + 1, 3);
    expect(game.stow()).toBe(true);
    expect(game.progress.save.journal).toEqual({ pike: { caught: 1, best: least + 1, first: 3 } });
    expect((JSON.parse(store.json!) as Save).journal).toEqual({ pike: { caught: 1, best: least + 1, first: 3 } });
    expect(checkInvariants(game)).toEqual([]);
  });

  it('counts a second catch of the kind, keeps the heavier weight and the first day', () => {
    const [least] = KINDS[0].weight;
    const first = landedKind(0, least + 0.5, 2);
    first.game.stow();
    // the same save, a day on, a lighter bream landed
    const next = landedKind(0, least + 0.1, 4, first.store.json, 1);
    next.game.day = next.game.progress.save.day = 4;
    next.game.stow();
    expect(next.game.progress.save.journal.bream).toEqual({ caught: 2, best: least + 0.5, first: 2 });
    expect(checkInvariants(next.game)).toEqual([]);
  });

  it('keeps each kind in an entry of its own', () => {
    const a = landedKind(0, 0.5);
    a.game.stow();
    const b = landedKind(1, 1.5, 1, a.store.json);
    b.game.stow();
    expect(Object.keys(b.game.progress.save.journal).sort()).toEqual(['bream', 'perch']);
  });

  it('cures by kind on a load: as many of each kind as the journal says were caught, the first slots of it', () => {
    const journal = {
      bream: { caught: 2, best: 0.5, first: 1 },
      perch: { caught: 1, best: 1, first: 1 },
      pike: { caught: 3, best: 3, first: 1 },
    };
    const { game } = newGame(1, JSON.stringify({ cured: 6, journal }));
    for (const [kind, want] of [
      [0, 2],
      [1, 1],
      [2, 3],
    ]) {
      const slots = slotsOf(game, kind);
      expect(slots.filter((i) => game.fish.cured[i]).length, KINDS[kind].id).toBe(want);
      // the first of its slots, in order
      expect(slots.slice(0, want).every((i) => game.fish.cured[i])).toBe(true);
    }
    expect(game.fish.curedCount()).toBe(6);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('cures at most a kind’s slots, however many the journal says were caught', () => {
    const journal = { pike: { caught: 7, best: 3, first: 1 } };
    const { game } = newGame(1, JSON.stringify({ cured: 7, journal }));
    expect(slotsOf(game, 2).every((i) => game.fish.cured[i])).toBe(true);
    expect(game.fish.curedCount(), 'only the pike’s three, and the rest in slot order').toBe(7);
    // the four that the journal does not account for are the first uncured slots, whatever their kind
    const rest = Array.from({ length: game.fish.count }, (_, i) => i).filter((i) => game.fish.kind[i] !== 2);
    expect(rest.slice(0, 4).every((i) => game.fish.cured[i])).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('cures an old save’s fish, which has no journal, in slot order as before', () => {
    const { game } = newGame(1, JSON.stringify({ cured: 5 }));
    for (let i = 0; i < game.fish.count; i++) expect(game.fish.cured[i], `slot ${i}`).toBe(i < 5 ? 1 : 0);
    expect(game.progress.save.journal).toEqual({});
    expect(checkInvariants(game)).toEqual([]);
  });

  it('cures the rest in slot order when the journal accounts for fewer than were cured', () => {
    const journal = { perch: { caught: 1, best: 1, first: 1 } };
    const { game } = newGame(1, JSON.stringify({ cured: 4, journal }));
    const perch = slotsOf(game, 1)[0];
    // the journal’s one perch, then slots 0, 1, 2 — the perch’s own slot, if among them, not counted twice
    const want = new Set([perch]);
    for (let i = 0; want.size < 4; i++) want.add(i);
    for (let i = 0; i < game.fish.count; i++) expect(!!game.fish.cured[i], `slot ${i}`).toBe(want.has(i));
    expect(checkInvariants(game)).toEqual([]);
  });

  it('plays on after a load by kind and keeps the rules, a stow adding to the journal', () => {
    const journal = { bream: { caught: 1, best: 0.5, first: 1 } };
    const { game } = newGame(2, JSON.stringify({ cured: 1, journal }));
    for (let f = 0; f < 600; f++) game.step(DT);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('a treasure on the bed', () => {
  /** A game with every fish cured, the lure lying by treasure `i`, stepped until it is snagged and struck. */
  function hooked(i = 2, seed = 1, json: string | null = `{"cured": ${FISH_COUNT}}`) {
    const found: string[] = [];
    const landedTold: [string, number, string][] = [];
    const store = memoryStore(json);
    const game = new Game(new Progress(store), {
      random: seeded(seed),
      events: {
        found: (id) => found.push(id),
        landed: (kind, weight, temper) => landedTold.push([kind, weight, temper]),
      },
    });
    castAtTreasure(game, i);
    for (let f = 0; f < 60 * 120 && game.bite.phase !== 'biting'; f++) game.step(DT);
    expect(game.bite.phase, 'the treasure was snagged').toBe('biting');
    expect(game.bite.treasure).toBe(i);
    expect(game.strike()).toBe('hooked');
    return { game, store, found, landedTold };
  }
  /** The reel held until the treasure is landed. */
  function land(game: Game) {
    for (let f = 0; f < 60 * 60 && game.bite.phase === 'hooked'; f++) {
      game.reel(true);
      game.step(DT);
    }
    expect(game.bite.phase).toBe('landed');
  }

  it('is hooked by a strike with its own profile, and no weight or temper drawn', () => {
    const { game } = hooked(2);
    expect(game.catchTreasure).toBe(2);
    expect(game.catchDrum).toBe(false);
    expect(game.catchWeight).toBe(TREASURES.list[2].weight);
    expect(game.line.figures.drum).toBe(true);
    expect(game.line.figures.fill, 'the treasure’s fill, the reel’s gift on it').toBe(treasureFight(game.gear).fill);
    expect(game.lure.phase).toBe('hooked');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is landed by the reel held, never slips with it let go, and is told as landed by name', () => {
    const { game, landedTold } = hooked(4);
    for (let f = 0; f < 60 * 60; f++) {
      game.reel(false);
      game.step(DT);
      expect(game.bite.phase, 'a treasure never slips').toBe('hooked');
    }
    land(game);
    expect(landedTold).toEqual([[TREASURES.list[4].name, TREASURES.list[4].weight, 'steady']]);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is neither stowed nor hauled: those are refused, nothing cured, nothing hauled', () => {
    const { game } = hooked();
    land(game);
    expect(game.stow()).toBe(false);
    expect(game.haul()).toBe(false);
    expect(game.progress.save.cured).toBe(FISH_COUNT);
    expect(game.progress.save.drums).toBe(0);
    expect(game.bite.phase).toBe('landed');
  });

  it('is kept by the tap on its card: saved at once, told, gone from the bed, and the cleaning left alone', () => {
    const { game, store, found } = hooked(2, 1, `{"cured": ${FISH_COUNT}, "drums": 1}`);
    land(game);
    const before = game.contamination;
    const worth = contaminationAfter(FISH_COUNT, 1);
    expect(game.keep()).toBe(true);
    expect(game.progress.save.found).toEqual(['lunchbox']);
    expect(game.treasures.found[2]).toBe(1);
    expect(game.treasures.foundCount()).toBe(1);
    expect(found).toEqual(['lunchbox']);
    expect(game.contamination, 'a treasure cleans nothing').toBe(before);
    expect(game.contamination).toBeCloseTo(worth, 12);
    expect(game.progress.save.cured).toBe(FISH_COUNT);
    expect(game.progress.save.drums).toBe(1);
    expect(game.healTo, 'no heal begun').toBe(game.healFrom);
    expect(JSON.parse(store.json!)).toEqual({
      cured: FISH_COUNT,
      day: 1,
      drums: 1,
      journal: {},
      found: ['lunchbox'],
      time: game.timeOfDay,
      place: 'pond',
    });
    expect(game.bite.phase).toBe('none');
    expect(game.bite.treasure).toBe(-1);
    expect(game.lure.phase).toBe('ready');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is refused a keep with nothing landed, a fish landed, a drum landed, and twice', () => {
    expect(newGame().game.keep()).toBe(false);
    const { game: fish } = newGame();
    fish.cast(Math.PI / 2 + 0.15, 0.55);
    for (let f = 0; f < 3600 && fish.bite.phase !== 'biting'; f++) fish.step(DT);
    fish.strike();
    for (let f = 0; f < 7200 && fish.bite.phase === 'hooked'; f++) {
      fish.reel(fish.line.zone + fish.line.figures.width / 2 < fish.line.fishAt);
      fish.step(DT);
    }
    expect(fish.bite.phase).toBe('landed');
    expect(fish.keep(), 'a fish is stowed, not kept').toBe(false);
    const { game } = hooked();
    land(game);
    expect(game.keep()).toBe(true);
    expect(game.keep()).toBe(false);
    expect(game.progress.save.found).toEqual(['lunchbox']);
  });

  it('is never snagged again once kept, however long the lure lies where it was', () => {
    const { game } = hooked(1);
    land(game);
    game.keep();
    castAtTreasure(game, 1);
    for (let f = 0; f < 60 * 120; f++) {
      game.step(DT);
      expect(game.bite.phase).toBe('none');
    }
  });

  it('keeps the ids in the order they were found, each once, held to the six there are', () => {
    const first = hooked(3);
    land(first.game);
    first.game.keep();
    expect(first.game.progress.save.found).toEqual(['badge']);
    const second = hooked(0, 1, JSON.stringify({ cured: FISH_COUNT, found: ['badge'] }));
    land(second.game);
    second.game.keep();
    expect(second.game.progress.save.found).toEqual(['badge', 'lure']);
    expect(second.game.progress.save.found.length).toBeLessThanOrEqual(TREASURES.count);
  });

  it('leaves the pond clean or not exactly as it was: fish and drums alone clean it', () => {
    const { game } = hooked(5);
    expect(game.pondClean, 'fish cured, drums on the bed').toBe(false);
    land(game);
    game.keep();
    expect(game.pondClean, 'a treasure is no drum').toBe(false);
    const done = newGame(1, JSON.stringify({ cured: FISH_COUNT, drums: DRUMS.count, found: [] })).game;
    expect(done.pondClean).toBe(true);
    castAtTreasure(done, 0);
    for (let f = 0; f < 60 * 120 && done.bite.phase !== 'biting'; f++) done.step(DT);
    expect(done.bite.treasure, 'a clean pond’s treasure can still be snagged').toBe(0);
    done.strike();
    land(done);
    done.keep();
    expect(done.pondClean).toBe(true);
    expect(done.contamination).toBe(0);
  });

  it('loads found by ids, the unknown dropped, and the contamination from the cures and drums alone', () => {
    const { game } = newGame(1, JSON.stringify({ cured: 3, drums: 1, found: ['duck', 'lure'] }));
    expect(Array.from(game.treasures.found)).toEqual([1, 0, 0, 0, 0, 1]);
    expect(game.contamination).toBeCloseTo(contaminationAfter(3, 1), 12);
    expect(checkInvariants(game)).toEqual([]);
    expect(Array.from(newGame(1, '{"found": ["nope"]}').game.treasures.found)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('holds the day open while a treasure is on the line, as a fish does, and yawns once it is kept', () => {
    const { game } = hooked();
    game.setTimeOfDay(0.9999);
    for (let f = 0; f < 60; f++) game.step(DT);
    expect(game.place, 'midnight passed, the fight not settled').toBe('pond');
    expect(game.sleep(), 'no bed with a treasure on the line').toBe(false);
    land(game);
    for (let f = 0; f < 10; f++) game.step(DT);
    expect(game.place, 'landed, still waiting to be kept').toBe('pond');
    game.keep();
    game.step(DT);
    expect(game.place).toBe('yawning');
  });

  it('is placed from a seed of its own: the game’s chance is untouched, and the school is the same', () => {
    const a = newGame(3).game,
      b = newGame(4).game;
    expect(Array.from(a.treasures.x)).toEqual(Array.from(b.treasures.x));
    expect(Array.from(a.treasures.y)).toEqual(Array.from(b.treasures.y));
    expect(Array.from(newGame(3).game.fish.x)).toEqual(Array.from(a.fish.x));
  });
});

describe('the time and the place are saved', () => {
  const saved = (store: { json: string | null }) => JSON.parse(store.json!) as Save;

  it('opens at the pond at the saved time', () => {
    const { game, store } = newGame(1, '{"cured": 2, "day": 3, "time": 0.6, "place": "pond"}');
    expect(game.timeOfDay).toBe(0.6);
    expect(game.place).toBe('pond');
    expect(game.day).toBe(3);
    expect(store.json, 'a load never writes').toBe('{"cured": 2, "day": 3, "time": 0.6, "place": "pond"}');
  });

  it('opens in the cabin at dawn on the saved day, whatever time the save says', () => {
    const { game, store } = newGame(1, '{"cured": 3, "day": 5, "time": 0.6, "place": "cabin"}');
    expect(game.place).toBe('cabin');
    expect(game.timeOfDay).toBe(CLOCK.startsAt);
    expect(game.day).toBe(5);
    expect(checkInvariants(game)).toEqual([]);
    expect(store.json).toBe('{"cured": 3, "day": 5, "time": 0.6, "place": "cabin"}');
  });

  it('writes nothing at construction, and a save without the fields opens at dawn at the pond', () => {
    const store = memoryStore();
    let writes = 0;
    const counting = { ...store, load: () => null, store: () => writes++, clear: () => undefined };
    new Game(new Progress(counting), { random: seeded(1) });
    expect(writes).toBe(0);
    const old = newGame(1, '{"cured": 4}').game;
    expect(old.timeOfDay).toBe(CLOCK.startsAt);
    expect(old.place).toBe('pond');
  });

  it('persist writes the clock and the place, and a reload reads them back', () => {
    const { game, store } = newGame();
    game.setTimeOfDay(0.6);
    game.persist();
    expect(saved(store)).toMatchObject({ time: 0.6, place: 'pond' });
    const again = newGame(1, store.json).game;
    expect(again.timeOfDay).toBe(0.6);
    expect(again.place).toBe('pond');
  });

  it('writes every CLOCK.saveEvery seconds of stepped time at the pond, and not before', () => {
    const { game, store } = newGame();
    let writes = 0;
    const real = store.store.bind(store);
    store.store = (json: string) => {
      writes++;
      real(json);
    };
    game.step(CLOCK.saveEvery - 1);
    expect(writes, 'nine seconds').toBe(0);
    expect(store.json).toBeNull();
    game.step(1);
    expect(writes, 'ten seconds').toBe(1);
    expect(saved(store).time).toBeCloseTo(CLOCK.startsAt + CLOCK.saveEvery / CLOCK.daySeconds, 12);
    game.step(CLOCK.saveEvery - 1);
    expect(writes, 'it starts again').toBe(1);
    game.step(1);
    expect(writes).toBe(2);
  });

  it('writes on out, with the place the pond', () => {
    const { game, store } = newGame(1, '{"cured": 1, "day": 2, "place": "cabin"}');
    expect(store.json).toBe('{"cured": 1, "day": 2, "place": "cabin"}');
    expect(game.out()).toBe(true);
    expect(saved(store)).toMatchObject({ place: 'pond', time: CLOCK.startsAt, day: 2 });
    expect(game.out(), 'refused at the pond, and nothing written').toBe(false);
  });

  it('keeps the earlier time and place when it persists while yawning', () => {
    const { game, store } = newGame();
    game.setTimeOfDay(0.6);
    game.persist();
    game.setTimeOfDay(0.999);
    game.step(1);
    game.sleep();
    expect(game.place).toBe('yawning');
    game.persist();
    expect(saved(store)).toMatchObject({ time: 0.6, place: 'pond' });
    expect(game.progress.save).toMatchObject({ time: 0.6, place: 'pond' });
  });

  it('writes cabin and dawn at the wake', () => {
    const { game, store } = newGame();
    game.setTimeOfDay(0.6);
    game.sleep();
    sleepThrough(game);
    expect(game.place).toBe('cabin');
    expect(saved(store)).toMatchObject({ time: CLOCK.startsAt, place: 'cabin', day: 2 });
  });

  it('does not count the cadence while away from the pond', () => {
    const { game, store } = newGame(1, '{"cured": 1, "place": "cabin"}');
    game.step(CLOCK.saveEvery * 3);
    expect(store.json, 'nothing written in the cabin').toBe('{"cured": 1, "place": "cabin"}');
  });
});

describe('the game in a lake it is handed', () => {
  /** The pond's geometry with nothing built on it and a small stock: five fish, one drum, no treasure. */
  const small = (): Lake => {
    const total = 5 + 1 * DRUM_RULES.worth;
    return {
      ...HOME,
      id: 'stub',
      name: 'Stub Pond',
      cliff: null,
      jetty: null,
      cabin: null,
      fishCount: 5,
      drums: { ...HOME.drums, count: 1 },
      treasures: { ...HOME.treasures, count: 0, list: [] },
      toClean: 5,
      total,
      contaminationAfter: (cured, drums) => Math.max(0, 1 - (cured + drums * DRUM_RULES.worth) / total),
    };
  };

  it('is the home lake unless told another', () => {
    const game = new Game(new Progress(memoryStore()), { random: seeded(1) });
    expect(game.lake).toBe(HOME);
    expect(HOME.id in LAKES).toBe(true);
    expect(lakeNamed('no such lake')).toBe(HOME);
  });

  it('fills the fish, places the drums and the treasures, and counts the cure by the lake', () => {
    const lake = small();
    const game = new Game(new Progress(memoryStore(), lake), { lake, random: seeded(1) });
    expect(game.lake).toBe(lake);
    expect(game.fish.count).toBe(5);
    expect(game.drums.count).toBe(1);
    expect(game.treasures.count).toBe(0);
    expect(lake.contaminationAfter(5, 1)).toBe(0);
    expect(game.contamination).toBe(1);
    // the drum lies on the bed in the lake's water, where the pond's own first drum would
    expect(lake.inside(game.drums.x[0], game.drums.y[0], lake.drums.where.margin)).toBe(true);
  });

  it('keeps every rule over three hundred frames, and a cure cleans by the lake’s own sum', () => {
    const lake = small();
    const game = new Game(new Progress(memoryStore(JSON.stringify({ cured: 5, drums: 1 })), lake), {
      lake,
      random: seeded(2),
    });
    expect(game.contamination, 'five cured and the drum hauled make it clean').toBe(0);
    expect(game.pondClean).toBe(true);
    for (let f = 0; f < 300; f++) {
      game.step(DT);
      expect(checkInvariants(game), `frame ${f}`).toEqual([]);
    }
  });

  it('keeps the rules with fish swimming and a lure cast, in a lake with no jetty', () => {
    const lake = small();
    const game = new Game(new Progress(memoryStore(), lake), { lake, random: seeded(3) });
    game.cast(Math.PI / 2, 0.6);
    for (let f = 0; f < 300; f++) {
      game.step(DT);
      expect(checkInvariants(game), `frame ${f}`).toEqual([]);
    }
  });

  it('places a lake’s bed finds the same each time it is asked', () => {
    const lake = small();
    const a = new Game(new Progress(memoryStore(), lake), { lake, random: seeded(1) });
    const b = new Game(new Progress(memoryStore(), lake), { lake, random: seeded(9) });
    expect([...a.drums.x]).toEqual([...b.drums.x]);
    expect([...a.drums.y]).toEqual([...b.drums.y]);
  });
});
