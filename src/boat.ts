/**
 * The boat as sums (`docs/boat.md`, C2): where it is and whether the player is in it, a straight row from one point on
 * the water to another at a steady speed, the check that a row crosses nothing the boat keeps off, and the places the
 * boat gives the angler, the seat the rod is held from and the water beside it a fish is landed on. Pure and made of
 * numbers, so the game, the drawing and the tests ask the same questions of the same state, and nothing here is made
 * each step: the state is one object written into, and every answer that is a point is written into one handed in.
 */
import { BOAT } from './lake';
import type { Lake, Stand } from './lakes/lake';
import { snagGap } from './snags';
import { WATER_LEVEL } from './rules';

/** How far apart the points of a row are looked at, in world units. */
const SAMPLE = 0.5;

/**
 * The boat's state: where its middle is and the way it points (radians round from east), whether the player is aboard
 * and whether it is being rowed, whether its anchor is down (true ashore, and at the end of every row; false only aboard
 * and not rowing, when the boat drifts, `docs/boat.md`, C3), and the row in train: where it began, where it will end and the game time it began.
 * The row's figures mean nothing while it is not rowing.
 */
export interface BoatState {
  x: number;
  y: number;
  heading: number;
  aboard: boolean;
  rowing: boolean;
  anchored: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  rowedAt: number;
}

/** The boat lying at the lake's mooring with nobody aboard; a lake with no boat has one at the middle that nothing ever uses. */
export function newBoat(lake: Lake): BoatState {
  const m = lake.boat?.mooring ?? { x: 0, y: 0, heading: 0 };
  return {
    x: m.x,
    y: m.y,
    heading: m.heading,
    aboard: false,
    rowing: false,
    anchored: true,
    fromX: m.x,
    fromY: m.y,
    toX: m.x,
    toY: m.y,
    rowedAt: 0,
  };
}

/**
 * Whether the boat can be rowed straight from one point to another: every point of the line, every half unit from the
 * start to the end and the end itself, is on the water `BOAT.keepOff` in from the shore, every boulder and the jetty, and
 * that far from every bed of reeds.
 * A line that is not a line of finite numbers is not rowable.
 */
export function rowPath(lake: Lake, fromX: number, fromY: number, toX: number, toY: number): boolean {
  if (![fromX, fromY, toX, toY].every(Number.isFinite)) return false;
  const length = Math.hypot(toX - fromX, toY - fromY);
  const n = Math.max(1, Math.ceil(length / SAMPLE));
  // a bed of reeds is kept off by the keep-off from its edge too (`docs/boat.md`, C4). A boat adrift is stopped by the post
  // at the hull's radius, nearer than that, and must be able to row away: so a start nearer a bed than the keep-off may go
  // no nearer to it than it is, which lets it leave and never go in
  const floor = Math.min(BOAT.keepOff, snagGap(lake, fromX, fromY));
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const x = fromX + (toX - fromX) * u,
      y = fromY + (toY - fromY) * u;
    if (!lake.inside(x, y, BOAT.keepOff) || snagGap(lake, x, y) < floor) return false;
  }
  return true;
}

/** How long a row from one point to another takes, in seconds: the distance at the boat's speed. */
export function rowDuration(from: readonly [number, number], to: readonly [number, number]): number {
  return Math.hypot(to[0] - from[0], to[1] - from[1]) / BOAT.speed;
}

/** Where the boat is at game time `t` on the row it is on, written into `out` as x then y; the start before it began and the end once it is over. */
export function rowAt(state: BoatState, t: number, out: Float64Array | number[]): void {
  const dx = state.toX - state.fromX,
    dy = state.toY - state.fromY;
  const length = Math.hypot(dx, dy);
  const spent = (t - state.rowedAt) * BOAT.speed;
  if (!(length > 0) || spent >= length) {
    out[0] = state.toX;
    out[1] = state.toY;
  } else if (spent <= 0) {
    out[0] = state.fromX;
    out[1] = state.fromY;
  } else {
    out[0] = state.fromX + (dx * spent) / length;
    out[1] = state.fromY + (dy * spent) / length;
  }
}

/** The seat, `BOAT.hull.seat.aft` aft of the boat's middle along its heading, written into `out`. */
export function seatOf(state: BoatState, out: Float64Array | number[] = [0, 0]): Float64Array | number[] {
  out[0] = state.x - Math.cos(state.heading) * BOAT.hull.seat.aft;
  out[1] = state.y - Math.sin(state.heading) * BOAT.hull.seat.aft;
  return out;
}

/**
 * Where the angler is with the player aboard: the seat, the rod's tip held `BOAT.tip.height` over the seat's height and
 * `BOAT.tip.reach` ahead of it, along the boat's heading. Written into `out` if one is handed in.
 */
export function anglerAboard(state: BoatState, out: Stand = { x: 0, y: 0, tipHeight: 0, tipReach: 0 }): Stand {
  seatOf(state, seat);
  out.x = seat[0];
  out.y = seat[1];
  out.tipHeight = BOAT.tip.height;
  out.tipReach = BOAT.tip.reach;
  out.base = WATER_LEVEL + BOAT.hull.seat.up;
  out.heading = state.heading;
  return out;
}

const seat: number[] = [0, 0];

/** Where a fish is landed with the player aboard: `BOAT.landAt` beside the seat, to starboard (the right hand of the way the boat points), on the water. */
export function landingAboard(state: BoatState, out: Float64Array | number[] = [0, 0]): Float64Array | number[] {
  seatOf(state, out);
  out[0] += Math.sin(state.heading) * BOAT.landAt;
  out[1] -= Math.cos(state.heading) * BOAT.landAt;
  return out;
}
