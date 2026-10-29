/** The contests' tally (`docs/contests.md`, part 1): what the game counts as it is played, and when a run is broken. */
import { describe, expect, it } from 'vitest';
import { flight } from '../src/cast';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT, castAtDrum, cureAll, newGame } from './helpers';

const NORTH = Math.PI / 2;

/** The power that lands a cast to the north nearest the middle of the pond, where the fish are. */
function middle(): number {
  let best = 0,
    gap = Infinity;
  for (let p = 1; p <= 200; p++) {
    const f = flight(NORTH, p / 200);
    const g = Math.hypot(f.landing[0], f.landing[1]);
    if (g < gap) [best, gap] = [p / 200, g];
  }
  return best;
}

/** A cast to the middle, stepped until a fish bites, and struck. */
function hook(game: Game) {
  expect(game.cast(NORTH, middle())).toBe(true);
  for (let f = 0; f < 60 * 300 && game.bite.phase !== 'biting'; f++) game.step(DT);
  expect(game.strike()).toBe('hooked');
}

/** The reel held and let go to keep the zone on the fish until it is landed. */
function land(game: Game) {
  for (let f = 0; f < 120 / DT && game.bite.phase === 'hooked'; f++) {
    const l = game.line;
    game.reel(l.zone + l.figures.width / 2 < l.fishAt);
    game.step(DT);
  }
  expect(game.bite.phase).toBe('landed');
}

/** A fish cast for, hooked, landed and put in the bucket. */
function catchOne(game: Game) {
  hook(game);
  land(game);
  expect(game.stow()).toBe(true);
}

/** The reel let go until the fish slips the line. */
function slip(game: Game) {
  hook(game);
  for (let f = 0; f < 120 / DT && game.bite.phase === 'hooked'; f++) {
    game.reel(false);
    game.step(DT);
  }
  expect(game.bite.phase).not.toBe('hooked');
  expect(game.bite.phase).not.toBe('landed');
}

const tally = (game: Game) => ({ ...game.progress.save.tally });
const clean = (game: Game) => expect(checkInvariants(game)).toEqual([]);

describe('the tally of the contests', () => {
  it('is nought at the start, and the first cast of a game wastes nothing', () => {
    const { game } = newGame(1);
    expect(tally(game)).toEqual({ rain: 0, run: 0, best: 0 });
    expect(game.cast(NORTH, middle())).toBe(true);
    expect(tally(game)).toEqual({ rain: 0, run: 0, best: 0 });
    clean(game);
  });

  it('counts a fish stowed in rain, and not one in a shower or in the sun', () => {
    for (const [weather, rain] of [
      ['rain', 1],
      ['shower', 0],
      ['sunny', 0],
    ] as const) {
      const { game } = newGame(1);
      expect(game.setWeather(weather)).toBe(true);
      catchOne(game);
      expect(tally(game).rain, weather).toBe(rain);
      clean(game);
    }
  });

  it('keeps a run of two stows on two casts, and the best of it', () => {
    const { game } = newGame(1);
    catchOne(game);
    expect(tally(game)).toMatchObject({ run: 1, best: 1 });
    catchOne(game);
    expect(tally(game)).toMatchObject({ run: 2, best: 2 });
    clean(game);
  });

  it('puts the run to nought at the cast after a lure reeled in empty, and the best holds', () => {
    const { game } = newGame(1);
    catchOne(game);
    catchOne(game);
    expect(game.cast(NORTH, middle())).toBe(true);
    game.reelIn();
    expect(tally(game), 'nothing changes until the next cast').toMatchObject({ run: 2, best: 2 });
    expect(game.cast(NORTH, middle())).toBe(true);
    expect(tally(game)).toMatchObject({ run: 0, best: 2 });
    clean(game);
  });

  it('puts the run to nought at the cast after a fish slips', () => {
    const { game } = newGame(1);
    catchOne(game);
    slip(game);
    expect(tally(game)).toMatchObject({ run: 1, best: 1 });
    expect(game.cast(NORTH, middle())).toBe(true);
    expect(tally(game)).toMatchObject({ run: 0, best: 1 });
    clean(game);
  });

  it('puts the run to nought at the cast after a drum is hauled, since its cast had no fish in it', () => {
    const { game } = newGame(1);
    catchOne(game);
    clean(game);
    // the pond cured on the school and not the save, so the drum is all that bites (the invariants are held to before it)
    cureAll(game);
    expect(castAtDrum(game, 0)).toBe(true);
    for (let f = 0; f < 60 * 120 && game.bite.phase !== 'biting'; f++) game.step(DT);
    expect(game.strike()).toBe('hooked');
    for (let f = 0; f < 60 * 60 && game.bite.phase === 'hooked'; f++) {
      game.reel(true);
      game.step(DT);
    }
    expect(game.haul()).toBe(true);
    expect(tally(game)).toMatchObject({ run: 1, best: 1 });
    expect(game.cast(NORTH, middle())).toBe(true);
    expect(tally(game)).toMatchObject({ run: 0, best: 1 });
  });

  it('puts the run to nought at the cast after a cast onto the bank, reeled in', () => {
    const { game } = newGame(1);
    catchOne(game);
    expect(game.cast(-NORTH, 0.5)).toBe(true);
    game.reelIn();
    expect(game.cast(NORTH, middle())).toBe(true);
    expect(tally(game)).toMatchObject({ run: 0, best: 1 });
    clean(game);
  });

  it('is not broken by a cure between casts, and a refused cast changes nothing', () => {
    const { game } = newGame(1);
    catchOne(game);
    hook(game);
    expect(game.cast(NORTH, middle()), 'refused with a fish on').toBe(false);
    expect(tally(game)).toMatchObject({ run: 1, best: 1 });
    land(game);
    expect(game.stow()).toBe(true);
    expect(tally(game)).toMatchObject({ run: 2, best: 2 });
    expect(game.cast(Number.NaN, 0.5)).toBe(false);
    expect(tally(game)).toMatchObject({ run: 2, best: 2 });
    clean(game);
  });

  it('is in the save written, and a load mid-run keeps it', () => {
    const { game, store } = newGame(1);
    catchOne(game);
    expect((JSON.parse(store.json!) as { tally: unknown }).tally).toEqual({ rain: 0, run: 1, best: 1 });
    const again = new Game(new Progress(memoryStore(store.json)), { random: seeded(1) });
    expect(tally(again)).toEqual({ rain: 0, run: 1, best: 1 });
    clean(again);
  });
});
