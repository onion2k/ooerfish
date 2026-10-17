/**
 * How the water catches up with the lake after a cure. The cure lowers the truth at once, and the water the player
 * sees follows it down over a while, so a cure is seen to do something and is not a colour that jumps. These are pure
 * sums; without them the game would have no one place that says what the water looks like a moment into a heal.
 */

/**
 * The water's dirt `elapsed` seconds into a heal of `seconds` from `from` to `target`: eased out as
 * `1 - (1 - u)^3`, which is 0.488 of the way at a fifth of the time, so about half the change is seen early and it
 * then settles. At the end and after it, exactly the target.
 */
export function healToward(from: number, target: number, elapsed: number, seconds: number): number {
  if (!(elapsed < seconds)) return target;
  if (!(elapsed > 0)) return from;
  const u = elapsed / seconds;
  const left = 1 - u;
  const eased = 1 - left * left * left;
  const v = from + (target - from) * eased;
  // the sum cannot go past the target, but rounding could by a bit
  return target < from ? Math.max(target, Math.min(from, v)) : Math.min(target, Math.max(from, v));
}

/** `v` rounded to a whole `step`, within nought and one; nought and one come out exactly. */
export function quantised(v: number, step: number): number {
  if (!(v > 0)) return 0;
  if (!(v < 1)) return 1;
  return Math.min(1, Math.max(0, Math.round(v / step) * step));
}
