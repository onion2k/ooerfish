/** A fish and the lure: noticed, come to, nibbled, bitten, and struck inside the window or not. */
import { describe, expect, it } from 'vitest';
import { flight } from '../src/cast';
import { Game } from '../src/game';
import { FISHING } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT } from './helpers';

const NORTH = Math.PI / 2;

/** How hard a cast due north lands nearest the middle of the lake, from the flight's own sums. */
function powerToMiddle(): number {
  let best = 0,
    gap = Infinity;
  for (let p = 1; p <= 200; p++) {
    const f = flight(NORTH, p / 200);
    const g = Math.hypot(f.landing[0], f.landing[1]);
    if (g < gap) [best, gap] = [p / 200, g];
  }
  return best;
}
const MIDDLE = powerToMiddle();

/** A lake from a seed, with what it tells kept as lines. */
function lake(seed = 1) {
  const told: string[] = [];
  const game = new Game(new Progress(memoryStore()), {
    random: seeded(seed),
    events: {
      nibbled: () => told.push(`nibbled ${game.t.toFixed(2)}`),
      bitten: () => told.push(`bitten ${game.t.toFixed(2)}`),
      hooked: () => told.push('hooked'),
      missed: () => told.push('missed'),
    },
  });
  return { game, told };
}

/** Steps until `done` says so, at most `seconds`; the frames it took, or -1. */
function until(game: Game, done: () => boolean, seconds: number): number {
  for (let f = 0; f < seconds / DT; f++) {
    if (done()) return f;
    game.step(DT);
  }
  return done() ? Math.round(seconds / DT) : -1;
}

describe('a fish and the lure', () => {
  it('comes, nibbles and bites a lure sunk in the middle of the lake within a minute, on every seed', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { game, told } = lake(seed);
      game.cast(NORTH, MIDDLE);
      const took = until(game, () => game.bite.phase === 'biting', 60);
      expect(took, `seed ${seed}: a bite within a minute`).toBeGreaterThanOrEqual(0);
      // it came first, then nibbled once to three times, then bit
      const nibbles = told.filter((l) => l.startsWith('nibbled')).length;
      expect(nibbles, `seed ${seed}`).toBeGreaterThanOrEqual(FISHING.nibbles[0]);
      expect(nibbles, `seed ${seed}`).toBeLessThanOrEqual(FISHING.nibbles[1]);
      expect(told.at(-1)).toMatch(/^bitten/);
      // and the fish biting is at the lure
      const i = game.bite.fish;
      const gap = Math.hypot(game.fish.x[i] - game.lure.bobber[0], game.fish.y[i] - game.lure.bobber[1]);
      expect(gap, `seed ${seed}: the biting fish at the lure`).toBeLessThan(FISHING.mouth + 0.2);
    }
  });

  it('never bites a lure on the bank, in the air or on the rod', () => {
    const { game } = lake(2);
    expect(
      until(game, () => game.bite.phase !== 'none', 30),
      'on the rod',
    ).toBe(-1);
    game.cast(-NORTH, 0.6);
    expect(
      until(game, () => game.bite.phase !== 'none', 60),
      'on the bank',
    ).toBe(-1);
    expect(game.lure.phase).toBe('lying');
  });

  it('lets one fish come at a time, however many are near, and the rest swim on', () => {
    const { game } = lake(3);
    game.cast(NORTH, MIDDLE);
    until(game, () => game.lure.phase === 'sinking', 5);
    // every fish put right by the lure
    for (let i = 0; i < game.fish.count; i++) {
      game.fish.x[i] = game.lure.bobber[0] + (i - 2.5) * 0.8;
      game.fish.y[i] = game.lure.bobber[1] + 1.5;
    }
    until(game, () => game.bite.phase !== 'none', 30);
    expect(game.bite.phase).not.toBe('none');
    expect(game.fish.held).toBe(game.bite.fish);
    const others = Array.from({ length: game.fish.count }, (_, i) => i).filter((i) => i !== game.bite.fish);
    const before = others.map((i) => game.fish.x[i]);
    game.step(DT * 30);
    expect(
      others.some((i, k) => game.fish.x[i] !== before[k]),
      'the others swim on',
    ).toBe(true);
  });

  it('opens a window of its length to the frame, hooked by a strike inside it', () => {
    const { game, told } = lake(4);
    game.cast(NORTH, MIDDLE);
    until(game, () => game.bite.phase === 'biting', 60);
    const frames = until(game, () => game.bite.phase !== 'biting', 5);
    expect(frames).toBe(Math.round(FISHING.window / DT));
    expect(told.at(-1), 'let go once the window shut').toBe('missed');
    // and a fresh bite struck just before its window shuts is hooked
    const again = lake(4);
    again.game.cast(NORTH, MIDDLE);
    until(again.game, () => again.game.bite.phase === 'biting', 60);
    for (let f = 0; f < Math.round(FISHING.window / DT) - 2; f++) again.game.step(DT);
    expect(again.game.strike()).toBe('hooked');
    expect(again.game.bite.phase).toBe('hooked');
    expect(again.told.at(-1)).toBe('hooked');
  });

  it('is not hooked by a strike while it only nibbles: it lets go, wary, and swims off', () => {
    const { game, told } = lake(5);
    game.cast(NORTH, MIDDLE);
    until(game, () => game.bite.phase === 'nibbling', 60);
    const i = game.bite.fish;
    expect(game.strike()).toBe('spooked');
    expect(game.bite.phase).toBe('none');
    expect(game.fish.held).toBe(-1);
    expect(told.at(-1)).toBe('missed');
    // it does not come straight back
    expect(until(game, () => game.bite.phase !== 'none' && game.bite.fish === i, FISHING.wary - 1)).toBe(-1);
  });

  it('lets go when the lure is reeled in or a pebble splashes by it', () => {
    for (const how of ['reel', 'pebble'] as const) {
      const { game } = lake(6);
      game.cast(NORTH, MIDDLE);
      until(game, () => game.bite.phase === 'coming', 60);
      if (how === 'reel') game.reelIn();
      else game.drop(game.lure.bobber[0] + 1, game.lure.bobber[1]);
      expect(game.bite.phase, how).toBe('none');
      expect(game.fish.held, how).toBe(-1);
    }
  });

  it('is drawn in sooner by a twitch of the lure: a strike with no fish at it', () => {
    // over many seeds, how many have a fish notice the lure within half a second of its landing, twitched or not
    const noticed = (twitching: boolean) => {
      let n = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const { game } = lake(seed);
        game.cast(NORTH, MIDDLE);
        until(game, () => game.lure.phase === 'sinking', 5);
        if (twitching) expect(game.strike()).toBe('twitch');
        if (until(game, () => game.bite.phase !== 'none', 0.5) >= 0) n++;
      }
      return n;
    };
    const plain = noticed(false),
      twitched = noticed(true);
    expect(twitched, `${twitched} seeds twitched against ${plain}`).toBeGreaterThan(plain * 1.6);
  });

  it('does nothing to a strike with the lure out of the water', () => {
    const { game } = lake(7);
    expect(game.strike()).toBe('none');
    game.cast(-NORTH, 0.6);
    until(game, () => game.lure.phase === 'lying', 5);
    expect(game.strike()).toBe('none');
  });

  it('is the same from the same seed', () => {
    const run = () => {
      const { game, told } = lake(8);
      game.cast(NORTH, MIDDLE);
      until(game, () => game.bite.phase === 'biting', 60);
      return told.join('|');
    };
    expect(run()).toBe(run());
  });
});
