/** The fight: the line's tension and length under the reel and the fish, the slip, and the landing and the bucket. */
import { describe, expect, it } from 'vitest';
import { flight } from '../src/cast';
import { Game } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { FIGHT, PERCH } from '../src/lake';
import { Line } from '../src/line';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { DT } from './helpers';

const NORTH = Math.PI / 2;
let MIDDLE = 0;
{
  let gap = Infinity;
  for (let p = 1; p <= 200; p++) {
    const f = flight(NORTH, p / 200);
    const g = Math.hypot(f.landing[0], f.landing[1]);
    if (g < gap) [MIDDLE, gap] = [p / 200, g];
  }
}

describe('the line', () => {
  it('is wound in and drawn tighter by the reel, and let out and eased when the reel is let go', () => {
    const line = new Line();
    line.start(30, seeded(1));
    line.pulling = true;
    line.timer = 100;
    line.tension = 0.5;
    line.step(0.1, true, 0, seeded(2));
    expect(line.tension).toBeGreaterThan(0.5);
    expect(line.out).toBeLessThan(30);
    const out = line.out,
      tension = line.tension;
    line.step(0.1, false, 0, seeded(2));
    expect(line.tension).toBeLessThan(tension);
    expect(line.out, 'a pulling fish takes line').toBeGreaterThan(out);
  });

  it('is drawn tighter by a pulling fish than a resting one', () => {
    const rise = (pulling: boolean) => {
      const line = new Line();
      line.start(30, seeded(1));
      line.pulling = pulling;
      line.timer = 100;
      line.tension = 0.2;
      line.step(0.25, true, 0, seeded(1));
      return line.tension - 0.2;
    };
    expect(rise(true)).toBeGreaterThan(rise(false) * 2);
  });

  it('is pulled on more often by a sick lake’s fish than a clean one’s', () => {
    const pulling = (hot: number) => {
      const line = new Line(),
        random = seeded(3);
      line.start(1e6, random);
      let n = 0;
      for (let f = 0; f < 600 / DT; f++) {
        line.step(DT, false, hot, random);
        if (line.pulling) n++;
      }
      return n;
    };
    expect(pulling(1)).toBeGreaterThan(pulling(0) * 1.2);
  });

  it('slips once it has been as tight as it goes for the slip time, and not a frame before', () => {
    const line = new Line();
    line.start(30, seeded(1));
    line.tension = 1;
    line.pulling = true;
    line.timer = 100;
    let frames = 0;
    while (line.step(DT, true, 0, seeded(1)) === 'fighting') frames++;
    expect(frames + 1).toBe(Math.round(FIGHT.slip / DT));
    expect(line.step(DT, true, 0, seeded(1))).toBe('slipped');
  });

  it('is never slack below nought, never longer than the spool, whatever the reel does', () => {
    const line = new Line(),
      random = seeded(9);
    line.start(FIGHT.spool - 1, random);
    for (let f = 0; f < 20000; f++) {
      if (line.step(DT, random() < 0.5, random(), random) !== 'fighting') line.start(FIGHT.spool - 1, random);
      expect(line.tension).toBeGreaterThanOrEqual(0);
      expect(line.tension).toBeLessThanOrEqual(1);
      expect(line.out).toBeLessThanOrEqual(FIGHT.spool);
    }
  });
});

/** A lake whose fish has just been hooked, from a seed. */
function hooked(seed = 1) {
  const told: string[] = [];
  const game = new Game(new Progress(memoryStore()), {
    random: seeded(seed),
    events: {
      hooked: () => told.push('hooked'),
      slipped: () => told.push('slipped'),
      landed: (kind, weight) => told.push(`landed ${kind} ${weight}`),
    },
  });
  game.cast(NORTH, MIDDLE);
  for (let f = 0; f < 60 / DT && game.bite.phase !== 'biting'; f++) game.step(DT);
  expect(game.strike()).toBe('hooked');
  // everything holds from the moment of the strike, before any step
  expect(checkInvariants(game)).toEqual([]);
  return { game, told };
}

/** Plays the fish by the simplest rule: reel while the line is slacker than `under`, let go once it is tighter. */
function play(game: Game, under: number, seconds = 120) {
  let reeling = false;
  for (let f = 0; f < seconds / DT && game.bite.phase === 'hooked'; f++) {
    if (game.line.tension < under * 0.6) reeling = true;
    if (game.line.tension > under) reeling = false;
    game.reel(reeling);
    game.step(DT);
  }
  game.reel(false);
}

describe('the fight', () => {
  it('lands a fish played by a careful hand, once, with its kind and a weight, into the bucket', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game, told } = hooked(seed);
      expect(game.lure.phase).toBe('hooked');
      play(game, 0.8);
      expect(game.bite.phase, `seed ${seed}`).toBe('landed');
      const landed = told.filter((l) => l.startsWith('landed'));
      expect(landed.length, `seed ${seed}: told once`).toBe(1);
      const [, , , w] = landed[0].split(' ');
      expect(landed[0]).toMatch(new RegExp(`^landed ${PERCH.name} `));
      expect(Number(w)).toBeGreaterThanOrEqual(PERCH.weight[0]);
      expect(Number(w)).toBeLessThanOrEqual(PERCH.weight[1]);
      // shown off, it waits by the rod; stowed, it is in the bucket and the lake has its fish still
      game.step(DT * 60);
      expect(game.bite.phase).toBe('landed');
      const count = game.fish.count;
      expect(game.stow()).toBe(true);
      expect(game.bucket).toBe(1);
      expect(game.fish.count).toBe(count);
      expect(game.bite.phase).toBe('none');
      expect(game.lure.phase).toBe('ready');
      expect(game.fish.held).toBe(-1);
      expect(game.stow(), 'nothing to stow twice').toBe(false);
    }
  });

  it('slips off with nothing lost when the line is held too tight, and the fish can be found again', () => {
    const { game, told } = hooked(2);
    const i = game.bite.fish;
    game.reel(true);
    for (let f = 0; f < 30 / DT && game.bite.phase === 'hooked'; f++) game.step(DT);
    game.reel(false);
    expect(told.at(-1)).toBe('slipped');
    expect(game.bite.phase).toBe('none');
    expect(game.fish.held).toBe(-1);
    // the lure sinks on where the fish was, ready to be bitten again
    expect(game.lure.phase).toBe('sinking');
    expect(game.bucket).toBe(0);
    let again = false;
    for (let f = 0; f < 120 / DT && !again; f++) {
      game.step(DT);
      if (game.bite.phase === 'biting') again = true;
    }
    expect(again, 'bitten again').toBe(true);
    expect(i).toBeGreaterThanOrEqual(0);
  });

  it('refuses a cast and does nothing to a reel-in while a fish is on, or waits to be stowed', () => {
    const { game } = hooked(3);
    expect(game.cast(NORTH, 0.5)).toBe(false);
    game.reelIn();
    expect(game.bite.phase).toBe('hooked');
    play(game, 0.8);
    expect(game.bite.phase).toBe('landed');
    expect(game.cast(NORTH, 0.5)).toBe(false);
    game.reelIn();
    expect(game.bite.phase).toBe('landed');
  });

  it('keeps the hooked fish in the water and draws it to the shallows below the angler', () => {
    const { game } = hooked(4);
    const i = game.bite.fish;
    let was = Math.hypot(game.fish.x[i] - FIGHT.landAt[0], game.fish.y[i] - FIGHT.landAt[1]);
    let reeling = false;
    for (let f = 0; f < 120 / DT && game.bite.phase === 'hooked'; f++) {
      if (game.line.tension < 0.45) reeling = true;
      if (game.line.tension > 0.75) reeling = false;
      game.reel(reeling);
      game.step(DT);
      if (f % 30 === 0) {
        expect(game.fish.depth[i], `frame ${f}`).toBeGreaterThan(0);
        // the lure is at the fish's mouth
        expect(Math.hypot(game.lure.at[0] - game.fish.x[i], game.lure.at[1] - game.fish.y[i])).toBeLessThan(1e-9);
      }
    }
    const now = Math.hypot(game.fish.x[i] - FIGHT.landAt[0], game.fish.y[i] - FIGHT.landAt[1]);
    expect(now).toBeLessThan(was);
    was = now;
    expect(game.bite.phase).toBe('landed');
  });

  it('is the same fight from the same seed', () => {
    const run = () => {
      const { game, told } = hooked(5);
      play(game, 0.8);
      return `${told.join('|')} ${game.t.toFixed(4)}`;
    };
    expect(run()).toBe(run());
  });
});
