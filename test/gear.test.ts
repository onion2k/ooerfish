/** The gifts: which cure count earns what, how each eases the fight and the bite, and that the game gives each once. */
import { beforeAll, describe, expect, it } from 'vitest';
import { Angler, careful } from '../src/angler';
import { fightFor, gearFor, noticeFor, windowFor, NO_GEAR } from '../src/fight';
import { Game, type GameEvents } from '../src/game';
import { checkInvariants } from '../src/invariants';
import { FIGHT, FISHING, GEAR, GIFT_GIVER } from '../src/lake';
import { Progress, memoryStore } from '../src/progress';
import { seeded } from '../src/random';
import { BANDS, FIGHTS, GEARS, playCell, type BandName, type Gear } from '../scripts/balancing';
import { DT } from './helpers';

const only = (id: (typeof GEAR)[number]['id']) => ({ ...NO_GEAR, [id]: true });
const held = (g: ReturnType<typeof gearFor>) => GEAR.filter((x) => g[x.id]).map((x) => x.id);

describe('gearFor', () => {
  it('gives the line at 2 cures, the reel at 4, the rod at 6, the bobber at 8 and the bait at 10', () => {
    expect(GEAR.map((g) => [g.id, g.at])).toEqual([
      ['line', 2],
      ['reel', 4],
      ['rod', 6],
      ['bobber', 8],
      ['bait', 10],
    ]);
  });
  it.each([
    [0, []],
    [1, []],
    [2, ['line']],
    [5, ['line', 'reel']],
    [6, ['line', 'reel', 'rod']],
    [10, ['line', 'reel', 'rod', 'bobber', 'bait']],
    [12, ['line', 'reel', 'rod', 'bobber', 'bait']],
    [99, ['line', 'reel', 'rod', 'bobber', 'bait']],
  ])('at %i cures holds %j', (cured, ids) => {
    expect(held(gearFor(cured))).toEqual(ids);
  });
  it('holds nothing for what is not a count', () => {
    expect(held(gearFor(NaN))).toEqual([]);
    expect(held(gearFor(-3))).toEqual([]);
  });
  it('never shrinks as the count rises', () => {
    let was = 0;
    for (let c = 0; c <= 20; c++) {
      const n = held(gearFor(c)).length;
      expect(n).toBeGreaterThanOrEqual(was);
      was = n;
    }
  });
  it('names a giver and says each gift in words', () => {
    expect(GIFT_GIVER).toBe('the Sunny Atom');
    for (const g of GEAR) {
      expect(g.name.length).toBeGreaterThan(3);
      expect(g.words.endsWith('.')).toBe(true);
    }
  });
});

describe('fightFor with the gifts', () => {
  const base = fightFor(0.5, 'steady');
  it('is the same fight with no gear given as with none held', () => {
    expect(fightFor(0.5, 'steady', NO_GEAR)).toEqual(base);
  });
  it('eases the drain by the line and changes nothing else', () => {
    const f = fightFor(0.5, 'steady', only('line'));
    expect(f.drain).toBeCloseTo(base.drain * GEAR[0].times, 12);
    expect({ ...f, drain: 0 }).toEqual({ ...base, drain: 0 });
  });
  it('speeds the lift by the reel and changes nothing else', () => {
    const f = fightFor(0.5, 'steady', only('reel'));
    expect(f.push).toBeCloseTo(base.push * GEAR[1].times, 12);
    expect({ ...f, push: 0 }).toEqual({ ...base, push: 0 });
  });
  it('widens the zone by the rod, which lifts the fish floor with it, and changes nothing else', () => {
    const f = fightFor(0.5, 'steady', only('rod'));
    expect(f.width).toBeCloseTo(FIGHT.width + GEAR[2].plus, 12);
    expect(f.floor).toBeCloseTo(f.width + FIGHT.floor, 12);
    expect({ ...f, width: 0, floor: 0 }).toEqual({ ...base, width: 0, floor: 0 });
  });
  it('is not touched by the bobber or the bait, which are the bite’s', () => {
    expect(fightFor(0.5, 'steady', only('bobber'))).toEqual(base);
    expect(fightFor(0.5, 'steady', only('bait'))).toEqual(base);
  });
  it('holds all three together', () => {
    const f = fightFor(0.5, 'steady', gearFor(12));
    expect([f.drain < base.drain, f.push > base.push, f.width > base.width]).toEqual([true, true, true]);
  });
});

describe('each gift on its own, and stacked', () => {
  const tempers = ['calm', 'steady', 'feisty'] as const;
  const hefts = [0, 0.2, 0.5, 0.8, 1];
  /** The figures that differ between two fights, named. */
  const differing = (a: ReturnType<typeof fightFor>, b: ReturnType<typeof fightFor>) =>
    (Object.keys(a) as (keyof typeof a)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
  const own = { line: ['drain'], reel: ['push'], rod: ['floor', 'width'], bobber: [], bait: [] } as const;

  it('changes only its own figures, for every size and temper', () => {
    for (const t of tempers)
      for (const h of hefts)
        for (const g of GEAR)
          expect(differing(fightFor(h, t), fightFor(h, t, only(g.id))), `${g.id} ${t} ${h}`).toEqual([...own[g.id]]);
  });
  it('eases in the right direction: a slower drain, a quicker push, a wider zone and a higher floor', () => {
    const b = fightFor(0.5, 'steady');
    expect(fightFor(0.5, 'steady', only('line')).drain).toBeLessThan(b.drain);
    expect(fightFor(0.5, 'steady', only('reel')).push).toBeGreaterThan(b.push);
    expect(fightFor(0.5, 'steady', only('rod')).width).toBeGreaterThan(b.width);
    expect(fightFor(0.5, 'steady', only('rod')).floor).toBeGreaterThan(b.floor);
  });
  it('keeps the floor above the zone’s top at rest, as the floor rule has it', () => {
    for (const t of tempers)
      for (const h of hefts) {
        const f = fightFor(h, t, gearFor(12));
        expect(f.floor).toBeGreaterThanOrEqual(f.width + FIGHT.floor);
      }
  });
  it('stacks in order, each cure count adding exactly its gift’s figures to the last', () => {
    let was = fightFor(0.5, 'feisty', gearFor(0));
    for (const g of GEAR) {
      const now = fightFor(0.5, 'feisty', gearFor(g.at));
      expect(differing(was, now), g.id).toEqual([...own[g.id]]);
      expect(fightFor(0.5, 'feisty', gearFor(g.at - 1)), `just before ${g.id}`).toEqual(was);
      was = now;
    }
  });
});

describe('the gear levels are each a step easier', () => {
  // The line and the rod each make every column easier for the 0.4 s hand, at the check's own fight count so that the
  // unit test and the table agree; a gift zeroed leaves two levels alike, and the landed count then fails to rise. The
  // reel is held by its own figure above and here only never to make things harder: the careful hand reads the zone's
  // speed and lets go the earlier, so the balance tool cannot see a faster reel help, though a player's hand may.
  const table: Partial<Record<string, number>> = {};
  beforeAll(() => {
    for (const gear of GEARS)
      for (const b of BANDS) table[`${gear}/${b.name}`] = playCell({ gear, reaction: 24, band: b.name }, FIGHTS).landed;
  });
  const landed = (gear: Gear, band: BandName) => table[`${gear}/${band}`]!;
  it.each(BANDS.map((b) => b.name))('lands more in the %s column with the line and again with the rod', (band) => {
    expect(landed('line', band), 'the line over none').toBeGreaterThan(landed('none', band));
    expect(landed('line+reel+rod', band), 'the rod over the line and reel').toBeGreaterThan(landed('line+reel', band));
  });
  it.each(BANDS.map((b) => b.name))('never lands fewer in the %s column for the reel', (band) => {
    // within a fight's worth of chance, since the two levels play the same seeds and the reel's step is about nothing
    expect(landed('line+reel', band)).toBeGreaterThanOrEqual(landed('line', band) - FIGHTS / 100);
  });
  it('is the same at the last level as at the one before, since the bobber and bait are the bite’s', () => {
    for (const b of BANDS) expect(landed('all', b.name)).toBe(landed('line+reel+rod', b.name));
  });
  it('leaves no cell of the 0.4 s hand a sure thing at any level', () => {
    for (const gear of GEARS)
      for (const b of BANDS) expect(landed(gear, b.name), `${gear} ${b.name}`).toBeLessThan(FIGHTS);
  });
});

describe('the bite with the gifts', () => {
  it('has the window and the notice as they were with none', () => {
    expect(windowFor(NO_GEAR)).toBe(FISHING.window);
    expect(noticeFor(NO_GEAR)).toBe(FISHING.notice);
  });
  it('lengthens the window by the bobber only, and the notice by the bait only', () => {
    expect(windowFor(only('bobber'))).toBeCloseTo(FISHING.window * 1.4, 12);
    expect(windowFor(only('bait'))).toBe(FISHING.window);
    expect(noticeFor(only('bait'))).toBeCloseTo(FISHING.notice * 1.5, 12);
    expect(noticeFor(only('bobber'))).toBe(FISHING.notice);
  });

  /** A game with the lure sunk and one fish set at it; the bite's gear given. */
  function lake(gear: ReturnType<typeof gearFor>) {
    const game = new Game(new Progress(memoryStore()), { random: seeded(3) });
    game.cast(Math.PI / 2, 0.62);
    for (let f = 0; f < 900 && game.lure.phase !== 'sinking'; f++) game.step(DT);
    for (let f = 0; f < 120; f++) game.step(DT);
    game.bite.stowed(game.fish);
    for (let i = 0; i < game.fish.count; i++) game.fish.x[i] = game.fish.y[i] = 1e6;
    game.fish.held = -1;
    game.bite.gear = gear;
    return game;
  }
  it('keeps the window open for the bobber’s longer time and no longer', () => {
    for (const [gear, window] of [
      [NO_GEAR, FISHING.window],
      [only('bobber'), FISHING.window * 1.4],
    ] as const) {
      const game = lake(gear);
      game.bite.phase = 'biting';
      game.bite.fish = 0;
      game.fish.held = 0;
      game.fish.x[0] = game.lure.bobber[0];
      game.fish.y[0] = game.lure.bobber[1];
      game.fish.depth[0] = game.lure.depth;
      game.bite.phase = 'nibbling';
      game.bite.nibblesLeft = 0;
      game.bite.timer = 0;
      game.bite.step(game.t + DT, DT, game.fish, game.lure, () => 0.5);
      expect(game.bite.phase).toBe('biting');
      expect(game.bite.timer).toBeCloseTo(window, 12);
    }
  });
  it('notices at the bait’s quicker rate', () => {
    // a chance of 0.5 a draw notices only when the rate times dt exceeds it: scaled by the bait, the threshold moves
    const noticed = (gear: ReturnType<typeof gearFor>, r: number) => {
      const game = lake(gear);
      game.fish.x[0] = game.lure.bobber[0] + 1;
      game.fish.y[0] = game.lure.bobber[1];
      game.fish.depth[0] = game.lure.depth;
      game.bite.step(game.t + DT, DT, game.fish, game.lure, () => r);
      return game.bite.phase !== 'none';
    };
    const r = FISHING.notice * DT * 1.2;
    expect(noticed(NO_GEAR, r)).toBe(false);
    expect(noticed(only('bait'), r)).toBe(true);
  });
});

describe('careful with a wider zone', () => {
  it('centres on the zone’s own width', () => {
    // the fish is just above the middle of a zone 0.28 high at 0.3, and just below the middle of one 0.4 high
    const fish = 0.3 + 0.14 + 0.03;
    expect(careful(0.3, 0, fish, 0.28)).toBe(true);
    expect(careful(0.3, 0, fish, 0.4)).toBe(false);
    expect(careful(0.3, 0, 0.3 + 0.2 - 0.03, 0.4)).toBe(false);
    expect(careful(0.3, 0, 0.3 + 0.2 + 0.03, 0.4)).toBe(true);
  });
});

/** A game that tells the gifts, on a save of `cured`. */
function giftGame(cured: number, seed = 1) {
  const gifts: [string, string][] = [];
  const events: GameEvents = { gifted: (name, words) => gifts.push([name, words]) };
  const game = new Game(new Progress(memoryStore(JSON.stringify({ cured }))), { random: seeded(seed), events });
  return { game, gifts };
}
function fishUntil(game: Game, n: number, seed = 5) {
  const angler = new Angler(game, seeded(seed));
  for (let f = 0; f < 60 * 60 * 90 && game.progress.entry(game.lake.id).cured < n; f++) angler.step(DT);
  expect(game.progress.entry(game.lake.id).cured).toBeGreaterThanOrEqual(n);
}

describe('the game and the gifts', () => {
  it('gives the line once, at the second cure, and nothing at the first or the third', () => {
    const { game, gifts } = giftGame(0);
    expect(game.gear).toEqual(NO_GEAR);
    fishUntil(game, 1);
    expect(gifts).toEqual([]);
    expect(game.gear).toEqual(NO_GEAR);
    fishUntil(game, 2);
    expect(gifts).toEqual([[GEAR[0].name, GEAR[0].words]]);
    expect(held(game.gear)).toEqual(['line']);
    expect(game.bite.gear).toBe(game.gear);
    fishUntil(game, 3);
    expect(gifts.length, 'never again for it').toBe(1);
    expect(checkInvariants(game)).toEqual([]);
  });
  it('has the gifts of a loaded count and tells none of them', () => {
    const { game, gifts } = giftGame(6);
    expect(held(game.gear)).toEqual(['line', 'reel', 'rod']);
    expect(game.bite.gear).toBe(game.gear);
    expect(gifts).toEqual([]);
    fishUntil(game, 7);
    expect(gifts, 'the cure after a load is not a gift').toEqual([]);
  });
  it('starts the next fight with the new gear and keeps a fight under way to its own figures', () => {
    const { game } = giftGame(1);
    const angler = new Angler(game, seeded(5));
    for (let f = 0; f < 60 * 600 && game.bite.phase !== 'hooked'; f++) angler.step(DT);
    expect(game.bite.phase).toBe('hooked');
    const width = game.line.figures.width;
    expect(width).toBe(FIGHT.width);
    // a gift landing in the middle of a fight is only possible here; the fight does not feel it
    game.gear = game.bite.gear = gearFor(6);
    // and the save agrees, so that the cure that follows keeps it
    game.progress.entry(game.lake.id).cured = 5;
    for (let f = 0; f < 30 && game.bite.phase === 'hooked'; f++) angler.step(DT);
    expect(game.line.figures.width).toBe(width);
    expect(game.line.figures.width).toBe(FIGHT.width);
    for (let f = 0; f < 60 * 600 && game.bite.phase !== 'none'; f++) angler.step(DT);
    for (let f = 0; f < 60 * 600 && game.bite.phase !== 'hooked'; f++) angler.step(DT);
    expect(game.line.figures.width).toBeCloseTo(FIGHT.width + GEAR[2].plus, 12);
  });
  it('has the angler win with the wider rod, centred on its width', () => {
    const { game } = giftGame(6);
    fishUntil(game, 7);
    expect(checkInvariants(game)).toEqual([]);
  });
});
