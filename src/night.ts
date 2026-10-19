/**
 * The day's end as sums: when a step carries the clock across midnight, and how far the screen is faded to the night
 * and back. Pure, with the seconds handed in, so the game and the page read the same fade and the tests need neither.
 */

/** Where the player is: out at the pond, yawning at the day's end, or in the cabin after waking. */
export type Place = 'pond' | 'yawning' | 'cabin';

/**
 * Whether a step that took the clock from `before` to `after` carried it across midnight, which is to say wrapped it
 * round from near one to near nought, which is a drop of more than half a day: a clock that ticks back a hair (a frame
 * stamped before the last, the page's first) is no midnight. Only a step is asked: the clock set by hand never comes
 * here, and a time that is not a number is no midnight.
 */
export function pastMidnight(before: number, after: number): boolean {
  return Number.isFinite(before) && Number.isFinite(after) && before - after > 0.5;
}

/**
 * How faded the screen is, from nought (clear) to one (black), `elapsed` seconds into where the player is: at the pond
 * it is clear; yawning, it rises over `fadeOut`; in the cabin it falls from one over `fadeIn`. A time before the start,
 * or not a number, is the start; a fade of no length is over at once.
 */
export function fadeAt(place: Place, elapsed: number, fadeOut: number, fadeIn: number): number {
  const e = elapsed >= 0 ? elapsed : 0;
  if (place === 'yawning') return fadeOut > 0 ? Math.min(1, e / fadeOut) : 1;
  if (place === 'cabin') return fadeIn > 0 ? Math.max(0, 1 - e / fadeIn) : 0;
  return 0;
}
