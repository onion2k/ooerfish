/** The lake without its picture: its clock, and that it is played the same from a seed. */
import { describe, expect, it } from 'vitest';
import { aimAt, flight, rodTip } from '../src/cast';
import { careful } from '../src/angler';
import { landingAboard, rowPath } from '../src/boat';
import { fightFor, treasureFight, type Temper } from '../src/fight';
import { depthRange } from '../src/fish';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { DRUM_RULES, TREASURE_RULES } from '../src/rules';
import { BOAT, CLOCK, DRIFT, KINDS, RELEASE, ROPE, SNAG, WEATHER } from '../src/lake';
import { snagGap } from '../src/snags';
import { Progress, memoryStore, type Save } from '../src/progress';
import { seeded } from '../src/random';
import { nearestTime } from '../src/look';
import { HOME, LAKES, lakeNamed } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';
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
      `{"lake":"duckpond","lakes":{"duckpond":{"cured":0,"drums":0,"journal":{},"found":[],"boat":null}},"day":1,"time":${game.timeOfDay},"place":"pond","requests":[],"photos":[],"tally":{"rain":0,"run":0,"best":0}}`,
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
    expect(game.progress.entry(game.lake.id).cured).toBe(1);
    expect(game.fish.held).toBe(-1);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('releases it on the water, out from the angler toward the middle, facing away from the shore, with a splash', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game, splashed } = landedGame(seed);
      game.fish.x[0] = 0;
      game.fish.y[0] = 0;
      game.stow();
      const { x, y } = { x: game.fish.x[0], y: game.fish.y[0] };
      expect(inside(x, y, RELEASE.margin), `seed ${seed}`).toBe(true);
      const out = Math.hypot(x - ANGLER.x, y - ANGLER.y);
      // a bit under the figure is the rounding of the sum: the stand faces off along the deck, and the fish goes the same way
      expect(out, `seed ${seed}`).toBeGreaterThanOrEqual(RELEASE.distance - 1e-9);
      expect(out, `seed ${seed}`).toBeLessThanOrEqual(RELEASE.distance + RELEASE.steps * RELEASE.step + 1e-9);
      expect(Math.hypot(x, y), 'toward the middle').toBeLessThan(Math.hypot(ANGLER.x, ANGLER.y));
      // it faces away from the angler's shore: along the way from the angler to the middle
      const to = Math.hypot(ANGLER.x, ANGLER.y);
      const facing = (Math.cos(game.fish.heading[0]) * -ANGLER.x + Math.sin(game.fish.heading[0]) * -ANGLER.y) / to;
      expect(facing, 'facing away from the shore').toBeGreaterThan(0.9);
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
  const north = HOME.aim.angle;
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

describe('a hooked fish’s run (`docs/boat.md`, C5a)', () => {
  /** How far round, either way, the fish lies from straight ahead of the angler's heading, the whole of a fight, once the line is out. */
  function widest(game: Game, ahead: number): number {
    const [lx, ly] = game.landing();
    let worst = 0;
    const phase = (): string => game.bite.phase;
    for (let f = 0; f < 60 * 120 && phase() === 'hooked'; f++) {
      const l = game.line;
      game.reel(careful(l.zone, l.zoneSpeed, l.fishAt, l.figures.width));
      game.step(DT);
      if (phase() !== 'hooked' || l.out < 4) continue;
      const b = Math.atan2(game.fish.y[game.bite.fish] - ly, game.fish.x[game.bite.fish] - lx);
      worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(b - ahead), Math.cos(b - ahead))));
    }
    return worst;
  }

  it('runs ahead of the angler, whichever way that is: within the fan either side of the heading the jetty’s stand faces', () => {
    const heading = HOME.angler.heading!;
    for (let seed = 1; seed <= 4; seed++) {
      const { game } = hookedGame(seed);
      // the fan is HOOKED.wide (1.1) and its sway (0.35) wide, and the fish swims to its mark with a little lag
      expect(widest(game, heading), `seed ${seed}`).toBeLessThan(1.1 + 0.35 + 0.3);
    }
  });

  it('runs ahead of the boat, whichever way it points, from the seat: within the fan either side of its heading', () => {
    let tried = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const game = new Game(new Progress(memoryStore('{"cured": 6}')), { random: seeded(seed) });
      expect(game.row(...HOME.boat!.spot)).toBe(true);
      for (let f = 0; f < 60 * 60 && (game.boat.rowing || !game.boat.aboard); f++) game.step(DT);
      expect(game.boat.aboard && !game.boat.rowing).toBe(true);
      // the boat points along its row, from the mooring toward the spot, which is not due north
      expect(Math.abs(game.boat.heading - Math.PI / 2)).toBeGreaterThan(1.5);
      game.cast(game.boat.heading, 0.35);
      for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
      if (game.bite.phase !== 'biting' || game.strike() !== 'hooked') continue;
      tried++;
      expect(widest(game, game.boat.heading), `seed ${seed}`).toBeLessThan(1.1 + 0.35 + 0.3);
    }
    expect(tried, 'a fish was played from the boat').toBeGreaterThan(0);
  });

  it('runs due north from a stand with no heading, the Reservoir’s, as it always did', () => {
    const game = new Game(new Progress(memoryStore(), LAKES), { lake: RESERVOIR, random: seeded(2) });
    game.cast(RESERVOIR.aim.angle, RESERVOIR.aim.power);
    for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
    expect(game.strike()).toBe('hooked');
    expect(widest(game, Math.PI / 2)).toBeLessThan(1.1 + 0.35 + 0.3);
  });
});

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
    expect(game.progress.entry(game.lake.id).cured).toBe(1);
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
    expect(game.progress.entry(game.lake.id).cured).toBe(FISH_COUNT);
    expect(game.bucket).toBe(0);
    expect(game.bite.phase).toBe('landed');
  });

  it('is hauled by the tap on its card: saved at once, the contamination down by the formula, told, and gone from the bed', () => {
    const { game, store, hauled } = hooked(1);
    land(game);
    const before = game.contamination;
    expect(game.haul()).toBe(true);
    expect(game.progress.entry(game.lake.id).drums).toBe(1);
    expect(game.drums.found[1]).toBe(1);
    expect(game.drums.found[0]).toBe(0);
    expect(game.contamination).toBeCloseTo(contaminationAfter(game.progress.entry(game.lake.id).cured, 1), 12);
    expect(game.contamination).toBeLessThan(before);
    expect(before - game.contamination, 'a drum is worth two fish, two sixteenths').toBeCloseTo(2 / 16, 12);
    expect(hauled).toEqual([[1, DRUMS.count]]);
    expect(JSON.parse(store.json!)).toEqual({
      lake: HOME.id,
      lakes: { [HOME.id]: { cured: FISH_COUNT, drums: 1, journal: {}, found: [], boat: null } },
      day: 1,
      time: game.timeOfDay,
      place: 'pond',
      requests: [],
      photos: [],
      tally: { rain: 0, run: 0, best: 0 },
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
    expect(game.progress.entry(game.lake.id).drums).toBe(1);
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
    expect(game.progress.entry(game.lake.id).drums).toBe(DRUMS.count);
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
    expect(game.progress.entry(game.lake.id).journal).toEqual({ pike: { caught: 1, best: least + 1, first: 3 } });
    expect((JSON.parse(store.json!) as Save).lakes[game.lake.id].journal).toEqual({
      pike: { caught: 1, best: least + 1, first: 3 },
    });
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
    expect(next.game.progress.entry(next.game.lake.id).journal.bream).toEqual({
      caught: 2,
      best: least + 0.5,
      first: 2,
    });
    expect(checkInvariants(next.game)).toEqual([]);
  });

  it('keeps each kind in an entry of its own', () => {
    const a = landedKind(0, 0.5);
    a.game.stow();
    const b = landedKind(1, 1.5, 1, a.store.json);
    b.game.stow();
    expect(Object.keys(b.game.progress.entry(b.game.lake.id).journal).sort()).toEqual(['bream', 'perch']);
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
    expect(game.progress.entry(game.lake.id).journal).toEqual({});
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
    expect(game.progress.entry(game.lake.id).cured).toBe(FISH_COUNT);
    expect(game.progress.entry(game.lake.id).drums).toBe(0);
    expect(game.bite.phase).toBe('landed');
  });

  it('is kept by the tap on its card: saved at once, told, gone from the bed, and the cleaning left alone', () => {
    const { game, store, found } = hooked(2, 1, `{"cured": ${FISH_COUNT}, "drums": 1}`);
    land(game);
    const before = game.contamination;
    const worth = contaminationAfter(FISH_COUNT, 1);
    expect(game.keep()).toBe(true);
    expect(game.progress.entry(game.lake.id).found).toEqual(['lunchbox']);
    expect(game.treasures.found[2]).toBe(1);
    expect(game.treasures.foundCount()).toBe(1);
    expect(found).toEqual(['lunchbox']);
    expect(game.contamination, 'a treasure cleans nothing').toBe(before);
    expect(game.contamination).toBeCloseTo(worth, 12);
    expect(game.progress.entry(game.lake.id).cured).toBe(FISH_COUNT);
    expect(game.progress.entry(game.lake.id).drums).toBe(1);
    expect(game.healTo, 'no heal begun').toBe(game.healFrom);
    expect(JSON.parse(store.json!)).toEqual({
      lake: HOME.id,
      lakes: { [HOME.id]: { cured: FISH_COUNT, drums: 1, journal: {}, found: ['lunchbox'], boat: null } },
      day: 1,
      time: game.timeOfDay,
      place: 'pond',
      requests: [],
      photos: [],
      tally: { rain: 0, run: 0, best: 0 },
    });
    expect(game.bite.phase).toBe('none');
    expect(game.bite.treasure).toBe(-1);
    expect(game.lure.phase).toBe('ready');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('asks the town’s requests on a keep, so the logbook’s letter is answered at the sixth page and told', () => {
    // the other five pages found over the two lakes, and the last one, page 3, snagged in the pond
    const answered: string[] = [];
    const store = memoryStore(
      JSON.stringify({
        lake: 'duckpond',
        lakes: {
          duckpond: { cured: FISH_COUNT, drums: 0, journal: {}, found: ['page1', 'page2'], boat: null },
          reservoir: { cured: 0, drums: 0, journal: {}, found: ['page4', 'page5', 'page6'], boat: null },
        },
      }),
    );
    // the registry handed in, as the page hands it, so the Reservoir's entry is read and not dropped as unknown
    const game = new Game(new Progress(store, LAKES), {
      random: seeded(1),
      events: { answered: (id) => answered.push(id) },
    });
    const i = TREASURES.list.findIndex((t) => t.id === 'page3');
    castAtTreasure(game, i);
    for (let f = 0; f < 60 * 120 && game.bite.phase !== 'biting'; f++) game.step(DT);
    expect(game.bite.treasure).toBe(i);
    expect(game.strike()).toBe('hooked');
    land(game);
    expect(game.progress.save.requests).not.toContain('logbook');
    expect(game.keep()).toBe(true);
    expect(game.progress.save.requests).toContain('logbook');
    expect(answered).toEqual(['logbook']);
    expect((JSON.parse(store.json!) as { requests: string[] }).requests).toContain('logbook');
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is refused a keep with nothing landed, a fish landed, a drum landed, and twice', () => {
    expect(newGame().game.keep()).toBe(false);
    const { game: fish } = newGame();
    fish.cast(HOME.aim.angle + 0.15, 0.55);
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
    expect(game.progress.entry(game.lake.id).found).toEqual(['lunchbox']);
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
    expect(first.game.progress.entry(first.game.lake.id).found).toEqual(['badge']);
    const second = hooked(0, 1, JSON.stringify({ cured: FISH_COUNT, found: ['badge'] }));
    land(second.game);
    second.game.keep();
    expect(second.game.progress.entry(second.game.lake.id).found).toEqual(['badge', 'lure']);
    expect(second.game.progress.entry(second.game.lake.id).found.length).toBeLessThanOrEqual(TREASURES.count);
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
    expect(Array.from(game.treasures.found)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0]);
    expect(game.contamination).toBeCloseTo(contaminationAfter(3, 1), 12);
    expect(checkInvariants(game)).toEqual([]);
    expect(Array.from(newGame(1, '{"found": ["nope"]}').game.treasures.found)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
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

  it('opens in the cabin at the saved time on the saved day', () => {
    const { game, store } = newGame(1, '{"cured": 3, "day": 5, "time": 0.6, "place": "cabin"}');
    expect(game.place).toBe('cabin');
    expect(game.timeOfDay).toBe(0.6);
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
    const game = new Game(new Progress(memoryStore(), { [lake.id]: lake }), { lake, random: seeded(1) });
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
    const game = new Game(
      new Progress(memoryStore(JSON.stringify({ lakes: { [lake.id]: { cured: 5, drums: 1 } } })), { [lake.id]: lake }),
      {
        lake,
        random: seeded(2),
      },
    );
    expect(game.contamination, 'five cured and the drum hauled make it clean').toBe(0);
    expect(game.pondClean).toBe(true);
    for (let f = 0; f < 300; f++) {
      game.step(DT);
      expect(checkInvariants(game), `frame ${f}`).toEqual([]);
    }
  });

  it('keeps the rules with fish swimming and a lure cast, in a lake with no jetty', () => {
    const lake = small();
    const game = new Game(new Progress(memoryStore(), { [lake.id]: lake }), { lake, random: seeded(3) });
    game.cast(lake.aim.angle, 0.6);
    for (let f = 0; f < 300; f++) {
      game.step(DT);
      expect(checkInvariants(game), `frame ${f}`).toEqual([]);
    }
  });

  it('places a lake’s bed finds the same each time it is asked', () => {
    const lake = small();
    const a = new Game(new Progress(memoryStore(), { [lake.id]: lake }), { lake, random: seeded(1) });
    const b = new Game(new Progress(memoryStore(), { [lake.id]: lake }), { lake, random: seeded(9) });
    expect([...a.drums.x]).toEqual([...b.drums.x]);
    expect([...a.drums.y]).toEqual([...b.drums.y]);
  });
});

describe('the line as a rope under tension', () => {
  /** The rope's length as the sum of its segments. */
  function ropeLength(game: Game): number {
    const p = game.rope.points;
    let sum = 0;
    for (let i = 3; i < p.length; i += 3) sum += Math.hypot(p[i] - p[i - 3], p[i + 1] - p[i - 2], p[i + 2] - p[i - 1]);
    return sum;
  }
  const chord = (game: Game) =>
    Math.hypot(
      game.lineEnd[0] - game.lineStart[0],
      game.lineEnd[1] - game.lineStart[1],
      game.lineEnd[2] - game.lineStart[2],
    );
  /** The rope stepped on its own at the tension given, the fight itself held where it is. */
  function ropeAt(game: Game, tension: number) {
    game.line.tension = tension;
    for (let f = 0; f < 120; f++) (game as unknown as { stepRope(dt: number): void }).stepRope(DT);
  }

  it('is drawn to its chord when strained to the full, and has its slack to spare when calm', () => {
    const { game } = hookedGame(3);
    ropeAt(game, 1);
    const taut = ropeLength(game) / chord(game);
    ropeAt(game, 0);
    const calm = ropeLength(game) / chord(game);
    // the taut line is the chord to within a fifth of the slack; the calm one has the slack over it
    expect(taut, 'strained to one, the rope is its chord').toBeLessThan(1 + ROPE.slack * 0.2);
    expect(calm, 'calm, the rope has its slack').toBeGreaterThan(1 + ROPE.slack * 0.6);
    expect(calm - taut, 'the slack is the tension’s to take').toBeGreaterThan(ROPE.slack * 0.4);
  });
});

describe('the bobber’s body', () => {
  /** A cast that lands on the water, thrown and stepped until it is sinking. */
  function sunk(seed = 1) {
    const { game } = newGame(seed);
    const north = HOME.aim.angle;
    game.cast(north, 0.6);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(game.lure.phase).toBe('sinking');
    return game;
  }

  it('is carried at the start, and while the lure is in the air', () => {
    const { game } = newGame();
    expect(game.bodies.held).toBe(true);
    game.cast(HOME.aim.angle, 0.6);
    expect(game.bodies.held).toBe(true);
  });

  it('is dropped where a cast lands on the water, and sits where the lure’s bobber is', () => {
    const game = sunk();
    expect(game.bodies.held).toBe(false);
    for (let f = 0; f < 120; f++) game.step(DT);
    expect(Math.abs(game.bodies.x - game.lure.bobber[0])).toBeLessThan(1e-5);
    expect(Math.abs(game.bodies.y - game.lure.bobber[1])).toBeLessThan(1e-5);
    expect(game.bodies.asleep).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is taken by a reel-in, and dropped again by the next cast’s landing', () => {
    const game = sunk();
    game.reelIn();
    expect(game.bodies.held).toBe(true);
    game.cast(HOME.aim.angle, 0.4);
    expect(game.bodies.held).toBe(true);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(game.bodies.held).toBe(false);
    expect(Math.abs(game.bodies.x - game.lure.bobber[0])).toBeLessThan(1e-5);
  });

  it('is taken by a cast thrown while the lure is out', () => {
    const game = sunk();
    game.cast(HOME.aim.angle, 0.3);
    expect(game.lure.phase).toBe('flying');
    expect(game.bodies.held).toBe(true);
  });

  it('is left carried by a cast onto the bank', () => {
    const { game } = newGame(2);
    game.cast(0.3, 1);
    settle(game, 60);
    expect(game.lure.phase).toBe('lying');
    expect(game.bodies.held).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is taken by a hooked fish', () => {
    const { game } = hookedGame(1);
    expect(game.lure.phase).toBe('hooked');
    expect(game.bodies.held).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('is dropped where the fish let go, when a fish slips', () => {
    const { game } = hookedGame(2);
    for (let f = 0; f < 60 / DT && game.bite.phase === 'hooked'; f++) game.step(DT);
    expect(game.lure.phase).toBe('sinking');
    expect(game.bodies.held).toBe(false);
    expect(Math.abs(game.bodies.x - game.lure.bobber[0])).toBeLessThan(1e-5);
    expect(Math.abs(game.bodies.y - game.lure.bobber[1])).toBeLessThan(1e-5);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reads back as the lure had it, to the bit, when nothing moves it', () => {
    const game = sunk();
    const x = game.lure.bobber[0],
      y = game.lure.bobber[1];
    for (let f = 0; f < 300; f++) game.step(DT);
    expect(game.lure.bobber[0]).toBe(x);
    expect(game.lure.bobber[1]).toBe(y);
  });

  it('has a world of its own for each game', () => {
    const a = newGame(1).game,
      b = newGame(1).game;
    expect(a.bodies.world).not.toBe(b.bodies.world);
  });
});

describe('the boat (`docs/boat.md`, C2)', () => {
  const SOUTH = -HOME.shoreRadius(-Math.PI / 2);
  const MOORING = HOME.boat!.mooring;
  const NORTH = Math.PI / 2;

  /** A game at the pond, or any lake, with every event the boat tells kept in order. */
  function boatGame(seed = 1, json: string | null = null, lake: Lake = HOME) {
    const told: string[] = [];
    const store = memoryStore(json);
    const game = new Game(new Progress(store, LAKES), {
      lake,
      random: seeded(seed),
      events: {
        rowed: (x, y) => told.push(`rowed ${x.toFixed(2)},${y.toFixed(2)}`),
        anchored: (x, y) => told.push(`anchored ${x.toFixed(2)},${y.toFixed(2)}`),
        ashore: () => told.push('ashore'),
      },
    });
    return { game, told, store };
  }

  /** Step until the boat is no longer rowing, within a minute and a half. */
  function arrive(game: Game) {
    for (let f = 0; f < 90 * 60 && game.boat.rowing; f++) game.step(DT);
    expect(game.boat.rowing).toBe(false);
  }

  /** The game anchored at (x, y). */
  function anchoredAt(x: number, y: number, seed = 1, json: string | null = null) {
    const made = boatGame(seed, json);
    expect(made.game.row(x, y)).toBe(true);
    arrive(made.game);
    return made;
  }

  const saved = (store: { json: string | null }) => (JSON.parse(store.json!) as Save).lakes[HOME.id].boat;

  it('lies ashore at the mooring, and the angler is the shore’s, to the very objects', () => {
    const { game } = boatGame();
    expect(game.boat).toMatchObject({
      aboard: false,
      rowing: false,
      x: MOORING.x,
      y: MOORING.y,
      heading: MOORING.heading,
    });
    expect(game.anglerAt()).toBe(HOME.angler);
    expect(game.landing()).toBe(HOME.landAt);
    expect(game.bodies.boatX).toBeCloseTo(MOORING.x, 4);
    expect(game.bodies.boatY).toBeCloseTo(MOORING.y, 4);
    expect(game.bodies.boatHeld).toBe(true);
    expect(checkInvariants(game)).toEqual([]);
  });

  describe('row refuses, and changes nothing, for', () => {
    /** The game as the boat sees it, to compare a refusal against. */
    const looks = (game: Game) =>
      JSON.stringify([game.boat, game.lure.phase, game.bite.phase, game.place, game.splashes.count]);
    const refuses = (game: Game, x: number, y: number, told: string[] = []) => {
      const before = looks(game);
      expect(game.row(x, y)).toBe(false);
      expect(looks(game)).toBe(before);
      expect(told).toEqual([]);
    };

    it('a lake with no boat', () => {
      const { game, told } = boatGame(1, null, { ...HOME, boat: null });
      refuses(game, 0, -5, told);
      expect(game.land()).toBe(false);
    });

    it('away from the pond: in the cabin, yawning, and leaving', () => {
      const cabin = boatGame();
      expect(cabin.game.enter()).toBe(true);
      refuses(cabin.game, 0, -5, cabin.told);
      const yawning = boatGame();
      expect(yawning.game.sleep()).toBe(true);
      refuses(yawning.game, 0, -5, yawning.told);
      const leaving = boatGame();
      expect(leaving.game.travel('reservoir')).toBe(true);
      expect(leaving.game.place).toBe('leaving');
      refuses(leaving.game, 0, -5, leaving.told);
    });

    it('a fish hooked or landed', () => {
      const hooked = hookedGame(1).game;
      refuses(hooked, 0, -5);
      const landed = landedGame().game;
      refuses(landed, 0, -5);
    });

    it('a row under way', () => {
      const { game, told } = boatGame();
      expect(game.row(0, -5)).toBe(true);
      expect(game.boat.rowing).toBe(true);
      told.length = 0;
      refuses(game, 4, -8, told);
      expect(game.land()).toBe(false);
    });

    it('a point that is not a number', () => {
      const { game, told } = boatGame();
      for (const [x, y] of [
        [NaN, -5],
        [0, NaN],
        [Infinity, 0],
        [0, -Infinity],
        ['3', -5],
        [undefined, -5],
        [null, 0],
      ] as unknown as [number, number][])
        refuses(game, x, y, told);
    });

    it('a point off the water, at the shore’s edge, within the keep-off of it, in a boulder and on the jetty', () => {
      const { game, told } = anchoredAt(0, -5);
      told.length = 0;
      const deck = HOME.jetty!.deck;
      const b = HOME.boulders[1];
      for (const [x, y] of [
        [0, SOUTH - 5],
        [0, SOUTH],
        [0, SOUTH + 1],
        [0, SOUTH + BOAT.keepOff - 0.1],
        [b.x, b.y],
        [b.x + b.radius + BOAT.keepOff - 0.1, b.y],
        [deck.x + deck.inward[0] * 6, deck.y + deck.inward[1] * 6],
        [
          deck.x + deck.inward[0] * (HOME.jetty!.spec.length + BOAT.keepOff - 0.2),
          deck.y + deck.inward[1] * (HOME.jetty!.spec.length + BOAT.keepOff - 0.2),
        ],
      ])
        refuses(game, x, y, told);
      // and one just inside the margin is rowed to
      expect(game.row(0, SOUTH + BOAT.keepOff + 0.1)).toBe(true);
    });

    it('a line that crosses the jetty’s deck, to a point on clear water beyond it', () => {
      const { game, told } = boatGame();
      const deck = HOME.jetty!.deck;
      // start on one side of the deck and ask for the other: both ends clear, the line across the planks
      const at = (inward: number, along: number) =>
        [
          deck.x + deck.inward[0] * inward + deck.along[0] * along,
          deck.y + deck.inward[1] * inward + deck.along[1] * along,
        ] as const;
      const [ax, ay] = at(12, 6),
        [zx, zy] = at(12, -6);
      expect(HOME.inside(ax, ay, BOAT.keepOff)).toBe(true);
      expect(HOME.inside(zx, zy, BOAT.keepOff)).toBe(true);
      // the boat is put there by a save, as a player would have rowed round to it
      const aboard = boatGame(1, JSON.stringify({ boat: { x: ax, y: ay, heading: 0 } }));
      expect(aboard.game.boat.aboard).toBe(true);
      refuses(aboard.game, zx, zy, aboard.told);
      expect(told).toEqual([]);
      expect(game.boat.aboard).toBe(false);
    });
  });

  describe('a row', () => {
    it('boards the player, reels the lure in and lets the reel go', () => {
      const { game, told } = boatGame();
      game.cast(HOME.aim.angle, 0.5);
      settle(game, 120);
      expect(game.lure.phase).toBe('sinking');
      game.reel(true);
      expect(game.row(0, -5)).toBe(true);
      expect(game.boat).toMatchObject({ aboard: true, rowing: true });
      expect(game.lure.phase).toBe('ready');
      expect(game.reeling).toBe(false);
      expect(game.bodies.held).toBe(true);
      expect(told).toEqual(['rowed 0.00,-5.00']);
    });

    it('lets a coming fish go, as the yawn does', () => {
      for (let seed = 1; seed <= 8; seed++) {
        const { game } = boatGame(seed);
        game.cast(HOME.aim.angle, 0.6);
        for (let f = 0; f < 3600 && game.bite.phase === 'none'; f++) game.step(DT);
        if (game.bite.phase === 'none') continue;
        expect(['coming', 'nibbling', 'biting']).toContain(game.bite.phase);
        expect(game.row(0, -5)).toBe(true);
        expect(game.bite.phase, `seed ${seed}`).toBe('none');
        expect(game.fish.held, `seed ${seed}`).toBe(-1);
        return;
      }
      throw new Error('no seed had a fish come');
    });

    it('moves along the line at the boat’s speed, heading along it, and anchors at the end, told and saved', () => {
      const { game, told, store } = boatGame();
      const [tx, ty] = [0, -5];
      const length = Math.hypot(tx - MOORING.x, ty - MOORING.y);
      expect(game.row(tx, ty)).toBe(true);
      const heading = Math.atan2(ty - MOORING.y, tx - MOORING.x);
      expect(game.boat.heading).toBe(heading);
      for (let f = 1; f <= 120; f++) {
        game.step(DT);
        const gone = Math.hypot(game.boat.x - MOORING.x, game.boat.y - MOORING.y);
        expect(gone, `frame ${f}`).toBeCloseTo(BOAT.speed * f * DT, 6);
        // on the line the whole way, and the body with it
        expect(game.bodies.boatX).toBeCloseTo(game.boat.x, 3);
        expect(game.bodies.boatY).toBeCloseTo(game.boat.y, 3);
        expect(checkInvariants(game), `frame ${f}`).toEqual([]);
      }
      expect(game.boat.rowing).toBe(true);
      expect(told).toEqual(['rowed 0.00,-5.00']);
      // a row under way is not saved, whatever writes the save meanwhile: a load lands at the last anchorage
      game.persist();
      expect(saved(store)).toBeNull();
      arrive(game);
      expect(game.boat).toMatchObject({ x: tx, y: ty, heading, aboard: true, rowing: false });
      expect(told).toEqual(['rowed 0.00,-5.00', 'anchored 0.00,-5.00']);
      expect(game.t).toBeCloseTo(length / BOAT.speed, 1);
      expect(saved(store)).toEqual({ x: tx, y: ty, heading, anchored: true });
    });

    it('goes on from an anchorage to another, the save keeping the last anchorage while under way', () => {
      const { game, store } = anchoredAt(0, -5);
      expect(game.row(-10, 6)).toBe(true);
      game.persist();
      expect(saved(store)).toEqual({
        x: 0,
        y: -5,
        heading: Math.atan2(-5 - MOORING.y, 0 - MOORING.x),
        anchored: true,
      });
      arrive(game);
      expect(saved(store)).toEqual({ x: -10, y: 6, heading: Math.atan2(11, -10), anchored: true });
    });

    it('reads back from the save: aboard at the anchorage, anchored, fishing from there', () => {
      const { game, store } = anchoredAt(0, -5);
      const { game: again } = newGame(2, store.json);
      expect(again.boat).toMatchObject({ aboard: true, rowing: false, x: 0, y: -5 });
      expect(again.anglerAt()).toEqual(game.anglerAt());
      expect(again.bodies.boatX).toBeCloseTo(0, 4);
      expect(checkInvariants(again)).toEqual([]);
    });

    it('rows at the Reservoir from its mooring to its spot, and lands again', () => {
      const lake = RESERVOIR;
      const { mooring, spot } = lake.boat!;
      const { game, told } = boatGame(1, null, lake);
      expect([game.boat.x, game.boat.y]).toEqual([mooring.x, mooring.y]);
      expect(game.row(spot[0], spot[1])).toBe(true);
      arrive(game);
      expect([game.boat.x, game.boat.y]).toEqual([spot[0], spot[1]]);
      expect(game.land()).toBe(true);
      arrive(game);
      expect(game.boat).toMatchObject({ aboard: false, x: mooring.x, y: mooring.y });
      expect(told.map((t) => t.split(' ')[0])).toEqual(['rowed', 'anchored', 'rowed', 'ashore']);
      expect(game.progress.entry(lake.id).boat).toBeNull();
    });
  });

  describe('land', () => {
    it('is refused ashore', () => {
      const { game, told } = boatGame();
      expect(game.land()).toBe(false);
      expect(told).toEqual([]);
    });

    it('is refused with a fish hooked or landed, and away from the pond', () => {
      const { game } = anchoredAt(0, -5);
      game.fish.held = 0;
      game.bite.phase = 'landed';
      expect(game.land()).toBe(false);
      game.bite.phase = 'none';
      game.fish.held = -1;
      expect(game.sleep()).toBe(false);
    });

    it('rows the boat to the mooring and steps off, told and saved', () => {
      const { game, told, store } = anchoredAt(0, -5);
      told.length = 0;
      expect(game.land()).toBe(true);
      expect(game.boat).toMatchObject({ aboard: true, rowing: true });
      expect(told).toEqual([`rowed ${MOORING.x.toFixed(2)},${MOORING.y.toFixed(2)}`]);
      expect(game.land(), 'not while rowing').toBe(false);
      arrive(game);
      expect(game.boat).toMatchObject({
        aboard: false,
        rowing: false,
        x: MOORING.x,
        y: MOORING.y,
        heading: MOORING.heading,
      });
      expect(told.at(-1)).toBe('ashore');
      expect(saved(store)).toBeNull();
      expect(game.anglerAt()).toBe(HOME.angler);
      expect(game.landing()).toBe(HOME.landAt);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('is refused when the straight way home crosses what the boat keeps off, and allowed once the player has rowed round', () => {
      // anchored behind the boulder at (16, -12) from the mooring on the far side of the pond
      const [x, y] = [12, -16];
      expect(HOME.inside(x, y, BOAT.keepOff)).toBe(true);
      expect(rowPath(HOME, x, y, MOORING.x, MOORING.y)).toBe(false);
      const { game, told } = boatGame(1, JSON.stringify({ boat: { x, y, heading: 0 } }));
      expect(game.boat.aboard).toBe(true);
      expect(game.land()).toBe(false);
      expect(game.boat).toMatchObject({ aboard: true, rowing: false, x, y });
      expect(told).toEqual([]);
      expect(game.row(0, -5)).toBe(true);
      arrive(game);
      expect(game.land()).toBe(true);
    });
  });

  describe('aboard', () => {
    it('is a cast thrown from the seat’s tip, and flies and lands from there', () => {
      const { game } = anchoredAt(0, -5);
      const stand = { ...game.anglerAt() };
      // north-west, off the pond's current, which would carry the bobber away from where the flight lands it
      expect(game.cast(NORTH + 0.5, 0.5)).toBe(true);
      expect([...game.lure.at]).toEqual(rodTip(HOME, stand));
      const f = flight(NORTH + 0.5, 0.5, HOME, [0, 0], stand);
      for (let i = 0; i < 400 && game.lure.phase === 'flying'; i++) game.step(DT);
      expect(game.lure.phase).toBe('sinking');
      expect(game.lure.bobber[0]).toBeCloseTo(f.landing[0], 6);
      expect(game.lure.bobber[1]).toBeCloseTo(f.landing[1], 6);
      expect(f.landing[1]).toBeGreaterThan(stand.y);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('has the ready line hung from the seat’s tip, not the shore’s', () => {
      const { game } = anchoredAt(0, -5);
      game.step(DT);
      const tip = rodTip(HOME, game.anglerAt());
      expect(game.lineEnd[0]).toBeCloseTo(tip[0], 9);
      expect(game.lineEnd[1]).toBeCloseTo(tip[1], 9);
      expect(Math.abs(game.lineEnd[1] - HOME.angler.y)).toBeGreaterThan(5);
    });

    it('lands a fish beside the seat: the fight starts from the landing and ends at it', () => {
      for (let seed = 1; seed <= 12; seed++) {
        const { game } = anchoredAt(0, -5, seed);
        const stand = { ...game.anglerAt() };
        const near = [...Array(game.fish.count).keys()]
          .filter((i) => !game.fish.cured[i])
          .sort(
            (a, b) =>
              Math.hypot(game.fish.x[a] - 0, game.fish.y[a] - 5) - Math.hypot(game.fish.x[b] - 0, game.fish.y[b] - 5),
          )[0];
        const { angle, power } = aimAt(game.fish.x[near], game.fish.y[near], HOME, [0, 0], stand);
        game.cast(angle, power);
        for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
        if (game.bite.phase !== 'biting') continue;
        expect(game.strike()).toBe('hooked');
        const landing = [...game.landing()];
        expect(landing).toEqual([...landingAboard(game.boat)]);
        expect(Math.hypot(landing[0] - HOME.landAt[0], landing[1] - HOME.landAt[1])).toBeGreaterThan(5);
        const i = game.bite.fish;
        expect(game.line.out).toBeCloseTo(Math.hypot(game.fish.x[i] - landing[0], game.fish.y[i] - landing[1]), 6);
        for (let f = 0; f < 180 * 60 && (game.bite.phase as string) === 'hooked'; f++) {
          const l = game.line;
          game.reel(careful(l.zone, l.zoneSpeed, l.fishAt, l.figures.width));
          game.step(DT);
          expect(checkInvariants(game)).toEqual([]);
        }
        if ((game.bite.phase as string) !== 'landed') continue;
        // the landed fish hangs from the rod at the seat, and was brought in to the water beside it
        expect(Math.hypot(game.fish.x[i] - landing[0], game.fish.y[i] - landing[1])).toBeLessThan(2);
        expect(game.stow()).toBe(true);
        // and the cured fish is let go near the boat, on the water
        const x = game.fish.x[i],
          y = game.fish.y[i];
        expect(HOME.inside(x, y, RELEASE.margin)).toBe(true);
        expect(Math.hypot(x - stand.x, y - stand.y)).toBeGreaterThanOrEqual(RELEASE.distance - 1e-9);
        expect(Math.hypot(x - stand.x, y - stand.y)).toBeLessThan(RELEASE.distance + RELEASE.steps * RELEASE.step);
        return;
      }
      throw new Error('no seed landed a fish from the boat');
    });

    it('lets a cured fish go RELEASE.distance toward the middle from the seat, on the water, with a splash', () => {
      const { game } = anchoredAt(0, -10);
      const stand = { ...game.anglerAt() };
      const splashed: number[][] = [];
      const again = new Game(game.progress, {
        lake: HOME,
        random: seeded(3),
        events: { splashed: (x, y, s) => splashed.push([x, y, s]) },
      });
      expect(again.boat.aboard).toBe(true);
      const seat = { ...again.anglerAt() };
      expect(seat.x).toBeCloseTo(stand.x, 9);
      again.bite.phase = 'landed';
      again.bite.fish = 0;
      again.fish.held = 0;
      again.lure.phase = 'hooked';
      again.fish.x[0] = 20;
      again.fish.y[0] = 25;
      again.stow();
      const [x, y] = [again.fish.x[0], again.fish.y[0]];
      expect(HOME.inside(x, y, RELEASE.margin)).toBe(true);
      expect(Math.hypot(x - seat.x, y - seat.y)).toBeCloseTo(RELEASE.distance, 9);
      expect(y, 'toward the middle').toBeGreaterThan(seat.y);
      expect(splashed.at(-1)).toEqual([x, y, RELEASE.splash]);
    });

    it('refuses cast, strike, drop and dropNear while rowing, and enter, travel and sleep while rowing and while anchored', () => {
      const { game } = boatGame();
      expect(game.row(0, -5)).toBe(true);
      const looks = () => JSON.stringify([game.lure.phase, game.splashes.count, game.place, game.boat.aboard]);
      const before = looks();
      expect(game.cast(NORTH, 0.5)).toBe(false);
      expect(game.strike()).toBe('none');
      expect(game.drop(0, 0)).toBe(false);
      expect(game.dropNear(0, 0)).toBe(false);
      expect(game.enter()).toBe(false);
      expect(game.travel('reservoir')).toBe(false);
      expect(game.travel(HOME.id)).toBe(false);
      expect(game.sleep()).toBe(false);
      expect(game.sleepThrough(2)).toBe(false);
      expect(looks()).toBe(before);
      arrive(game);
      // anchored, the pebble and the cast are allowed again; the cabin, the journey and bed are not, until landed
      expect(game.dropNear(0, 0)).toBe(true);
      expect(game.enter()).toBe(false);
      expect(game.travel('reservoir')).toBe(false);
      expect(game.sleep()).toBe(false);
      expect(game.place).toBe('pond');
      expect(game.land()).toBe(true);
      arrive(game);
      expect(game.travel('reservoir')).toBe(true);
    });

    it('does not draw the chance a refused pebble would have, so a refusal moves nothing', () => {
      const a = boatGame(5).game,
        b = boatGame(5).game;
      a.row(0, -5);
      b.row(0, -5);
      a.dropNear(0, 0);
      expect(a.random()).toBe(b.random());
    });
  });

  describe('the day’s end', () => {
    /** A hair before midnight, with the player aboard at an anchorage or ashore. */
    function lateAt(json: string | null) {
      const made = boatGame(1, json);
      made.game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
      return made;
    }

    it('waits for a row, as it waits for a fish, and yawns at the anchoring', () => {
      const { game } = lateAt(null);
      expect(game.row(-20, -5)).toBe(true);
      game.step(DT);
      expect(game.timeOfDay).toBeLessThan(0.01);
      for (let f = 0; f < 60 && game.boat.rowing; f++) {
        game.step(DT);
        expect(game.place, `frame ${f}`).toBe('pond');
      }
      expect(game.boat.rowing).toBe(true);
      arrive(game);
      // the yawn comes on the step the boat anchors, or the next
      game.step(DT);
      expect(game.place).toBe('yawning');
      expect(game.boat.aboard).toBe(true);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('wakes ashore at the mooring, the save’s boat cleared, from the anchorage', () => {
      const { game, store } = lateAt(JSON.stringify({ boat: { x: 0, y: -5, heading: 0 } }));
      expect(game.boat.aboard).toBe(true);
      game.step(DT);
      expect(game.place).toBe('yawning');
      expect(game.boat.aboard).toBe(true);
      sleepThrough(game);
      expect(game.place).toBe('cabin');
      expect(game.boat).toMatchObject({
        aboard: false,
        rowing: false,
        x: MOORING.x,
        y: MOORING.y,
        heading: MOORING.heading,
      });
      expect(saved(store)).toBeNull();
      expect(game.anglerAt()).toBe(HOME.angler);
      expect(game.out()).toBe(true);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('wakes ashore after a row ended in the yawn too', () => {
      const { game, store } = lateAt(null);
      game.row(-20, -5);
      arrive(game);
      game.step(DT);
      sleepThrough(game);
      expect(game.boat.aboard).toBe(false);
      expect(saved(store)).toBeNull();
    });
  });
});

describe('the boat adrift (`docs/boat.md`, C3)', () => {
  const MOORING = HOME.boat!.mooring;
  const NORTH = Math.PI / 2;
  const [WX, WY] = WEATHER.wind.direction;
  /** What a steady push is divided by to give the drift it settles at, measured (the floor's drag and the settling's). */
  const TEN = 10;

  /** Every fish cured and every drum hauled, so nothing bites and the save agrees with the pond. */
  const CLEAN = JSON.stringify({
    cured: 12,
    journal: {
      bream: { caught: 4, best: 0.85, first: 1 },
      perch: { caught: 5, best: 1.9, first: 1 },
      pike: { caught: 3, best: 3.1, first: 1 },
    },
  });

  /** A game at the pond with the boat's events kept in order, and (unless a save is handed in) no fish to bite. */
  function adriftGame(seed = 1, json: string | null = CLEAN, lake: Lake = HOME) {
    const told: string[] = [];
    const store = memoryStore(json);
    const game = new Game(new Progress(store, LAKES), {
      lake,
      random: seeded(seed),
      events: {
        rowed: () => told.push('rowed'),
        anchored: (x, y) => told.push(`anchored ${x.toFixed(2)},${y.toFixed(2)}`),
        adrift: () => told.push('adrift'),
        ashore: () => told.push('ashore'),
      },
    });
    return { game, told, store };
  }

  /** Step until the boat is no longer rowing. */
  function arrive(game: Game) {
    for (let f = 0; f < 90 * 60 && game.boat.rowing; f++) game.step(DT);
    expect(game.boat.rowing).toBe(false);
  }

  /** The game anchored at (x, y), aboard. */
  function anchoredAt(x: number, y: number, seed = 1, json: string | null = CLEAN) {
    const made = adriftGame(seed, json);
    expect(made.game.row(x, y)).toBe(true);
    arrive(made.game);
    return made;
  }

  /** The distance a point has gone along the wind's direction from (x0, y0). */
  const downwind = (x: number, y: number, x0: number, y0: number) => (x - x0) * WX + (y - y0) * WY;

  const saved = (store: { json: string | null }) => (JSON.parse(store.json!) as Save).lakes[HOME.id].boat;

  /** A cast from the game's stand that lands on the water, stepped until it sinks. */
  function sinking(game: Game, angle = game.boat.aboard ? NORTH + 0.5 : HOME.aim.angle - 0.5, power = 0.5) {
    expect(game.cast(angle, power)).toBe(true);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(game.lure.phase).toBe('sinking');
  }

  /** The bobber put on the water at (x, y), free and sinking, as a cast landing there would leave it. */
  function bobberAt(game: Game, x: number, y: number) {
    sinking(game);
    game.lure.bobber[0] = x;
    game.lure.bobber[1] = y;
    game.bodies.drop(x, y);
  }

  describe('anchor refuses, and changes nothing, for', () => {
    const looks = (game: Game) =>
      JSON.stringify([game.boat, game.lure.phase, game.bite.phase, game.place, game.bodies.boatHeld, game.levers]);
    const refuses = (game: Game, down: boolean, told: string[]) => {
      const before = looks(game);
      expect(game.anchor(down)).toBe(false);
      expect(looks(game)).toBe(before);
      expect(told).not.toContain('adrift');
    };

    it('a lake with no boat', () => {
      const { game, told } = adriftGame(1, CLEAN, { ...HOME, boat: null });
      refuses(game, false, told);
      refuses(game, true, told);
    });

    it('a player ashore', () => {
      const { game, told } = adriftGame();
      refuses(game, false, told);
      refuses(game, true, told);
    });

    it('a boat being rowed', () => {
      const { game, told } = adriftGame();
      expect(game.row(0, -5)).toBe(true);
      told.length = 0;
      refuses(game, false, told);
      refuses(game, true, told);
    });

    it('anywhere but the pond: the yawn, a journey', () => {
      const yawning = anchoredAt(0, -5);
      yawning.game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
      yawning.game.step(DT);
      expect(yawning.game.place).toBe('yawning');
      refuses(yawning.game, false, yawning.told);
      const leaving = anchoredAt(0, -5);
      leaving.game.boat.aboard = false;
      leaving.game.boat.x = MOORING.x;
      leaving.game.boat.y = MOORING.y;
      leaving.game.bodies.putBoat(MOORING.x, MOORING.y);
      expect(leaving.game.travel('reservoir')).toBe(true);
      refuses(leaving.game, false, leaving.told);
    });

    it('a photograph looked at', () => {
      const { game, told } = anchoredAt(0, -5);
      game.progress.save.photos.push({
        lake: HOME.id,
        day: 1,
        time: 0.4,
        weather: 'sunny',
        view: { x: 0, y: 0, z: 0, azimuth: 0, polar: 1, radius: 30 },
        kinds: [],
        lit: false,
      });
      expect(game.lookAt(0)).toBe(true);
      refuses(game, false, told);
    });

    it('the anchor already so, and a word that is not a boolean', () => {
      const { game, told } = anchoredAt(0, -5);
      refuses(game, true, told);
      expect(game.anchor(false)).toBe(true);
      told.length = 0;
      refuses(game, false, told);
      expect((game as unknown as { anchor(d: unknown): boolean }).anchor('yes')).toBe(false);
      expect((game as unknown as { anchor(d: unknown): boolean }).anchor(undefined)).toBe(false);
      expect(told).toEqual([]);
    });
  });

  describe('weighing and dropping the anchor', () => {
    it('lets the body go, tells it and saves it adrift', () => {
      const { game, told, store } = anchoredAt(0, -5);
      told.length = 0;
      expect(game.anchor(false)).toBe(true);
      expect(told).toEqual(['adrift']);
      expect(game.boat.anchored).toBe(false);
      expect(game.bodies.boatHeld).toBe(false);
      expect(saved(store)).toMatchObject({ x: 0, y: -5, anchored: false });
      expect(checkInvariants(game)).toEqual([]);
    });

    it('holds the body again where the boat has got to, tells it and saves it anchored', () => {
      const { game, told, store } = anchoredAt(0, -5);
      game.setWeather('wind');
      game.anchor(false);
      settle(game, 60 * 5);
      const { x, y } = game.boat;
      expect(Math.hypot(x, y + 5)).toBeGreaterThan(0.3);
      told.length = 0;
      expect(game.anchor(true)).toBe(true);
      expect(told).toEqual([`anchored ${x.toFixed(2)},${y.toFixed(2)}`]);
      expect(game.boat.anchored).toBe(true);
      expect(game.bodies.boatHeld).toBe(true);
      expect(saved(store)).toMatchObject({ x, y, anchored: true });
      settle(game, 60 * 5);
      expect([game.boat.x, game.boat.y]).toEqual([x, y]);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('is taken by a row from adrift: the body held, the anchor down, and the row made', () => {
      const { game } = anchoredAt(0, -5);
      game.anchor(false);
      expect(game.row(-10, 6)).toBe(true);
      expect(game.boat.anchored).toBe(true);
      expect(game.bodies.boatHeld).toBe(true);
      expect(checkInvariants(game)).toEqual([]);
      arrive(game);
      expect([game.boat.x, game.boat.y]).toEqual([-10, 6]);
      game.anchor(false);
      expect(game.land()).toBe(true);
      expect(game.bodies.boatHeld).toBe(true);
      arrive(game);
      expect(game.boat.aboard).toBe(false);
      expect(game.boat.anchored).toBe(true);
    });
  });

  describe('in the wind', () => {
    it('carries a weighed boat downwind at about the push over ten, and an anchored one not at all', () => {
      const { game } = anchoredAt(-10, -5);
      game.setWeather('wind');
      settle(game, 60 * 10);
      expect([game.boat.x, game.boat.y], 'anchored').toEqual([-10, -5]);
      game.anchor(false);
      settle(game, 60 * 10);
      const v = downwind(game.boat.x, game.boat.y, -10, -5) / 10;
      expect(v).toBeGreaterThan((DRIFT.wind.boat / TEN) * 0.7);
      expect(v).toBeLessThan((DRIFT.wind.boat / TEN) * 1.3);
      expect(game.boat.heading, 'it does not turn').toBe(Math.atan2(-5 - MOORING.y, -10 - MOORING.x));
      expect(Math.hypot(game.bodies.boatX - game.boat.x, game.bodies.boatY - game.boat.y)).toBeLessThan(1e-3);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('carries a free bobber downwind at about the push over ten, the rope’s end going with it', () => {
      const { game } = adriftGame();
      game.setWeather('wind');
      sinking(game);
      const [x0, y0] = [game.lure.bobber[0], game.lure.bobber[1]];
      settle(game, 60 * 10);
      const v = downwind(game.lure.bobber[0], game.lure.bobber[1], x0, y0) / 10;
      expect(v).toBeGreaterThan((DRIFT.wind.bobber / TEN) * 0.7);
      expect(v).toBeLessThan((DRIFT.wind.bobber / TEN) * 1.3);
      expect(game.lineEnd[0]).toBeCloseTo(game.bodies.x, 3);
      expect(game.lineEnd[1]).toBeCloseTo(game.bodies.y, 3);
      expect(game.lure.at[0]).toBe(game.lure.bobber[0]);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('blows nothing in the other weathers, and the bobber sleeps where it was cast', () => {
      for (const weather of ['sunny', 'rain', 'fog', 'shower']) {
        const { game } = adriftGame();
        game.setWeather(weather);
        sinking(game);
        const [x0, y0] = [game.lure.bobber[0], game.lure.bobber[1]];
        settle(game, 60 * 10);
        expect(Math.hypot(game.lure.bobber[0] - x0, game.lure.bobber[1] - y0), weather).toBeLessThan(1e-4);
        expect(game.bodies.asleep, weather).toBe(true);
      }
    });

    it('stops the drift when the wind drops, the drag stilling the body', () => {
      const { game } = anchoredAt(-10, -5);
      game.anchor(false);
      game.setWeather('wind');
      settle(game, 60 * 5);
      game.setWeather('sunny');
      settle(game, 60 * 3);
      const [x, y] = [game.boat.x, game.boat.y];
      settle(game, 60 * 5);
      expect(Math.hypot(game.boat.x - x, game.boat.y - y)).toBeLessThan(1e-3);
    });
  });

  describe('on a current', () => {
    const c = HOME.currents[0];
    const alongOf = (x: number, y: number) => (x - c.x) * Math.cos(c.heading) + (y - c.y) * Math.sin(c.heading);

    it('carries a bobber along it at about its speed within a second, and the rope’s end goes with it', () => {
      const { game } = adriftGame();
      bobberAt(game, c.x, c.y + 4);
      const start = alongOf(game.bodies.x, game.bodies.y);
      settle(game, 60);
      const gone = alongOf(game.bodies.x, game.bodies.y) - start;
      expect(gone, 'along the flow').toBeGreaterThan(c.speed * 0.4);
      expect(gone).toBeLessThan(c.speed * 1.2);
      const v1 = game.bodies.world.vy[game.bodies.bobber];
      expect(Math.abs(v1)).toBeGreaterThan(c.speed * 0.5);
      expect(game.lure.bobber[1]).toBeCloseTo(game.bodies.y, 3);
      expect(game.lineEnd[1]).toBeCloseTo(game.bodies.y, 3);
      settle(game, 60 * 5);
      expect(game.bodies.asleep).toBe(false);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('lifts the lure over the shallows as the bobber is carried, its depth following the bed', () => {
      const { game } = adriftGame();
      bobberAt(game, c.x, c.y + 6);
      settle(game, 60 * 3);
      const stopAt = () => Math.max(0, Math.min(5, HOME.bedDepth(game.lure.bobber[0], game.lure.bobber[1]) - 0.3));
      let moved = 0;
      for (let f = 0; f < 60 * 12; f++) {
        const [x, y] = [game.lure.bobber[0], game.lure.bobber[1]];
        game.step(DT);
        moved += Math.hypot(game.lure.bobber[0] - x, game.lure.bobber[1] - y);
        expect(game.lure.depth, `frame ${f}`).toBeLessThanOrEqual(stopAt() + 1e-9);
      }
      expect(moved).toBeGreaterThan(2);
    });

    it('carries a weighed boat too, and an anchored one not', () => {
      const { game } = anchoredAt(c.x, c.y + 4);
      settle(game, 60 * 4);
      expect(game.boat.y).toBe(c.y + 4);
      game.anchor(false);
      settle(game, 60 * 4);
      expect(game.boat.y).toBeLessThan(c.y + 4 - 0.5);
      expect(checkInvariants(game)).toEqual([]);
    });
  });

  describe('at the bank', () => {
    it('holds a bobber blown at the bank at least DRIFT.bank in, on the water, a minute and more', () => {
      const { game } = adriftGame();
      game.setWeather('wind');
      sinking(game);
      // start it where the wind has the bank within a minute: the middle, with the east shore some 30 units off
      bobberAt(game, 0, 0);
      let nearest = Infinity;
      for (let f = 0; f < 60 * 150; f++) {
        game.step(DT);
        expect(HOME.inside(game.bodies.x, game.bodies.y, DRIFT.bank), `frame ${f}`).toBe(true);
        expect(HOME.inside(game.lure.bobber[0], game.lure.bobber[1], DRIFT.bank), `frame ${f}`).toBe(true);
        nearest = Math.min(nearest, HOME.inward(game.bodies.x, game.bodies.y));
        if (f % 30 === 0) expect(checkInvariants(game), `frame ${f}`).toEqual([]);
      }
      // it got to the bank: it was blown for 150 s at 0.4 u/s, 60 units, further than the pond’s half width
      expect(Math.hypot(game.bodies.x, game.bodies.y)).toBeGreaterThan(15);
      expect(nearest).toBeGreaterThan(0);
    });

    it('holds a weighed boat blown at the bank at least BOAT.keepOff in, on the water, and keeps its heading', () => {
      const { game } = anchoredAt(0, 0);
      const heading = game.boat.heading;
      game.setWeather('wind');
      game.anchor(false);
      for (let f = 0; f < 60 * 240; f++) {
        game.step(DT);
        expect(HOME.inside(game.boat.x, game.boat.y, BOAT.keepOff), `frame ${f}`).toBe(true);
        if (f % 30 === 0) expect(checkInvariants(game), `frame ${f}`).toEqual([]);
      }
      expect(Math.hypot(game.boat.x, game.boat.y), 'it got to the bank').toBeGreaterThan(15);
      expect(game.boat.heading).toBe(heading);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('holds both, the boat with a cast out, drifting together', () => {
      const { game } = anchoredAt(0, 0);
      game.setWeather('wind');
      game.anchor(false);
      sinking(game, NORTH, 0.3);
      for (let f = 0; f < 60 * 200; f++) {
        game.step(DT);
        if (f % 30 === 0) expect(checkInvariants(game), `frame ${f}`).toEqual([]);
      }
      expect(HOME.inside(game.boat.x, game.boat.y, BOAT.keepOff)).toBe(true);
      expect(HOME.inside(game.bodies.x, game.bodies.y, DRIFT.bank)).toBe(true);
    });
  });

  describe('the reservoir', () => {
    it('weighs its boat by the dam and holds it on the water in the wind', () => {
      const { game } = adriftGame(1, null, RESERVOIR);
      expect(game.row(...RESERVOIR.boat!.spot)).toBe(true);
      arrive(game);
      expect(game.anchor(false)).toBe(true);
      game.setWeather('wind');
      for (let f = 0; f < 60 * 120; f++) {
        game.step(DT);
        if (f % 30 === 0) expect(checkInvariants(game), `frame ${f}`).toEqual([]);
      }
      expect(RESERVOIR.inside(game.boat.x, game.boat.y, BOAT.keepOff)).toBe(true);
    });
  });

  describe('the day’s end', () => {
    it('yawns with the boat adrift, and wakes ashore at the mooring, anchored, the body held', () => {
      const { game, store } = anchoredAt(0, -5);
      game.anchor(false);
      game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
      game.step(DT);
      expect(game.place).toBe('yawning');
      expect(game.boat).toMatchObject({ aboard: true, anchored: false });
      expect(checkInvariants(game)).toEqual([]);
      sleepThrough(game);
      expect(game.place).toBe('cabin');
      expect(game.boat).toMatchObject({ aboard: false, anchored: true, x: MOORING.x, y: MOORING.y });
      expect(game.bodies.boatHeld).toBe(true);
      expect(saved(store)).toBeNull();
      expect(game.out()).toBe(true);
      settle(game, 60 * 5);
      expect(checkInvariants(game)).toEqual([]);
    });
  });

  describe('a fish on the line', () => {
    it('is fought from a seat that drifts, neither refusing the anchor nor refused by it', () => {
      let tried = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const { game } = anchoredAt(0, -5, seed, null);
        // cast toward the middle, where the fish are, and wait for a bite
        game.cast(NORTH, 0.35);
        for (let f = 0; f < 3600 && game.bite.phase !== 'biting'; f++) game.step(DT);
        if (game.bite.phase !== 'biting' || game.strike() !== 'hooked') continue;
        tried++;
        game.setWeather('wind');
        expect(game.anchor(false)).toBe(true);
        const [x0, y0] = [game.boat.x, game.boat.y];
        for (let f = 0; f < 60 * 6 && (game.bite.phase as string) === 'hooked'; f++) {
          game.reel(f % 40 < 20);
          game.step(DT);
          expect(checkInvariants(game), `seed ${seed} frame ${f}`).toEqual([]);
        }
        expect(Math.hypot(game.boat.x - x0, game.boat.y - y0), `seed ${seed}`).toBeGreaterThan(0.05);
        expect(game.anchor(true)).toBe(true);
        expect(game.anchor(false)).toBe(true);
        expect(checkInvariants(game)).toEqual([]);
      }
      expect(tried, 'some seed hooked a fish').toBeGreaterThan(0);
    });
  });
});

describe('the snags (`docs/boat.md`, C4)', () => {
  /** The south-east bed, the one the shore's view sees. */
  const SE = 2;
  const NORTH = Math.PI / 2;
  /** Every fish cured, so nothing bites and a test of the reeds is about the reeds alone. */
  const CLEAN = JSON.stringify({
    cured: 12,
    journal: {
      bream: { caught: 4, best: 0.85, first: 1 },
      perch: { caught: 5, best: 1.9, first: 1 },
      pike: { caught: 3, best: 3.1, first: 1 },
    },
  });

  /** A game at the pond with what it tells of the snags kept in order. */
  function reeded(seed = 1, json: string | null = CLEAN, lake: Lake = HOME) {
    const told: string[] = [];
    const game = new Game(new Progress(memoryStore(json), LAKES), {
      lake,
      random: seeded(seed),
      events: {
        snagged: (i) => told.push(`snagged ${i}`),
        freed: (i) => told.push(`freed ${i}`),
        missed: () => told.push('missed'),
      },
    });
    return { game, told };
  }

  /** Where a cast from the shore must land to fall `out` from bed `i`'s edge, on the angler's side of it. */
  function nearBed(game: Game, i: number, out: number): [number, number] {
    const s = game.lake.snags[i];
    const a = game.anglerAt();
    const d = Math.hypot(a.x - s.x, a.y - s.y);
    return [s.x + ((a.x - s.x) / d) * (s.radius + out), s.y + ((a.y - s.y) / d) * (s.radius + out)];
  }

  /** A cast thrown to land `out` from bed `i`'s edge. */
  function castAtBed(game: Game, i = SE, out = SNAG.reach / 2) {
    const [x, y] = nearBed(game, i, out);
    const { angle, power } = aimAt(x, y, game.lake, game.wind, game.anglerAt());
    expect(game.cast(angle, power)).toBe(true);
  }

  /** Stepped until the lure is no longer in the air. */
  function land(game: Game) {
    for (let f = 0; f < 600 && game.lure.phase === 'flying'; f++) game.step(DT);
  }

  /** A lure snagged on the south-east bed by a cast. */
  function snaggedGame(seed = 1, json: string | null = CLEAN) {
    const made = reeded(seed, json);
    castAtBed(made.game);
    land(made.game);
    expect(made.game.lure.phase).toBe('snagged');
    return made;
  }

  /** The rope's tension as `lineEnds` works it out (private, as the rope's tests read it). */
  const tensionOf = (game: Game) => (game as unknown as { lineEnds(): number }).lineEnds();

  /** The bobber put on the water at (x, y), free and sinking, as a drift would leave it. */
  function bobberAt(game: Game, x: number, y: number) {
    game.cast(game.boat.aboard ? NORTH + 0.5 : game.lake.aim.angle, 0.5);
    for (let f = 0; f < 600 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    expect(game.lure.phase).toBe('sinking');
    game.lure.bobber[0] = x;
    game.lure.bobber[1] = y;
    game.bodies.drop(x, y);
  }

  describe('a lure that lands in the reeds', () => {
    it('lands where it was aimed, within the bed’s reach', () => {
      const { game } = reeded();
      const [x, y] = nearBed(game, SE, SNAG.reach / 2);
      const { angle, power } = aimAt(x, y, game.lake, game.wind, game.anglerAt());
      const f = flight(angle, power, game.lake, game.wind, game.anglerAt()).landing;
      expect(snagGap(game.lake, f[0], f[1])).toBeLessThanOrEqual(SNAG.reach);
    });

    it('is snagged there, told, with its body taken, no fish at it, and the bite doing nothing with it', () => {
      const { game, told } = snaggedGame();
      expect(told).toEqual([`snagged ${SE}`]);
      expect(game.lure.snagged).toBe(SE);
      expect(game.bodies.held).toBe(true);
      expect(game.bite.phase).toBe('none');
      expect(game.tugging).toBe(0);
      expect(snagGap(game.lake, game.lure.bobber[0], game.lure.bobber[1])).toBeLessThanOrEqual(SNAG.reach);
      expect(checkInvariants(game)).toEqual([]);
      for (let f = 0; f < 60 * 20; f++) {
        game.step(DT);
        if (f % 30 === 0) expect(checkInvariants(game), `frame ${f}`).toEqual([]);
      }
      expect(game.lure.phase).toBe('snagged');
      expect(game.bite.phase).toBe('none');
      expect(told).toEqual([`snagged ${SE}`]);
    });

    it('is not snagged on a cast that lands clear of every bed', () => {
      const { game, told } = reeded();
      game.cast(HOME.aim.angle, 0.58);
      land(game);
      expect(game.lure.phase).toBe('sinking');
      expect(told).toEqual([]);
    });

    it('is snagged in the other beds too, and in the reservoir’s', () => {
      for (const i of [0, 1]) {
        const { game } = reeded();
        // bed 0 and 1 are out of reach of a cast: a lure dropped sinking beside them is the same snag
        bobberAt(game, game.lake.snags[i].x + game.lake.snags[i].radius + SNAG.reach / 2, game.lake.snags[i].y);
        game.step(DT);
        expect(game.lure.phase, `bed ${i}`).toBe('snagged');
        expect(game.lure.snagged).toBe(i);
      }
      const { game } = reeded(1, null, RESERVOIR);
      const s = RESERVOIR.snags[1];
      bobberAt(game, s.x + s.radius + SNAG.reach / 2, s.y);
      game.step(DT);
      expect(game.lure.phase).toBe('snagged');
      expect(game.lure.snagged).toBe(1);
    });

    it('lets go a fish that was coming, as a reel-in does, and the bite is none', () => {
      const { game, told } = reeded(1, null);
      const s = game.lake.snags[SE];
      bobberAt(game, s.x - s.radius - 1.5, s.y);
      game.bite.stowed(game.fish);
      game.fish.x[0] = game.lure.bobber[0] - 3;
      game.fish.y[0] = game.lure.bobber[1];
      game.fish.depth[0] = game.lure.depth;
      game.bite.phase = 'coming';
      game.bite.fish = game.fish.held = 0;
      // the wind carries it the last of the way
      game.lure.bobber[0] = s.x - s.radius - SNAG.reach / 2;
      game.bodies.drop(game.lure.bobber[0], game.lure.bobber[1]);
      game.step(DT);
      expect(game.lure.phase).toBe('snagged');
      expect(game.bite.phase).toBe('none');
      expect(game.fish.held).toBe(-1);
      expect(told).toContain('missed');
      expect(game.bite.wary[0]).toBeGreaterThan(game.t);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('lets go a fish that was nibbling or biting just the same', () => {
      for (const phase of ['nibbling', 'biting'] as const) {
        const { game } = reeded(1, null);
        const s = game.lake.snags[SE];
        bobberAt(game, s.x - s.radius - 1.5, s.y);
        game.bite.stowed(game.fish);
        game.fish.x[0] = game.lure.bobber[0];
        game.fish.y[0] = game.lure.bobber[1];
        game.fish.depth[0] = game.lure.depth;
        game.bite.phase = phase;
        game.bite.fish = game.fish.held = 0;
        game.lure.bobber[0] = s.x - s.radius - SNAG.reach / 2;
        game.bodies.drop(game.lure.bobber[0], game.lure.bobber[1]);
        game.step(DT);
        expect(game.lure.phase, phase).toBe('snagged');
        expect(game.bite.phase, phase).toBe('none');
        expect(game.strike(), phase).toBe('none');
      }
    });

    it('is snagged by a bobber the wind blows into a bed', () => {
      const { game, told } = reeded();
      const s = game.lake.snags[SE];
      game.setWeather('wind');
      // upwind of the bed, along the wind's own line, a couple of units clear of its edge
      const [wx, wy] = WEATHER.wind.direction;
      const x = s.x - wx * (s.radius + 2.5),
        y = s.y - wy * (s.radius + 2.5);
      expect(game.lake.inside(x, y, 1)).toBe(true);
      bobberAt(game, x, y);
      for (let f = 0; f < 60 * 90 && game.lure.phase === 'sinking'; f++) {
        game.step(DT);
        if (f % 60 === 0) expect(checkInvariants(game), `frame ${f}`).toEqual([]);
      }
      expect(game.lure.phase).toBe('snagged');
      expect(told).toEqual([`snagged ${SE}`]);
      expect(game.bodies.held).toBe(true);
      expect(checkInvariants(game)).toEqual([]);
    });
  });

  describe('a tug and a give', () => {
    it('counts the time the reel is held on the snag, and holds nothing else', () => {
      const { game } = snaggedGame();
      game.reel(true);
      for (let f = 0; f < 30; f++) game.step(DT);
      expect(game.tugging).toBeCloseTo(0.5, 6);
      expect(game.lure.phase).toBe('snagged');
      expect(checkInvariants(game)).toEqual([]);
    });

    it('frees the lure at a give after the tug: sinking about `drop` out from the edge, on the water, told, splashed', () => {
      const { game, told } = snaggedGame();
      const splashes = game.splashes.count;
      game.reel(true);
      for (let f = 0; f < Math.ceil(SNAG.tug / DT) + 1; f++) game.step(DT);
      expect(game.lure.phase).toBe('snagged');
      game.reel(false);
      game.step(DT);
      expect(told).toEqual([`snagged ${SE}`, `freed ${SE}`]);
      expect(game.lure.phase).toBe('sinking');
      expect(game.lure.snagged).toBe(-1);
      expect(game.tugging).toBe(0);
      const s = game.lake.snags[SE];
      const gap = Math.hypot(game.lure.bobber[0] - s.x, game.lure.bobber[1] - s.y) - s.radius;
      expect(gap).toBeGreaterThan(SNAG.drop - 0.1);
      expect(gap).toBeLessThan(SNAG.drop + 0.5);
      expect(game.lake.inside(game.lure.bobber[0], game.lure.bobber[1])).toBe(true);
      expect(game.bodies.held).toBe(false);
      expect(game.splashes.count).toBe(splashes + 1);
      expect(checkInvariants(game)).toEqual([]);
      // and it sinks on, unsnagged, as any lure does
      for (let f = 0; f < 120; f++) game.step(DT);
      expect(game.lure.phase).toBe('sinking');
      expect(game.lure.depth).toBeGreaterThan(0);
    });

    it('resolves the give at the let-go itself, before any step, so no frame holds a tug with the reel let go', () => {
      const { game, told } = snaggedGame();
      game.reel(true);
      for (let f = 0; f < Math.ceil(SNAG.tug / DT) + 1; f++) game.step(DT);
      game.reel(false);
      expect(told).toEqual([`snagged ${SE}`, `freed ${SE}`]);
      expect(game.lure.phase).toBe('sinking');
      expect(game.tugging).toBe(0);
      expect(checkInvariants(game)).toEqual([]);
      // and a short tug is forgotten at the let-go too
      const short = snaggedGame().game;
      short.reel(true);
      short.step(DT);
      short.reel(false);
      expect(short.tugging).toBe(0);
      expect(short.lure.phase).toBe('snagged');
      expect(checkInvariants(short)).toEqual([]);
    });

    it('does nothing for a tug shorter than the tug, and starts the count again', () => {
      const { game, told } = snaggedGame();
      game.reel(true);
      for (let f = 0; f < Math.floor(SNAG.tug / DT) - 3; f++) game.step(DT);
      expect(game.tugging).toBeGreaterThan(0);
      expect(game.tugging).toBeLessThan(SNAG.tug);
      game.reel(false);
      game.step(DT);
      expect(game.lure.phase).toBe('snagged');
      expect(game.tugging).toBe(0);
      expect(told).toEqual([`snagged ${SE}`]);
      // a second short tug is not added to the first
      game.reel(true);
      for (let f = 0; f < Math.floor(SNAG.tug / DT) - 3; f++) game.step(DT);
      game.reel(false);
      game.step(DT);
      expect(game.lure.phase).toBe('snagged');
      expect(checkInvariants(game)).toEqual([]);
    });

    it('is not freed by holding the reel for ever: the give is the let go', () => {
      const { game } = snaggedGame();
      game.reel(true);
      for (let f = 0; f < 60 * 10; f++) game.step(DT);
      expect(game.lure.phase).toBe('snagged');
      expect(game.tugging).toBeGreaterThan(SNAG.tug);
    });

    it('can be snagged again by the lure that was freed, if it is cast back or drifts in', () => {
      const { game, told } = snaggedGame();
      game.reel(true);
      for (let f = 0; f < Math.ceil(SNAG.tug / DT) + 1; f++) game.step(DT);
      game.reel(false);
      game.step(DT);
      expect(game.lure.phase).toBe('sinking');
      // put it back by the edge, as a push of the wind would
      const s = game.lake.snags[SE];
      game.lure.bobber[0] = s.x - s.radius - 0.2;
      game.lure.bobber[1] = s.y;
      game.bodies.drop(game.lure.bobber[0], game.lure.bobber[1]);
      game.step(DT);
      expect(game.lure.phase).toBe('snagged');
      expect(told.filter((l) => l.startsWith('snagged'))).toHaveLength(2);
    });
  });

  describe('while snagged', () => {
    it('a strike is none, a cast and a reel-in are refused, and nothing changes', () => {
      const { game, told } = snaggedGame();
      const looks = () =>
        JSON.stringify([game.lure.phase, game.lure.snagged, game.lure.bobber, game.bodies.held, game.t]);
      const before = looks();
      expect(game.strike()).toBe('none');
      expect(game.cast(NORTH, 0.5)).toBe(false);
      expect(game.reelIn()).toBe(false);
      expect(looks()).toBe(before);
      expect(game.lure.phase).toBe('snagged');
      expect(told).toEqual([`snagged ${SE}`]);
    });

    it('a row reels it in by force, and the boat sets off', () => {
      const { game } = snaggedGame();
      expect(game.row(0, -5)).toBe(true);
      expect(game.lure.phase).toBe('ready');
      expect(game.lure.snagged).toBe(-1);
      expect(game.bodies.held).toBe(true);
      expect(game.tugging).toBe(0);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('the yawn reels it in by force, nothing lost', () => {
      const { game } = snaggedGame();
      game.reel(true);
      game.step(DT);
      game.setTimeOfDay(1 - 0.5 / CLOCK.daySeconds / 60);
      game.step(DT);
      expect(game.place).toBe('yawning');
      expect(game.lure.phase).toBe('ready');
      expect(game.lure.snagged).toBe(-1);
      expect(game.reeling).toBe(false);
      expect(game.tugging).toBe(0);
      expect(checkInvariants(game)).toEqual([]);
    });

    it('a journey and a walk into the cabin reel it in by force', () => {
      const a = snaggedGame().game;
      expect(a.travel('reservoir')).toBe(true);
      expect(a.lure.phase).toBe('ready');
      expect(a.lure.snagged).toBe(-1);
      const b = snaggedGame().game;
      expect(b.enter()).toBe(true);
      expect(b.lure.phase).toBe('ready');
      expect(b.lure.snagged).toBe(-1);
      expect(b.bodies.held).toBe(true);
      expect(checkInvariants(b)).toEqual([]);
    });

    it('a cast can be thrown again once it is freed', () => {
      const { game } = snaggedGame();
      game.reel(true);
      for (let f = 0; f < Math.ceil(SNAG.tug / DT) + 1; f++) game.step(DT);
      game.reel(false);
      game.step(DT);
      expect(game.cast(NORTH, 0.5)).toBe(true);
      expect(game.lure.phase).toBe('flying');
    });
  });

  describe('the line’s tension', () => {
    it('is the snag’s while tugging, and calm otherwise', () => {
      const { game } = snaggedGame();
      expect(tensionOf(game)).toBe(0);
      game.reel(true);
      game.step(DT);
      expect(tensionOf(game)).toBe(SNAG.tension);
      game.reel(false);
      // the give frees it on the next step, but a short tug that is let go is calm again at once
      expect(tensionOf(game)).toBe(0);
    });

    it('draws the rope tauter while tugged than while calm, to the bobber on the surface', () => {
      const { game } = snaggedGame();
      for (let f = 0; f < 120; f++) game.step(DT);
      const calm = game.rope.points.slice();
      game.reel(true);
      for (let f = 0; f < 30; f++) game.step(DT);
      expect(game.lineEnd[0]).toBe(game.lure.bobber[0]);
      expect(game.lineEnd[1]).toBe(game.lure.bobber[1]);
      expect(game.lineEnd[2]).toBeGreaterThan(-0.2);
      expect(Array.from(game.rope.points)).not.toEqual(Array.from(calm));
    });
  });
});
