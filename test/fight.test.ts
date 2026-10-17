/** What a fish's size and temper do to its fight: the figures `fightFor` hands the line, and the odds of a temper. */
import { describe, expect, it } from 'vitest';
import { drawTemper, fightFor, type Temper } from '../src/fight';
import { FIGHT, TEMPERS } from '../src/lake';
import { seeded } from '../src/random';

const TEMPER_NAMES: Temper[] = ['calm', 'steady', 'feisty'];
const HEFTS = [0, 0.5, 1];

describe('fightFor', () => {
  it('is faster and longer in its darts for a heavier fish, of any temper', () => {
    for (const t of TEMPER_NAMES) {
      const [a, b, c] = HEFTS.map((h) => fightFor(h, t));
      expect(b.dart, t).toBeGreaterThan(a.dart);
      expect(c.dart, t).toBeGreaterThan(b.dart);
      expect(b.dartLeast, t).toBeGreaterThan(a.dartLeast);
      expect(c.dartLeast, t).toBeGreaterThan(b.dartLeast);
      // and rests less and fills the meter more slowly
      expect(c.rest[0], t).toBeLessThan(a.rest[0]);
      expect(c.fill, t).toBeLessThan(a.fill);
    }
  });

  it('is faster, further, restier-less and slower to fill for a feisty fish, and the reverse for a calm one', () => {
    for (const h of HEFTS) {
      const calm = fightFor(h, 'calm'),
        steady = fightFor(h, 'steady'),
        feisty = fightFor(h, 'feisty');
      expect(feisty.dart).toBeGreaterThan(steady.dart);
      expect(steady.dart).toBeGreaterThan(calm.dart);
      expect(feisty.dartLeast).toBeGreaterThan(steady.dartLeast);
      expect(steady.dartLeast).toBeGreaterThan(calm.dartLeast);
      expect(feisty.rest[1]).toBeLessThan(steady.rest[1]);
      expect(steady.rest[1]).toBeLessThan(calm.rest[1]);
      expect(feisty.fill).toBeLessThanOrEqual(steady.fill);
      expect(steady.fill).toBeLessThan(calm.fill);
    }
  });

  it('is the base fight for the lightest steady fish, except what the size and temper do not touch', () => {
    const f = fightFor(0, 'steady');
    expect(f.dart).toBe(FIGHT.dart);
    expect(f.dartLeast).toBe(FIGHT.dartLeast);
    expect(f.rest).toEqual(FIGHT.rest);
    expect(f.fill).toBe(FIGHT.fill);
    expect(f.drain).toBe(FIGHT.drain);
    expect(f.width).toBe(FIGHT.width);
    expect(f.push).toBe(FIGHT.push);
    expect(f.fall).toBe(FIGHT.fall);
    // the floor stands a margin above the zone, whatever its width
    expect(f.floor).toBe(FIGHT.width + FIGHT.floor);
    expect(f.dartLongest).toBe(FIGHT.dartLongest);
    expect(f.sickRest).toBe(FIGHT.sickRest);
  });

  it('keeps a dart within the bar and a heft within nought and one', () => {
    for (const t of TEMPER_NAMES) {
      expect(fightFor(1, t).dartLeast).toBeLessThan(1);
      expect(fightFor(7, t).heft).toBe(1);
      expect(fightFor(-3, t).heft).toBe(0);
    }
  });

  it('is the same twice', () => {
    expect(fightFor(0.37, 'feisty')).toEqual(fightFor(0.37, 'feisty'));
  });
});

describe('drawTemper', () => {
  it('draws each temper at its odds, within two points over ten thousand draws', () => {
    const random = seeded(12);
    const count: Record<string, number> = { calm: 0, steady: 0, feisty: 0 };
    for (let i = 0; i < 10000; i++) count[drawTemper(random)]++;
    for (const t of TEMPERS) expect(Math.abs(count[t.name] / 10000 - t.odds), t.name).toBeLessThan(0.02);
  });

  it('has odds that sum to one', () => {
    expect(TEMPERS.reduce((s, t) => s + t.odds, 0)).toBeCloseTo(1, 9);
  });

  it('gives the same seed the same tempers and the same figures', () => {
    const run = (seed: number) => {
      const random = seeded(seed);
      return Array.from({ length: 20 }, () => {
        const t = drawTemper(random);
        return [t, fightFor(random(), t)];
      });
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  it('takes exactly one draw', () => {
    let n = 0;
    drawTemper(() => (n++, 0.5));
    expect(n).toBe(1);
  });
});
