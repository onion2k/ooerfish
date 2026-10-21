/** The day's end as sums: when a step crosses midnight, and how far the screen is faded. */
import { describe, expect, it } from 'vitest';
import { fadeAt, pastMidnight } from '../src/night';

describe('a step past midnight', () => {
  it('is one that wraps the clock round to the start of the day, and no other', () => {
    expect(pastMidnight(0.9999, 0.0001)).toBe(true);
    expect(pastMidnight(0.999, 0)).toBe(true);
    // an ordinary step forward is not
    expect(pastMidnight(0.25, 0.26)).toBe(false);
    expect(pastMidnight(0.98, 0.99)).toBe(false);
    // a step of no time is not, even at nought
    expect(pastMidnight(0, 0)).toBe(false);
    expect(pastMidnight(0.4, 0.4)).toBe(false);
  });

  it('is not fooled by a clock that ticks back a hair, as a page’s first frame can when it is stamped before the last was read', () => {
    expect(pastMidnight(0.25, 0.2499965)).toBe(false);
    expect(pastMidnight(0.5, 0.4)).toBe(false);
    expect(pastMidnight(0.0001, 0)).toBe(false);
  });

  it('is not fooled by a clock set back, or by what is not a number', () => {
    // a lever moving the clock backwards has the same shape as a wrap, but only a step is asked, and one forward
    // that wraps is the whole of the test: a step never goes back, so the two cases are told by being asked
    expect(pastMidnight(NaN, 0.1)).toBe(false);
    expect(pastMidnight(0.9, NaN)).toBe(false);
    expect(pastMidnight(Infinity, 0.1)).toBe(false);
  });
});

describe('the fade', () => {
  const OUT = 1.5,
    IN = 1;
  it('is clear at the pond, whatever the time', () => {
    expect(fadeAt('pond', 0, OUT, IN)).toBe(0);
    expect(fadeAt('pond', 99, OUT, IN)).toBe(0);
  });

  it('rises from nought to one over the yawn, and stays at one beyond it', () => {
    expect(fadeAt('yawning', 0, OUT, IN)).toBe(0);
    expect(fadeAt('leaving', OUT / 2, OUT, IN)).toBeCloseTo(0.5, 12);
    expect(fadeAt('leaving', OUT * 2, OUT, IN)).toBe(1);
    expect(fadeAt('yawning', OUT / 2, OUT, IN)).toBeCloseTo(0.5, 12);
    expect(fadeAt('yawning', OUT, OUT, IN)).toBe(1);
    expect(fadeAt('yawning', OUT * 3, OUT, IN)).toBe(1);
  });

  it('falls from one to nought over the first second in the cabin, and stays at nought', () => {
    expect(fadeAt('cabin', 0, OUT, IN)).toBe(1);
    expect(fadeAt('cabin', IN / 4, OUT, IN)).toBeCloseTo(0.75, 12);
    expect(fadeAt('cabin', IN, OUT, IN)).toBe(0);
    expect(fadeAt('cabin', 50, OUT, IN)).toBe(0);
  });

  it('never leaves nought to one, for a time before the start or no time to fade in', () => {
    for (const place of ['pond', 'yawning', 'cabin'] as const)
      for (const e of [-3, 0, 0.3, 7, NaN]) {
        const f = fadeAt(place, e, OUT, IN);
        expect(f >= 0 && f <= 1, `${place} ${e}`).toBe(true);
      }
    expect(fadeAt('yawning', 0, 0, IN)).toBe(1);
    expect(fadeAt('cabin', 0, OUT, 0)).toBe(0);
  });
});
