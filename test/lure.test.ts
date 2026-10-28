/** The lure's wind: fixed at the cast, so a sky that changes in the air changes nothing (`docs/weather.md`). */
import { describe, expect, it } from 'vitest';
import { flightAt } from '../src/cast';
import { HOME } from '../src/lakes';
import { Lure } from '../src/lure';

const NORTH = Math.PI / 2;

describe('the lure in the wind', () => {
  it('flies the bent arc it was thrown on, sampled by the very sums of the flight', () => {
    const lure = new Lure(HOME);
    const wind: [number, number] = [10, 3];
    lure.cast(NORTH, 0.8, 0, wind);
    const want = new Float64Array(3);
    for (const t of [0.1, 0.3, lure.flies / 2]) {
      lure.step(t, 0.01);
      flightAt(NORTH, 0.8, t, want, HOME, wind);
      expect(Array.from(lure.at)).toEqual(Array.from(want));
    }
  });

  it('keeps its own copy of the wind, so the caller changing theirs moves nothing', () => {
    const lure = new Lure(HOME);
    const wind: [number, number] = [10, 3];
    lure.cast(NORTH, 0.8, 0, wind);
    const flies = lure.flies;
    wind[0] = 0;
    wind[1] = 0;
    lure.step(flies / 2, 0.01);
    const want = new Float64Array(3);
    flightAt(NORTH, 0.8, flies / 2, want, HOME, [10, 3]);
    expect(Array.from(lure.at)).toEqual(Array.from(want));
  });

  it('is cast calm by default', () => {
    const lure = new Lure(HOME);
    lure.cast(NORTH, 0.8, 0);
    expect(Array.from(lure.wind)).toEqual([0, 0]);
  });
});
