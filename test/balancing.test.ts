/** The balance tool's sums: the delayed hand, one fight, a cell, the table and its comparison, and faults put there on purpose. */
import { afterEach, describe, expect, it } from 'vitest';
import { FIGHT } from '../src/lake';
import {
  BANDS,
  DelayedHand,
  GEARS,
  REACTIONS,
  cellKey,
  compareTables,
  fightSeed,
  formatTable,
  medianOf,
  playFight,
  playCell,
  playTable,
} from '../scripts/balancing';
import { seeded } from '../src/random';
import { Line } from '../src/line';
import { careful } from '../src/angler';

describe('the median', () => {
  it('is the middle, the mean of the two middles, and nothing for none', () => {
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([4, 1, 2, 3])).toBe(2.5);
    expect(medianOf([])).toBeNull();
  });
});

describe('the delayed hand', () => {
  it('sees the value exactly a reaction of frames back, and the current one before then', () => {
    const hand = new DelayedHand(3);
    const seen: number[] = [];
    for (let f = 0; f < 10; f++) {
      hand.push(f);
      seen.push(hand.seen());
    }
    // the first three frames go by the fish now; after that it is the value exactly three frames back
    expect(seen).toEqual([0, 1, 2, 0, 1, 2, 3, 4, 5, 6]);
  });
  it('forgets a fight when reset', () => {
    const hand = new DelayedHand(2);
    for (let f = 0; f < 5; f++) hand.push(f + 10);
    hand.reset();
    hand.push(99);
    expect(hand.seen()).toBe(99);
  });
  it('is a ring sized once', () => {
    const hand = new DelayedHand(36);
    const ring = hand.ring;
    for (let f = 0; f < 1000; f++) hand.push(f);
    expect(hand.ring).toBe(ring);
    expect(ring.length).toBe(37);
  });
});

describe('a fight', () => {
  it('ends landed, slipped or capped, with the seconds it took', () => {
    const r = playFight(seeded(5), { reaction: 15, heft: 0.5 });
    expect(r.result).toBe('landed');
    expect(r.seconds).toBeGreaterThan(1);
    const capped = playFight(seeded(5), { reaction: 15, heft: 0.5, capSeconds: 1 });
    expect(capped.result).toBe('capped');
    expect(capped.seconds).toBeCloseTo(1, 1);
  });
  it('is the same twice', () => {
    expect(playFight(seeded(9), { reaction: 24, heft: 0.2 })).toEqual(
      playFight(seeded(9), { reaction: 24, heft: 0.2 }),
    );
  });
  it('plays the careful hand a reaction late, as the angler does', () => {
    // by hand: the same line, held by careful on the value R frames back
    const reaction = 15;
    const random = seeded(3);
    const line = new Line();
    line.start(20, 0.4, random);
    const past: number[] = [];
    let frames = 0,
      result = 'fighting';
    while (result === 'fighting' && frames < 7200) {
      past.push(line.fishAt);
      const at = past.length > reaction ? past[past.length - 1 - reaction] : line.fishAt;
      result = line.step(1 / 60, careful(line.zone, line.zoneSpeed, at), 0.5, random);
      frames++;
    }
    const r = playFight(seeded(3), { reaction, heft: 0.4 });
    expect(r.result).toBe(result);
    expect(r.seconds).toBeCloseTo(frames / 60, 6);
  });
});

describe('a cell', () => {
  it('is the same twice and counts what it played', () => {
    const a = playCell({ gear: 'none', reaction: 15, band: 'middle' }, 30);
    const b = playCell({ gear: 'none', reaction: 15, band: 'middle' }, 30);
    expect(a).toEqual(b);
    expect(a.fights).toBe(30);
    expect(a.landed).toBeLessThanOrEqual(30);
    expect(a.landed).toBeGreaterThan(0);
  });
  it('draws a fight from its own index, reaction and band, so seeds differ across all three', () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 50; i++)
      for (const reaction of REACTIONS) for (const band of BANDS) seeds.add(fightSeed(i, reaction, band.name));
    expect(seeds.size).toBe(50 * REACTIONS.length * BANDS.length);
  });
});

describe('the table', () => {
  it('has a cell for every gear, reaction and band, keyed by all three', () => {
    const t = playTable(2);
    expect(Object.keys(t).length).toBe(GEARS.length * REACTIONS.length * BANDS.length);
    expect(t[cellKey({ gear: 'none', reaction: 15, band: 'heavy' })].fights).toBe(2);
  });
  it('is the same twice', () => {
    expect(playTable(6)).toEqual(playTable(6));
  });
  it('formats a row a reaction and a column a size', () => {
    const text = formatTable(playTable(2));
    expect(text).toContain('0.25 s');
    expect(text).toContain('light');
    expect(text).toContain('heavy');
  });
});

describe('the comparison', () => {
  const base = { 'none/15/light': { fights: 10, landed: 10, median: 8.5 } };
  it('passes the same table', () => {
    expect(compareTables(base, structuredClone(base))).toEqual([]);
  });
  it('catches a moved count, either way', () => {
    expect(compareTables(base, { 'none/15/light': { fights: 10, landed: 9, median: 8.5 } })).toHaveLength(1);
    expect(compareTables({ 'none/15/light': { fights: 10, landed: 9, median: 8.5 } }, base)).toHaveLength(1);
  });
  it('catches a median moved by a tenth of a second, either way', () => {
    const slower = compareTables(base, { 'none/15/light': { fights: 10, landed: 10, median: 8.6 } });
    expect(slower).toHaveLength(1);
    expect(slower[0]).toContain('none/15/light');
    expect(compareTables(base, { 'none/15/light': { fights: 10, landed: 10, median: 8.4 } })).toHaveLength(1);
  });
  it('catches a median that is lost or found, and a cell missing or new', () => {
    expect(compareTables(base, { 'none/15/light': { fights: 10, landed: 10, median: null } })).toHaveLength(1);
    expect(compareTables(base, {})).toHaveLength(1);
    expect(compareTables(base, { ...base, 'none/9/light': { fights: 10, landed: 10, median: 1 } })).toHaveLength(1);
  });
});

describe('faults put there on purpose', () => {
  const fig = FIGHT as unknown as Record<string, number>;
  const original = { fill: FIGHT.fill, drain: FIGHT.drain };
  afterEach(() => {
    fig.fill = original.fill;
    fig.drain = original.drain;
  });
  const cell = { gear: 'none', reaction: 15, band: 'middle' } as const;

  it('a meter that never fills lands nothing', () => {
    fig.fill = 0;
    const r = playCell(cell, 40);
    expect(r.landed).toBe(0);
    expect(r.median).toBeNull();
  });
  it('a hand that holds perfectly with no delay lands everything, quickly', () => {
    // it holds whenever the zone's middle is below the fish, with no lag and no lead
    const r = playCell(cell, 40, {
      reaction: 0,
      hand: (line) => line.fishAt > line.zone + FIGHT.width / 2,
    });
    expect(r.landed).toBe(40);
    expect(r.median).not.toBeNull();
    expect(r.median as number).toBeLessThan(playCell(cell, 40).median as number);
  });
  it('a hand that never holds loses every fish', () => {
    const r = playCell(cell, 40, { hand: () => false });
    expect(r.landed).toBe(0);
  });
  it('a meter that drains twice as fast moves the table against the unchanged one', () => {
    const was = playTable(20, ['none']);
    fig.drain = original.drain * 2;
    const now = playTable(20, ['none']);
    expect(compareTables(was, now).length).toBeGreaterThan(0);
  });
});
