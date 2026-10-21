/** Walking into the cabin by day (`docs/cabin-by-day.md`): the game's side of it, with no page. */
import { describe, expect, it } from 'vitest';
import { Game, type GameEvents } from '../src/game';
import { NIGHT } from '../src/lake';
import { HOME, LAKES } from '../src/lakes';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, newGame, settle } from './helpers';

function at(save: object, events: GameEvents = {}) {
  const store = memoryStore(JSON.stringify(save));
  const progress = new Progress(store, LAKES);
  const game = new Game(progress, { lake: LAKES[progress.save.lake], random: seeded(4), events });
  return { game, progress, store };
}

const saved = (store: { load(): string | null }) => JSON.parse(store.load()!) as Record<string, unknown>;

describe('Game.enter', () => {
  it('lands in the cabin with the clock, day, fish and heal where they were, the fade full', () => {
    const entered: number[] = [];
    const { game, store } = at({ day: 3, time: 0.6, cured: 2 }, { entered: () => entered.push(1) });
    game.arrived();
    settle(game, 30);
    const before = { t: game.timeOfDay, day: game.day, dirt: game.waterDirt, x: Array.from(game.fish.x) };
    expect(game.enter()).toBe(true);
    expect(entered).toEqual([1]);
    expect(game.place).toBe('cabin');
    expect(game.timeOfDay).toBe(before.t);
    expect(game.day).toBe(before.day);
    expect(game.waterDirt).toBe(before.dirt);
    expect(Array.from(game.fish.x)).toEqual(before.x);
    expect(game.fade()).toBe(1);
    expect(saved(store)).toMatchObject({ place: 'cabin', time: before.t, day: 3 });
    expect(checkInvariants(game)).toEqual([]);
  });

  it('fades in over NIGHT.fadeIn and holds everything else, at any time of the day', () => {
    const { game } = at({ time: 0.6 });
    game.arrived();
    game.enter();
    const t = game.t;
    const clock = game.timeOfDay;
    settle(game, Math.round(NIGHT.fadeIn / DT / 2));
    expect(game.fade()).toBeCloseTo(0.5, 1);
    settle(game, Math.round(NIGHT.fadeIn / DT) + 120);
    expect(game.fade()).toBe(0);
    expect(game.t).toBe(t);
    expect(game.timeOfDay).toBe(clock);
    expect(checkInvariants(game)).toEqual([]);
  });

  it('reels the lure in and lets the reel go', () => {
    const { game } = at({});
    game.arrived();
    settle(game, 30);
    game.cast(0, 0.5);
    game.reel(true);
    expect(game.lure.phase).not.toBe('ready');
    expect(game.enter()).toBe(true);
    expect(game.lure.phase).toBe('ready');
    expect(game.reeling).toBe(false);
  });

  it('goes out again at the time it held, the clock running on', () => {
    const { game } = at({ time: 0.6 });
    game.arrived();
    game.enter();
    settle(game, 120);
    expect(game.out()).toBe(true);
    expect(game.place).toBe('pond');
    expect(game.timeOfDay).toBe(0.6);
    settle(game, 60);
    expect(game.timeOfDay).toBeGreaterThan(0.6);
  });

  it('is refused with a fish hooked or landed', () => {
    for (const phase of ['hooked', 'landed'] as const) {
      const { game } = newGame();
      game.bite.phase = phase;
      expect(game.enter(), phase).toBe(false);
      expect(game.place).toBe('pond');
    }
  });

  it('is refused while yawning, leaving, in the cabin already, and with the yawn owed', () => {
    const yawning = newGame().game;
    yawning.sleep();
    expect(yawning.enter(), 'yawning').toBe(false);
    const leaving = at({}).game;
    leaving.travel('reservoir');
    expect(leaving.enter(), 'leaving').toBe(false);
    const cabin = at({ place: 'cabin' }).game;
    expect(cabin.enter(), 'in the cabin').toBe(false);
    const owed = newGame().game;
    owed.setTimeOfDay(0.9999);
    owed.bite.phase = 'hooked';
    for (let f = 0; f < 600 && owed.timeOfDay > 0.5; f++) owed.step(1);
    owed.bite.phase = 'none';
    expect(owed.enter(), 'midnight owed').toBe(false);
  });

  it('is refused at a lake with no cabin, and changes nothing', () => {
    const { game, store } = at({ lake: 'reservoir', time: 0.6 });
    const was = store.load();
    expect(game.lake.cabin).toBeNull();
    expect(game.enter()).toBe(false);
    expect(game.place).toBe('pond');
    expect(store.load(), 'nothing written').toBe(was);
  });
});

describe('a cabin save at a time of day', () => {
  it('loads in the cabin at the time it says', () => {
    const { game } = newGame(1, '{"day": 5, "time": 0.6, "place": "cabin"}');
    expect(game.place).toBe('cabin');
    expect(game.timeOfDay).toBe(0.6);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('travel into the cabin', () => {
  it('writes the destination place into the save for the journey', () => {
    const { game, progress, store } = at({ lake: 'reservoir', time: 0.6 });
    expect(game.travel(HOME.id, 'cabin')).toBe(true);
    expect(game.place).toBe('leaving');
    expect(progress.save.lake).toBe(HOME.id);
    expect(progress.save.place).toBe('cabin');
    expect(saved(store)).toMatchObject({ lake: HOME.id, place: 'cabin', time: 0.6 });
  });

  it('lands in the cabin at home with the clock as it was, after the reload', () => {
    const { store } = at({ lake: 'reservoir', time: 0.6 });
    const again = at({ lake: HOME.id, place: 'cabin', time: 0.6 });
    expect(again.game.place).toBe('cabin');
    expect(again.game.timeOfDay).toBe(0.6);
    expect(store).toBeDefined();
  });

  it('stays a journey to the pond when no place is given', () => {
    const { game, progress } = at({ lake: 'reservoir' });
    game.travel(HOME.id);
    expect(progress.save.place).toBe('pond');
  });

  it('enters at the lake the player is at, if it has a cabin', () => {
    const { game } = at({ time: 0.6 });
    game.arrived();
    expect(game.travel(HOME.id, 'cabin')).toBe(true);
    expect(game.place).toBe('cabin');
  });
});
