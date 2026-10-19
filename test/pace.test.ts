/** The pace gate: its angler, which fishes as a careful player does, and its arithmetic, which holds what it takes. */
import { describe, expect, it } from 'vitest';
import { Angler, PATIENCE, REACTION, careful } from '../src/angler';
import { aimAt } from '../src/cast';
import { FIGHT } from '../src/lake';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { median, moved, paceRun } from '../scripts/pace';
import { DT } from './helpers';

describe('the angler', () => {
  it('reels in a lure that has sunk a while with no fish at it, and casts again', () => {
    const game = new Game(new Progress(memoryStore()), { random: seeded(1) });
    // every fish cured, so nothing ever comes and only its patience can move the lure
    game.fish.cured.fill(1, 0, game.fish.count);
    const angler = new Angler(game, seeded(101));
    let casts = 0,
      was = game.lure.phase;
    for (let f = 0; f < (PATIENCE * 3 + 10) / DT; f++) {
      angler.step(DT);
      if (was !== 'flying' && game.lure.phase === 'flying') casts++;
      was = game.lure.phase;
    }
    expect(casts).toBeGreaterThanOrEqual(3);
  });

  it('casts, strikes only on a bite, plays the bar a reaction late, and stows what it lands', () => {
    const game = new Game(new Progress(memoryStore()), { random: seeded(1) });
    const angler = new Angler(game, seeded(101));
    let struckAtBite = 0,
      fought = 0,
      // what the fish was a reaction ago, which is all the angler may have seen when it chose
      ago: number[] = [];
    let late = 0,
      prompt = 0;
    for (let f = 0; f < 600 / DT && game.bucket < 2; f++) {
      const before = game.bite.phase;
      const { fishAt: now, zone, zoneSpeed: speed } = game.line;
      if (before === 'hooked') ago.push(now);
      else ago = [];
      const seen = ago.length > REACTION ? ago[ago.length - 1 - REACTION] : now;
      angler.step(DT);
      if (before === 'biting' && game.bite.phase === 'hooked') struckAtBite++;
      // a fish landed in the step is let go of by the game itself, so only a fight that goes on is counted
      if (before === 'hooked' && game.bite.phase === 'hooked') {
        fought++;
        if (game.reeling === careful(zone, speed, seen, game.line.figures.width)) late++;
        if (ago.length > REACTION && game.reeling !== careful(zone, speed, seen, game.line.figures.width)) prompt++;
      }
      if (f % 60 === 0) expect(checkInvariants(game)).toEqual([]);
    }
    expect(game.bucket, 'two fish landed and stowed').toBe(2);
    expect(struckAtBite).toBeGreaterThanOrEqual(2);
    // every hold it chose is the one the fish of a reaction ago called for, never one it could not yet have seen
    expect(fought).toBeGreaterThan(0);
    expect(late, 'chose by what it saw a reaction ago').toBe(fought);
    expect(prompt).toBe(0);
  });

  it('holds while the zone’s middle is below the fish, and lets go early as the zone rises fast', () => {
    expect(careful(0, 0, 0.9, FIGHT.width)).toBe(true);
    expect(careful(0.6, 0, 0.2, FIGHT.width)).toBe(false);
    const middle = FIGHT.width / 2;
    expect(careful(0.3, 0, 0.3 + middle + 0.05, FIGHT.width)).toBe(true);
    expect(careful(0.3, 1, 0.3 + middle + 0.05, FIGHT.width), 'rising fast, it lets go before it overshoots').toBe(
      false,
    );
  });

  it('casts again when its lure lies on the bank, and plays the same from the same seeds', () => {
    const run = () => {
      const game = new Game(new Progress(memoryStore()), { random: seeded(4) });
      const angler = new Angler(game, seeded(7));
      game.cast(-Math.PI / 2, 0.6);
      for (let f = 0; f < 240; f++) angler.step(DT);
      expect(game.lure.phase, 'off the bank and cast again').not.toBe('lying');
      for (let f = 0; f < 60 / DT; f++) angler.step(DT);
      return `${game.t} ${game.bucket} ${game.bite.phase} ${game.line.out}`;
    };
    expect(run()).toBe(run());
  });
});

describe('the pace gate', () => {
  it('takes the median, so one odd run does not move the figure', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 100])).toBe(2.5);
  });

  it('holds a figure both ways, quicker as much as slower', () => {
    expect(moved(10, 11)).toBe(false);
    expect(moved(10, 13)).toBe(true);
    expect(moved(10, 7)).toBe(true);
  });

  it('gives up at the cap, and says so', () => {
    const run = paceRun(1, 1_000_000, 0.05);
    expect(run.finished).toBe(false);
    expect(run.minutes).toBe(0.05);
  });

  it('lands the fish it is asked for, in game minutes', () => {
    const run = paceRun(1, 1, 5);
    expect(run.finished).toBe(true);
    expect(run.minutes).toBeGreaterThan(0);
    expect(run.minutes).toBeLessThan(5);
  });

  it('goes down from the cabin after a night and fishes on, day after day', () => {
    const game = new Game(new Progress(memoryStore()), { random: seeded(3) });
    const angler = new Angler(game, seeded(11));
    // a little before midnight, so the first yawn comes inside the run
    game.setTimeOfDay(0.99);
    let inCabin = 0;
    for (let f = 0; f < 60 * 60 * 25; f++) {
      if (game.place === 'cabin') inCabin++;
      angler.step(DT);
    }
    expect(game.day, 'at least two nights crossed').toBeGreaterThanOrEqual(3);
    expect(inCabin, 'it was in the cabin, and left it at once').toBeLessThanOrEqual(game.day);
    expect(game.place).not.toBe('cabin');
    expect(game.bucket, 'it kept fishing through the nights').toBeGreaterThan(0);
    expect(checkInvariants(game)).toEqual([]);
  });
});

describe('the angler and a drum on the bed', () => {
  it('does not strike at a drum’s heavy dip: it reels in and casts again, and never hooks one', () => {
    const game = new Game(new Progress(memoryStore('{"cured": 12}')), { random: seeded(1) });
    const angler = new Angler(game, seeded(101));
    // the lure lying on the bed by a drum, in a pond with no fish left to take the bait
    const { angle, power } = aimAt(game.drums.x[0], game.drums.y[0]);
    game.cast(angle, power);
    for (let f = 0; f < 60 * 30 && !game.lure.onBed; f++) game.step(DT);
    expect(game.lure.onBed).toBe(true);
    let dipped = 0,
      hooked = 0;
    for (let f = 0; f < 60 * 120; f++) {
      if (game.bite.phase === 'biting' && game.bite.drum >= 0) dipped++;
      angler.step(DT);
      if (game.bite.drum >= 0 && game.bite.phase !== 'biting') hooked++;
      expect(checkInvariants(game)).toEqual([]);
    }
    expect(dipped, 'a drum was snagged at least once').toBeGreaterThan(0);
    expect(hooked, 'but none was ever hooked').toBe(0);
    expect(game.bite.phase).not.toBe('hooked');
  });
});
