/** Travel and the wake at home (`docs/lakes.md`, part 6): the game's side of a journey, with no page to reload. */
import { describe, expect, it } from 'vitest';
import { Game, type GameEvents } from '../src/game';
import { CLOCK, NIGHT } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, settle } from './helpers';

/** A game at the lake the save names, over a save in memory that knows every lake. */
function at(save: object, events: GameEvents = {}, arrives = false) {
  const store = memoryStore(JSON.stringify(save));
  const progress = new Progress(store, LAKES);
  const lake = LAKES[progress.save.lake];
  const game = new Game(progress, { lake, random: seeded(4), events, arrives });
  return { game, progress, store };
}

describe('travel', () => {
  it('refuses a lake the game does not know, and changes nothing', () => {
    const { game, progress } = at({});
    expect(game.travel('nowhere')).toBe(false);
    expect(game.place).toBe('pond');
    expect(progress.save.lake).toBe(HOME.id);
  });

  it('is nothing, and true, to the lake the player is at, when at the pond', () => {
    const { game } = at({});
    expect(game.travel(HOME.id)).toBe(true);
    expect(game.place).toBe('pond');
    expect(game.fade()).toBe(0);
  });

  it('goes out from the cabin, as the button does, to the lake the player is at', () => {
    const { game } = at({ place: 'cabin', day: 3 });
    expect(game.travel(HOME.id)).toBe(true);
    expect(game.place).toBe('pond');
  });

  it('is refused with a fish hooked or landed', () => {
    const { game, progress } = at({});
    game.bite.phase = 'hooked';
    expect(game.travel('reservoir')).toBe(false);
    game.bite.phase = 'landed';
    expect(game.travel('reservoir')).toBe(false);
    expect(game.place).toBe('pond');
    expect(progress.save.lake).toBe(HOME.id);
  });

  it('writes the save for the new lake at the pond with the clock as it is, reels the lure in, and fades out', () => {
    const events: string[] = [];
    const { game, progress, store } = at({ time: 0.4 }, { left: (id) => events.push(id) });
    settle(game, 30);
    game.cast(0, 0.5);
    expect(game.lure.phase).not.toBe('ready');
    const clock = game.timeOfDay;
    expect(game.travel('reservoir')).toBe(true);
    expect(game.place).toBe('leaving');
    expect(game.lure.phase).toBe('ready');
    expect(progress.save.lake).toBe('reservoir');
    expect(progress.save.place).toBe('pond');
    expect(progress.save.time).toBe(clock);
    expect((JSON.parse(store.load()!) as { lake: string }).lake).toBe('reservoir');
    // the fade rises over `NIGHT.fadeOut` of stepped time and the clock, the lake and the casting hold
    expect(game.fade()).toBe(0);
    const t = game.t;
    const frames = Math.round(NIGHT.fadeOut / DT);
    settle(game, Math.round(frames / 2));
    expect(game.fade()).toBeCloseTo(0.5, 1);
    expect(events).toEqual([]);
    expect(game.cast(0, 0.5)).toBe(false);
    settle(game, frames);
    expect(game.fade()).toBe(1);
    expect(events, 'told once, however long the fade is stepped').toEqual(['reservoir']);
    expect(game.t).toBe(t);
    expect(game.timeOfDay).toBe(clock);
    expect(progress.save.time).toBe(clock);
  });

  it('is refused while it is already leaving, and while yawning', () => {
    const { game } = at({});
    game.travel('reservoir');
    expect(game.travel('duckpond')).toBe(false);
    expect(game.sleep()).toBe(false);
    const other = at({}).game;
    other.sleep();
    expect(other.travel('reservoir')).toBe(false);
  });
});

describe('a load fades in', () => {
  it('begins at full at the pond and falls to clear over the fade-in, when the page says it has arrived', () => {
    const { game } = at({}, {}, true);
    expect(game.place).toBe('pond');
    expect(game.fade()).toBe(1);
    settle(game, Math.round(NIGHT.fadeIn / DT / 2));
    expect(game.fade()).toBeCloseTo(0.5, 1);
    settle(game, Math.round(NIGHT.fadeIn / DT));
    expect(game.fade()).toBe(0);
    settle(game, 30);
    expect(game.fade()).toBe(0);
  });

  it('is clear at once in a game that did not arrive, as every test and the fuzzer play', () => {
    expect(at({}).game.fade()).toBe(0);
  });

  it('can be let go, for a test that wants the pond as it was', () => {
    const { game } = at({}, {}, true);
    game.arrived();
    expect(game.fade()).toBe(0);
  });

  it('does not come back when the player goes out of the cabin', () => {
    const { game } = at({ place: 'cabin' }, {}, true);
    expect(game.fade()).toBe(1);
    game.out();
    expect(game.fade()).toBe(0);
    settle(game, 10);
    expect(game.fade()).toBe(0);
  });
});

describe('the wake at home', () => {
  it('from the Reservoir lands in the save at the home, in the cabin, on the next day', () => {
    const events: number[] = [];
    const { game, progress } = at(
      { lake: 'reservoir', time: 0.999, day: 1, place: 'pond' },
      { woke: (d) => events.push(d) },
    );
    expect(game.lake.id).toBe('reservoir');
    settle(game, Math.round((NIGHT.fadeOut + 1) / DT));
    expect(game.place).toBe('cabin');
    expect(events).toEqual([2]);
    expect(progress.save.lake).toBe(HOME.id);
    expect(progress.save.place).toBe('cabin');
    expect(progress.save.day).toBe(2);
    expect(progress.save.time).toBe(CLOCK.startsAt);
  });

  it('at the home leaves the save at the home, as it was', () => {
    const { game, progress } = at({ time: 0.999 });
    settle(game, Math.round((NIGHT.fadeOut + 1) / DT));
    expect(game.place).toBe('cabin');
    expect(progress.save.lake).toBe(HOME.id);
  });
});
