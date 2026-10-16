/** The fight: the zone, the fish on the bar and the meter between them, the slip, and the landing and the bucket. */
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

/** A line with its fish held still at `fishAt` on the bar, resting for as long as a test needs. */
function still(fishAt: number, zone = 0) {
  const line = new Line();
  line.start(30, 0, seeded(1));
  line.fishAt = fishAt;
  line.target = fishAt;
  line.pulling = false;
  line.timer = 1e6;
  line.zone = zone;
  line.zoneSpeed = 0;
  return line;
}

/** Whether the zone's middle is below the fish: the rule a careful hand plays by. */
const below = (line: Line) => line.zone + FIGHT.width / 2 < line.fishAt;

describe('the line', () => {
  it('starts with the meter part filled and the line out as far as the fish was hooked', () => {
    const line = new Line();
    line.start(30, 0.5, seeded(1));
    expect(line.meter).toBe(FIGHT.meterStart);
    expect(line.out).toBeCloseTo(30, 9);
    expect(line.heft).toBe(0.5);
    expect(line.zone).toBeGreaterThanOrEqual(0);
    expect(line.zone).toBeLessThanOrEqual(1 - FIGHT.width);
  });

  it('pushes the zone up while held, and lets it fall back once let go', () => {
    const line = still(0.5, 0.3);
    for (let f = 0; f < 20; f++) line.step(DT, true, 0, seeded(2));
    expect(line.zone).toBeGreaterThan(0.3);
    const top = line.zone;
    for (let f = 0; f < 60; f++) line.step(DT, false, 0, seeded(2));
    expect(line.zone).toBeLessThan(top);
  });

  it('fills the meter while the fish is in the zone and drains it while it is out, at the rates content gives', () => {
    const inside = still(FIGHT.width / 2);
    inside.step(0.1, false, 0, seeded(1));
    expect(inside.meter).toBeCloseTo(FIGHT.meterStart + FIGHT.fill * 0.1, 9);
    const outside = still(0.95);
    outside.step(0.1, false, 0, seeded(1));
    expect(outside.meter).toBeCloseTo(FIGHT.meterStart - FIGHT.drain * 0.1, 9);
  });

  it('lands the fish when the meter is full, and slips it when the meter is empty', () => {
    const full = still(FIGHT.width / 2);
    full.meter = 1 - FIGHT.fill * DT * 0.5;
    expect(full.step(DT, false, 0, seeded(1))).toBe('landed');
    const empty = still(0.95);
    empty.meter = FIGHT.drain * DT * 0.5;
    expect(empty.step(DT, false, 0, seeded(1))).toBe('slipped');
    const midway = still(0.95);
    expect(midway.step(DT, false, 0, seeded(1))).toBe('fighting');
  });

  it('draws the fish in along the line as the meter fills and lets it out as it drains, never past the spool', () => {
    const line = still(FIGHT.width / 2);
    const was = line.out;
    for (let f = 0; f < 60; f++) line.step(DT, false, 0, seeded(1));
    expect(line.out).toBeLessThan(was);
    expect(line.out).toBeCloseTo(30 * ((1 - line.meter) / (1 - FIGHT.meterStart)), 6);
    const far = new Line();
    far.start(FIGHT.spool, 0, seeded(1));
    far.meter = 0.01;
    far.step(DT, false, 0, seeded(1));
    expect(far.out).toBeLessThanOrEqual(FIGHT.spool);
  });

  it('is lost by a hand that never holds, and by one that holds the whole time', () => {
    for (const holding of [false, true])
      for (let seed = 1; seed <= 6; seed++) {
        const line = new Line(),
          random = seeded(seed);
        line.start(30, 0.5, random);
        let was = line.step(DT, holding, 0.5, random);
        for (let f = 0; f < 120 / DT && was === 'fighting'; f++) was = line.step(DT, holding, 0.5, random);
        expect(was, `seed ${seed}, ${holding ? 'held' : 'never held'}`).toBe('slipped');
      }
  });

  it('is landed by a hand that keeps the zone under the fish', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const line = new Line(),
        random = seeded(seed);
      line.start(30, 0.5, random);
      let was: string = 'fighting';
      for (let f = 0; f < 120 / DT && was === 'fighting'; f++) was = line.step(DT, below(line), 0.5, random);
      expect(was, `seed ${seed}`).toBe('landed');
    }
  });

  it('darts more often for a sick lake’s fish than a clean one’s', () => {
    const darts = (hot: number) => {
      const line = new Line(),
        random = seeded(3);
      line.start(30, 0, random);
      let n = 0,
        was = line.pulling;
      for (let f = 0; f < 600 / DT; f++) {
        line.meter = 0.5;
        line.step(DT, false, hot, random);
        if (line.pulling && !was) n++;
        was = line.pulling;
      }
      return n;
    };
    expect(darts(1)).toBeGreaterThan(darts(0) * 1.2);
  });

  it('darts faster for a heavy fish than a light one', () => {
    const fastest = (heft: number) => {
      const line = new Line(),
        random = seeded(4);
      line.start(30, heft, random);
      let most = 0;
      for (let f = 0; f < 120 / DT; f++) {
        line.meter = 0.5;
        const at = line.fishAt;
        line.step(DT, false, 0, random);
        most = Math.max(most, Math.abs(line.fishAt - at) / DT);
      }
      return most;
    };
    expect(fastest(1)).toBeGreaterThan(fastest(0) * 1.3);
  });

  it('is strained by how far the fish is out of the zone: calm inside, tighter the further out', () => {
    const inside = still(FIGHT.width / 2);
    inside.step(DT, false, 0, seeded(1));
    const near = still(FIGHT.width + 0.05);
    near.step(DT, false, 0, seeded(1));
    const far = still(0.95);
    far.step(DT, false, 0, seeded(1));
    expect(inside.tension).toBeCloseTo(FIGHT.calm, 9);
    expect(near.tension).toBeGreaterThan(inside.tension);
    expect(far.tension).toBeGreaterThan(near.tension);
  });

  it('keeps the zone, the fish and the meter on the bar and the tension from nought to one, whatever the hand does', () => {
    const line = new Line(),
      random = seeded(9);
    line.start(FIGHT.spool - 1, random(), random);
    for (let f = 0; f < 20000; f++) {
      if (line.step(DT, random() < 0.5, random(), random) !== 'fighting') line.start(FIGHT.spool - 1, random(), random);
      expect(line.zone).toBeGreaterThanOrEqual(0);
      expect(line.zone).toBeLessThanOrEqual(1 - FIGHT.width);
      expect(line.fishAt).toBeGreaterThanOrEqual(0);
      expect(line.fishAt).toBeLessThanOrEqual(1);
      expect(line.meter).toBeGreaterThanOrEqual(0);
      expect(line.meter).toBeLessThanOrEqual(1);
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

/** Plays the fish by the simplest careful rule: hold while the zone's middle is below the fish. */
function play(game: Game, seconds = 120) {
  for (let f = 0; f < seconds / DT && game.bite.phase === 'hooked'; f++) {
    game.reel(below(game.line));
    game.step(DT);
  }
  game.reel(false);
}

describe('the fight', () => {
  it('lands a fish played by a careful hand, once, with its kind and a weight, into the bucket', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game, told } = hooked(seed);
      expect(game.lure.phase).toBe('hooked');
      play(game);
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

  it('gives the line a heft from the fish’s weight, the lightest nought and the heaviest one', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { game } = hooked(seed);
      const share = (game.catchWeight - PERCH.weight[0]) / (PERCH.weight[1] - PERCH.weight[0]);
      expect(game.line.heft, `seed ${seed}`).toBeCloseTo(share, 9);
    }
  });

  it('slips off with nothing lost when the fish is let out of the zone, and the fish can be found again', () => {
    const { game, told } = hooked(2);
    const i = game.bite.fish;
    for (let f = 0; f < 60 / DT && game.bite.phase === 'hooked'; f++) game.step(DT);
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
    play(game);
    expect(game.bite.phase).toBe('landed');
    expect(game.cast(NORTH, 0.5)).toBe(false);
    game.reelIn();
    expect(game.bite.phase).toBe('landed');
  });

  it('keeps the hooked fish in the water, at the line’s length from the landing, and draws it in as the meter fills', () => {
    const { game } = hooked(4);
    const i = game.bite.fish;
    const from = () => Math.hypot(game.fish.x[i] - FIGHT.landAt[0], game.fish.y[i] - FIGHT.landAt[1]);
    const was = from();
    for (let f = 0; f < 120 / DT && game.bite.phase === 'hooked'; f++) {
      game.reel(below(game.line));
      game.step(DT);
      if (f % 30 === 0) {
        expect(game.fish.depth[i], `frame ${f}`).toBeGreaterThan(0);
        // the lure is at the fish's mouth
        expect(Math.hypot(game.lure.at[0] - game.fish.x[i], game.lure.at[1] - game.fish.y[i])).toBeLessThan(1e-9);
      }
      // the fish swims to keep to the line, a little behind it while it is drawn in
      if (f > 120 && f % 30 === 0) expect(Math.abs(from() - game.line.out), `frame ${f}`).toBeLessThan(3);
    }
    expect(game.bite.phase).toBe('landed');
    expect(from()).toBeLessThan(was);
    expect(from()).toBeLessThan(FIGHT.landWithin + 1.5);
  });

  it('is the same fight from the same seed', () => {
    const run = () => {
      const { game, told } = hooked(5);
      play(game);
      return `${told.join('|')} ${game.t.toFixed(4)}`;
    };
    expect(run()).toBe(run());
  });
});
