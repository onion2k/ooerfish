/** The monkey itself: it gets about, and a clean seed is clean. `npm run fuzz` is the long form. */
import { describe, expect, it } from 'vitest';
import { fuzz } from '../scripts/fuzzer';
import { HOME } from '../src/lakes';
import { RESERVOIR } from '../src/lakes/reservoir';

const FISH_COUNT = HOME.fishCount;

describe('the fuzzer', () => {
  it('plays a seed through without breaking a rule, and does everything a player can', () => {
    // twice the fuzz's frames, on three seeds and counted together: an angler watching for half a minute takes a share
    // of them, and which actions one seed draws moves whenever an action is added (seed 1 stopped reaching the reel-in
    // when the phone's and the pond's came together), so the reach is held across seeds and not on one
    const done: Record<string, number> = {};
    let splashed = 0;
    for (const seed of [1, 2, 3]) {
      const r = fuzz(seed, 8000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      splashed += r.happened.splashed;
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
    }
    expect(splashed, 'the monkey splashes something').toBeGreaterThan(0);
    for (const action of ['wait', 'pause', 'dirt', 'time', 'drop', 'drop near', 'cast', 'reel in', 'reload'])
      expect(done[action] ?? 0, action).toBeGreaterThan(0);
  });

  it('photographs: across seeds 1 to 24 some start with a full album, a photograph is taken, one is refused at a full album, one is discarded, and none breaks a rule', () => {
    const done: Record<string, number> = {};
    for (let seed = 1; seed <= 24; seed++) {
      const r = fuzz(seed, 4000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
    }
    for (const action of ['photograph', 'photograph refused', 'discard', 'look at'])
      expect(done[action], action).toBeGreaterThan(0);
  });

  it('fishes: across a few seeds, it strikes, reels and stows, and fish are hooked, slip and are landed', () => {
    const happened: Record<string, number> = {},
      done: Record<string, number> = {};
    // twelve seeds and not eight: a seed now starts with some of the fish already cured, which leaves fewer to slip
    // the hook, and the first eight draw none that does in 4000 frames
    for (let seed = 1; seed <= 12; seed++) {
      const r = fuzz(seed, 4000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      for (const [k, n] of Object.entries(r.happened)) happened[k] = (happened[k] ?? 0) + n;
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
    }
    for (const action of ['strike', 'reel', 'stow', 'angle']) expect(done[action], action).toBeGreaterThan(0);
    for (const event of ['nibbled', 'bitten', 'hooked', 'missed', 'slipped', 'landed', 'cured'])
      expect(happened[event], event).toBeGreaterThan(0);
  });

  it('reaches the gifts: across seeds 1 to 24 some start with gear, some are given a gift in play, and none breaks a rule', () => {
    let given = 0,
      withGear = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const r = fuzz(seed, 4000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      given += r.happened.gifted;
      if (r.done['start gifts'] > 0) withGear++;
    }
    expect(given, 'gifts given in play').toBeGreaterThan(0);
    expect(withGear, 'seeds that start with gear').toBeGreaterThan(0);
  });

  it('reaches a clean pond: across a few seeds it is clean for some frames, a cast is made into it, nothing bites there, and no more than twelve are ever cured', () => {
    const done: Record<string, number> = {};
    for (let seed = 1; seed <= 8; seed++) {
      const r = fuzz(seed, 4000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
      // the most ever cured at once is the pond's size, which the invariants hold; the result says it too
      expect(r.done['most cured'] ?? 0, `seed ${seed}`).toBeLessThanOrEqual(FISH_COUNT);
      // a frame with the pond clean is a frame with nothing biting: the fuzzer counts any bite made in one
      expect(r.done['bites in a clean pond'], `seed ${seed}`).toBe(0);
    }
    expect(done['clean frames'], 'frames played with the pond clean').toBeGreaterThan(0);
    expect(done['clean casts'], 'casts made into a clean pond').toBeGreaterThan(0);
  });

  it('reaches every kind, a drum hauled, and a pond cleaned by cures and hauls: across seeds 1 to 24', () => {
    const done: Record<string, number> = {},
      happened: Record<string, number> = {};
    // eight thousand frames a seed, not four: with the logbook's pages on the pond's bed (nine things to lie by, not
    // six) more of the monkey's casts are left on the bed and fewer reach a fish, and four thousand caught no perch over
    // the twenty-four; eight catch each kind three times or more, measured on 29 Oct 2026
    for (let seed = 1; seed <= 24; seed++) {
      const r = fuzz(seed, 8000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
      for (const [k, n] of Object.entries(r.happened)) happened[k] = (happened[k] ?? 0) + n;
    }
    for (const kind of ['bream', 'perch', 'pike'])
      expect(done[`caught ${kind}`], `a ${kind} caught`).toBeGreaterThan(0);
    expect(done['lie on the bed'], 'casts left to lie on the bed').toBeGreaterThan(0);
    expect(done['drum snagged'], 'a drum snagged').toBeGreaterThan(0);
    expect(happened.hauled, 'a drum hauled').toBeGreaterThan(0);
    expect(done['start drums'], 'seeds that start with a drum hauled').toBeGreaterThan(0);
    expect(done['start journal'], 'seeds that start with a journal').toBeGreaterThan(0);
    expect(done['pond cleaned by a haul'], 'ponds whose last cleaning was a haul').toBeGreaterThan(0);
  });

  it('reaches the treasures: a lure aimed at them, one snagged and kept, some seeds starting with some found, and one snagged in a clean pond', () => {
    const done: Record<string, number> = {},
      happened: Record<string, number> = {};
    for (let seed = 1; seed <= 24; seed++) {
      const r = fuzz(seed, 4000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      // fish bites in a clean pond are what must not happen: a treasure may be snagged there
      expect(r.done['bites in a clean pond'], `seed ${seed}`).toBe(0);
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
      for (const [k, n] of Object.entries(r.happened)) happened[k] = (happened[k] ?? 0) + n;
    }
    expect(done['lie by a treasure'], 'casts aimed at a treasure').toBeGreaterThan(0);
    expect(done['treasure snagged'], 'a treasure snagged').toBeGreaterThan(0);
    expect(done['treasure kept'], 'a treasure kept').toBeGreaterThan(0);
    expect(happened.found, 'a treasure found, told').toBeGreaterThan(0);
    expect(done['start found'], 'seeds that start with a treasure found').toBeGreaterThan(0);
    expect(done['treasure snagged in a clean pond'], 'a treasure snagged where nothing bites').toBeGreaterThan(0);
  });

  it('plays a phone: across a few seeds its gestures are reached, cast, strike and reel, and a refused message changes nothing', () => {
    const done: Record<string, number> = {};
    for (let seed = 1; seed <= 12; seed++) {
      const r = fuzz(seed, 4000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
    }
    const phone = Object.entries(done).filter(
      ([k]) => k.startsWith('phone ') && !/^phone (cast|strike|reel|refused)$/.test(k),
    );
    expect(
      phone.reduce((n, [, c]) => n + c, 0),
      'the monkey plays a phone',
    ).toBeGreaterThan(20);
    for (const effect of ['cast', 'strike', 'reel', 'refused'])
      expect(done[`phone ${effect}`], effect).toBeGreaterThan(0);
  });

  it('reaches the night: across seeds some cross midnight and wake, some go to bed early, some are refused mid-fight, and none breaks a rule', () => {
    const done: Record<string, number> = {};
    for (let seed = 1; seed <= 24; seed++) {
      const r = fuzz(seed, 4000, 'duckpond');
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
      // the monkey never stays in the cabin to the end of a seed it has frames left in
      expect(r.done['frames in the cabin'], `seed ${seed}`).toBeLessThan(2500);
    }
    expect(done['woke at midnight'], 'a seed crossed midnight and woke').toBeGreaterThan(0);
    expect(done['woke from bed'], 'a seed went to bed early and woke').toBeGreaterThan(0);
    expect(done['bed refused'], 'a bed refused mid-fight').toBeGreaterThan(0);
    expect(done['down to the pond'], 'a seed went down to the pond').toBeGreaterThan(0);
  });

  it('plays the same way twice from a seed', () => {
    expect(fuzz(2, 600)).toEqual(fuzz(2, 600));
  });

  it('plays the Reservoir with no rule broken, and the drawn lake reaches both', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const r = fuzz(seed, 4000, 'reservoir');
      expect(r.failure, `seed ${seed}`).toBe(null);
      expect(r.done['lake reservoir'], `seed ${seed}`).toBe(1);
      expect(r.done['most cured'] ?? 0, `seed ${seed}`).toBeLessThanOrEqual(RESERVOIR.fishCount);
    }
    const drawn = new Set<string>();
    for (let seed = 1; seed <= 12; seed++)
      for (const key of Object.keys(fuzz(seed, 60).done)) if (key.startsWith('lake ')) drawn.add(key);
    expect([...drawn].sort()).toEqual(['lake duckpond', 'lake reservoir']);
  });
});
