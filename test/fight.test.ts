/** What a fish's size and temper do to its fight: the figures `fightFor` hands the line, and the odds of a temper. */
import { describe, expect, it } from 'vitest';
import { drawTemper, drumFight, fightFor, gearFor, treasureFight, type Temper } from '../src/fight';
import { Line } from '../src/line';
import { DRUMS, FIGHT, TEMPERS, TREASURES } from '../src/lake';
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

describe('drumFight', () => {
  /** A drum hooked 20 out and played a second at a time with the reel held or not, by a line that draws no chance. */
  function play(gear = gearFor(0)) {
    const line = new Line();
    line.start(20, drumFight(gear), () => {
      throw new Error('a drum draws no chance');
    });
    return line;
  }

  it('is a profile with no darts and no drain: the fill is the drum’s own, the rest the fish’s base', () => {
    const f = drumFight(gearFor(0));
    expect(f.drum).toBe(true);
    expect(f.drain).toBe(0);
    expect(f.fill).toBe(DRUMS.fill);
    expect(f.width).toBe(FIGHT.width);
    expect(f.push).toBe(FIGHT.push);
    expect(fightFor(0.5, 'steady').drum, 'a fish’s fight is not a drum’s').toBe(false);
  });

  it('never darts: the drum stays where it was hooked on the bar, however long it is played', () => {
    const line = play();
    const at = line.fishAt;
    for (let f = 0; f < 60 * 60; f++) {
      line.step(1 / 60, f % 90 < 45, 1, () => {
        throw new Error('a drum draws no chance');
      });
      expect(line.fishAt).toBe(at);
      expect(line.pulling).toBe(false);
    }
  });

  it('never slips, and just waits when the reel is let go', () => {
    const line = play();
    const meter = line.meter;
    for (let f = 0; f < 60 * 120; f++) {
      expect(line.step(1 / 60, false, 1, () => 0)).toBe('fighting');
    }
    expect(line.meter, 'let go, it waits where it was').toBe(meter);
  });

  it('lands with the reel held, at the drum’s own rate, and not before', () => {
    const line = play();
    let seconds = 0;
    let did = 'fighting';
    while (did === 'fighting' && seconds < 120) {
      did = line.step(1 / 60, true, 1, () => 0);
      seconds += 1 / 60;
    }
    expect(did).toBe('landed');
    // from the meter's start to full at the fill a second
    expect(seconds).toBeCloseTo((1 - FIGHT.meterStart) / DRUMS.fill, 0);
  });

  it('draws the line in as the meter fills, and holds it as it waits', () => {
    const line = play();
    const out = line.out;
    for (let f = 0; f < 120; f++) line.step(1 / 60, true, 0, () => 0);
    const drawn = line.out;
    expect(drawn).toBeLessThan(out);
    for (let f = 0; f < 120; f++) line.step(1 / 60, false, 0, () => 0);
    expect(line.out).toBe(drawn);
  });

  it('is eased by the reel’s gift, and by nothing else', () => {
    const base = drumFight(gearFor(0));
    const reel = drumFight(gearFor(4));
    expect(reel.fill).toBeGreaterThan(base.fill);
    expect(reel.push).toBeGreaterThan(base.push);
    expect(drumFight(gearFor(2)).fill).toBe(base.fill);
  });
});

describe('treasureFight', () => {
  const noChance = () => {
    throw new Error('a treasure draws no chance');
  };
  /** A treasure hooked 20 out and played with the reel held or not. */
  function play(gear = gearFor(0)) {
    const line = new Line();
    line.start(20, treasureFight(gear), noChance);
    return line;
  }
  /** Seconds to land with the reel held. */
  function landsIn(figures: ReturnType<typeof drumFight>): number {
    const line = new Line();
    line.start(20, figures, noChance);
    let seconds = 0;
    let did = 'fighting';
    while (did === 'fighting' && seconds < 300) {
      did = line.step(1 / 60, true, 1, noChance);
      seconds += 1 / 60;
    }
    expect(did).toBe('landed');
    return seconds;
  }

  it('is the drum’s profile at a quicker fill: no darts, no drain, the treasure’s own rate', () => {
    const f = treasureFight(gearFor(0));
    const d = drumFight(gearFor(0));
    expect(f.drum, 'it is played as a haul').toBe(true);
    expect(f.dart).toBe(0);
    expect(f.drain).toBe(0);
    expect(f.fill).toBe(TREASURES.fill);
    expect(f.fill, 'quicker than a drum’s').toBeGreaterThan(d.fill);
    expect(f.fill / d.fill, 'about three times as quick').toBeCloseTo(3, 1);
    expect({ ...f, fill: 0 }).toEqual({ ...d, fill: 0 });
  });

  it('never darts and never slips, however long it is played, and waits when the reel is let go', () => {
    const line = play();
    const at = line.fishAt;
    const meter = line.meter;
    for (let f = 0; f < 60 * 120; f++) {
      expect(line.step(1 / 60, false, 1, noChance)).toBe('fighting');
      expect(line.fishAt).toBe(at);
      expect(line.pulling).toBe(false);
    }
    expect(line.meter).toBe(meter);
  });

  it('lands sooner than a drum, by about a third of the time, with the reel held', () => {
    const treasure = landsIn(treasureFight(gearFor(0)));
    const drum = landsIn(drumFight(gearFor(0)));
    expect(treasure).toBeLessThan(drum / 2);
    expect(treasure).toBeCloseTo((1 - FIGHT.meterStart) / TREASURES.fill, 0);
  });

  it('is eased by the reel’s gift, as a drum is', () => {
    expect(treasureFight(gearFor(4)).fill).toBeGreaterThan(treasureFight(gearFor(0)).fill);
    expect(treasureFight(gearFor(2)).fill).toBe(treasureFight(gearFor(0)).fill);
  });
});
