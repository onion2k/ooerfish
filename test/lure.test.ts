/** The lure's wind: fixed at the cast, so a sky that changes in the air changes nothing (`docs/weather.md`). */
import { describe, expect, it } from 'vitest';
import { flightAt } from '../src/cast';
import { HOME } from '../src/lakes';
import { Lure } from '../src/lure';

/** Down the jetty’s deck, toward the water: where a cast goes that lands on it, which the compass’s north no longer does. */
const NORTH = HOME.aim.angle;

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

describe('the lure snagged (`docs/boat.md`, C4)', () => {
  /** A lure thrown and stepped until it sinks, at the point it landed. */
  function sinking() {
    const lure = new Lure(HOME);
    lure.cast(NORTH, 0.5, 0);
    let t = 0;
    while (lure.phase !== 'sinking') lure.step((t += 1 / 60), 1 / 60);
    for (let f = 0; f < 60; f++) lure.step((t += 1 / 60), 1 / 60);
    return lure;
  }

  it('is not snagged to begin with', () => {
    expect(new Lure(HOME).snagged).toBe(-1);
  });

  it('is caught by `snag` at the bobber’s place, on the surface, with the bed it is in', () => {
    const lure = sinking();
    expect(lure.depth).toBeGreaterThan(0);
    lure.snag(2, 3.5, 4.5);
    expect(lure.phase).toBe('snagged');
    expect(lure.snagged).toBe(2);
    expect([lure.bobber[0], lure.bobber[1]]).toEqual([3.5, 4.5]);
    expect(Array.from(lure.at)).toEqual([3.5, 4.5, 0]);
    expect(lure.depth).toBe(0);
  });

  it('is not on the bed, however near the bed it hangs, while snagged', () => {
    // sunk in the shallows beside the south-east bed, where the bed is short of the line's depth
    const lure = new Lure(HOME);
    const s = HOME.snags[2];
    lure.freed(s.x - s.radius - 2, s.y, 0);
    for (let f = 0; f < 600; f++) lure.step(f / 60, 1 / 60);
    expect(lure.onBed).toBe(true);
    lure.snag(0, lure.bobber[0], lure.bobber[1]);
    expect(lure.onBed).toBe(false);
  });

  it('does not sink on while snagged', () => {
    const lure = sinking();
    lure.snag(0, lure.bobber[0], lure.bobber[1]);
    lure.step(100, 1 / 60);
    expect(lure.depth).toBe(0);
    expect(lure.at[2]).toBe(0);
    expect(lure.phase).toBe('snagged');
  });

  it('is cleared by a reel-in, and by a fish letting it go, sinking on from the surface', () => {
    const a = sinking();
    a.snag(1, a.bobber[0], a.bobber[1]);
    a.reelIn();
    expect(a.phase).toBe('ready');
    expect(a.snagged).toBe(-1);
    const b = sinking();
    b.snag(1, b.bobber[0], b.bobber[1]);
    b.freed(1, 2, 0);
    expect(b.phase).toBe('sinking');
    expect(b.snagged).toBe(-1);
    expect([b.bobber[0], b.bobber[1]]).toEqual([1, 2]);
  });
});
