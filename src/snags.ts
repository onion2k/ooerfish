/**
 * The snags as sums (`docs/boat.md`, C4): which bed of reeds a point is at, how far it is from the nearest edge, where a
 * lure freed from a bed sinks on from, and the beds as the posts the physics keeps a bobber and a boat out of. Pure and
 * over `lake.snags`, so the game, the bite, the boat's row, the invariants and the tests ask the same questions; the
 * answers are numbers or written into a point handed in, and nothing is made each step.
 */
import { SNAG } from './lake';
import type { Lake } from './lakes/lake';

/**
 * A bed as the physics' post (its `Bumper`, which this module does not import, since `physics.ts` is the one door to the
 * package): where it stands, how wide, how high, and how much of a bounce it gives.
 */
export interface Post {
  x: number;
  y: number;
  radius: number;
  top: number;
  restitution: number;
}

/** How far a freed lure's point is moved toward the lake's middle at a time, while it is not yet on the water. */
const INWARD = 0.25;
/** How many such steps it is given, so a point that is somehow never on the water ends the search all the same. */
const INWARD_STEPS = 400;

/** The index of the bed whose edge is nearest a point and within `reach` of it, or minus one for none. */
export function snagNear(lake: Lake, x: number, y: number, reach: number): number {
  let found = -1,
    nearest = reach;
  const { snags } = lake;
  for (let i = 0; i < snags.length; i++) {
    const s = snags[i];
    const gap = Math.hypot(x - s.x, y - s.y) - s.radius;
    if (gap <= nearest) [found, nearest] = [i, gap];
  }
  return found;
}

/** How far a point is from the nearest bed's edge: below nought inside one, and infinite where the lake has none. */
export function snagGap(lake: Lake, x: number, y: number): number {
  let gap = Infinity;
  for (const s of lake.snags) gap = Math.min(gap, Math.hypot(x - s.x, y - s.y) - s.radius);
  return gap;
}

/**
 * Where a lure freed from bed `i` sinks on from, written into `out`: `SNAG.drop` out from the bed's edge along the line
 * from its middle through (x, y), then moved toward the lake's middle in steps until it is on the water by half a unit,
 * for a bed at the shallows' edge. A point at the bed's very middle has no line through it, so it goes the way the
 * lake's middle lies, or east from a bed at the middle itself.
 */
export function freedPoint(lake: Lake, i: number, x: number, y: number, out: number[] | Float64Array): void {
  const s = lake.snags[i];
  let dx = x - s.x,
    dy = y - s.y;
  let d = Math.hypot(dx, dy);
  if (!(d > 1e-9)) {
    dx = -s.x;
    dy = -s.y;
    d = Math.hypot(dx, dy);
    if (!(d > 1e-9)) [dx, dy, d] = [1, 0, 1];
  }
  let px = s.x + (dx / d) * (s.radius + SNAG.drop),
    py = s.y + (dy / d) * (s.radius + SNAG.drop);
  for (let k = 0; k < INWARD_STEPS && !lake.inside(px, py, 0.5); k++) {
    const m = Math.hypot(px, py);
    if (!(m > 1e-9)) break;
    const step = Math.min(INWARD, m);
    px -= (px / m) * step;
    py -= (py / m) * step;
  }
  out[0] = px;
  out[1] = py;
}

const made = new WeakMap<Lake, Post[]>();

/**
 * The beds as the physics' posts: each stands from below everything up to the bed's height and bounces a ball off its side
 * by `SNAG.restitution`. Made once for a lake and shared, since the world only reads them.
 */
export function posts(lake: Lake): Post[] {
  let kept = made.get(lake);
  if (!kept) {
    kept = lake.snags.map((s) => ({
      x: s.x,
      y: s.y,
      radius: s.radius,
      top: s.height,
      restitution: SNAG.restitution,
    }));
    made.set(lake, kept);
  }
  return kept;
}
