/** The monkey itself: it gets about, and a clean seed is clean. `npm run fuzz` is the long form. */
import { describe, expect, it } from 'vitest';
import { fuzz } from '../scripts/fuzzer';

describe('the fuzzer', () => {
  it('plays a seed through without breaking a rule, and does everything a player can', () => {
    // twice the fuzz's frames: an angler watching for half a minute takes a share of them, and seed 1 reached the
    // reel-in and the panel's pebble only after four thousand
    const r = fuzz(1, 8000);
    expect(r.failure, JSON.stringify(r.failure)).toBe(null);
    expect(r.happened.splashed, 'the monkey splashes something').toBeGreaterThan(0);
    for (const action of ['wait', 'pause', 'dirt', 'time', 'drop', 'drop near', 'cast', 'reel in', 'reload'])
      expect(r.done[action], action).toBeGreaterThan(0);
  });

  it('fishes: across a few seeds, it strikes, reels and stows, and fish are hooked, slip and are landed', () => {
    const happened: Record<string, number> = {},
      done: Record<string, number> = {};
    for (let seed = 1; seed <= 8; seed++) {
      const r = fuzz(seed, 4000);
      expect(r.failure, JSON.stringify(r.failure)).toBe(null);
      for (const [k, n] of Object.entries(r.happened)) happened[k] = (happened[k] ?? 0) + n;
      for (const [k, n] of Object.entries(r.done)) done[k] = (done[k] ?? 0) + n;
    }
    for (const action of ['strike', 'reel', 'stow', 'angle']) expect(done[action], action).toBeGreaterThan(0);
    for (const event of ['nibbled', 'bitten', 'hooked', 'missed', 'slipped', 'landed'])
      expect(happened[event], event).toBeGreaterThan(0);
  });

  it('plays a phone: across a few seeds its gestures are reached, cast, strike and reel, and a refused message changes nothing', () => {
    const done: Record<string, number> = {};
    for (let seed = 1; seed <= 8; seed++) {
      const r = fuzz(seed, 4000);
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

  it('plays the same way twice from a seed', () => {
    expect(fuzz(2, 600)).toEqual(fuzz(2, 600));
  });
});
