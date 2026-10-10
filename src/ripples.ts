/**
 * A splash's rings, as sums: how big and how thick each is at an age. A splash has a few, each starting a little after
 * the one before, each growing outward fast and then slower, and thinning as it grows until it is gone, the picture
 * book's way of fading a ring with nothing see-through in it. Pure, so the picture is tested without drawing it.
 */
import { SPLASH_LASTS } from './lake';

/**
 * How many rings a splash has and how long after one the next starts, in seconds; how far the first reaches at its
 * end and how wide it is at its start, in world units, for a splash of size one; and how much of that each later ring
 * has.
 */
export const RINGS = { count: 3, gap: 0.28, reach: 4.2, width: 0.32, later: 0.8, start: 0.25 } as const;

export interface Ring {
  radius: number;
  width: number;
}

/** The `k`-th ring of a splash of `size`, `age` seconds after it landed; null before it starts and after it ends. */
export function ringAt(age: number, k: number, size = 1): Ring | null {
  const begins = k * RINGS.gap;
  const lasts = SPLASH_LASTS - begins;
  const life = (age - begins) / lasts;
  if (!(life >= 0 && life < 1)) return null;
  const each = RINGS.later ** k * size;
  // out fast and then slower, as a ring on a pond does; thinner the further it has come, nothing at the end
  const out = 1 - (1 - life) ** 2;
  return {
    radius: (RINGS.start + (1 - RINGS.start) * out) * RINGS.reach * each,
    width: RINGS.width * each * (1 - life) ** 1.5,
  };
}
