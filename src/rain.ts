/**
 * Where a raindrop lands (`docs/weather.md`, part 3): a point on the water from a hash of the drop's number, one step of
 * the generator `weatherOf` uses and never the game's chance, so the same game rains the same drops whatever the fish
 * did. Pure sums that make nothing, since a drop comes every half second at a pond.
 */
import type { Lake } from './lakes/lake';

/** How far in from the shore a drop lands, as `dropNear` keeps a pebble. */
const MARGIN = 1;
/** How many times a point off the water is pulled toward the middle before the middle itself is taken. */
const PULLS = 12;

/** One step of the generator `seeded` is, from a state, in [0, 1) with the next state. */
function step(s: number): number {
  return (s * 1664525 + 1013904223) >>> 0;
}

/** The point `n`th raindrop lands at on `lake`, written into `out`, always on the water: a point from the hash, pulled toward the middle until it is. */
export function rainSpot(n: number, lake: Lake, out: [number, number]): void {
  let s = (n * 2654435761 + 1) >>> 0;
  s = step(s);
  const angle = (s / 4294967296) * Math.PI * 2;
  s = step(s);
  let r = Math.sqrt(s / 4294967296) * lake.radius;
  for (let k = 0; k < PULLS; k++, r *= 0.8) {
    const x = Math.cos(angle) * r,
      y = Math.sin(angle) * r;
    if (lake.inside(x, y, MARGIN)) {
      out[0] = x;
      out[1] = y;
      return;
    }
  }
  // nowhere along that line is on the water: the middle of the lake always is
  out[0] = 0;
  out[1] = 0;
}
