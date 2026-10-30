/**
 * A cast's flight, as sums: thrown from the rod's tip at an angle round the compass and a power, it flies a plain arc
 * under gravity, with no air to slow it, and lands where its path first meets the water's surface or the bank. Pure,
 * so the preview drawn while aiming is the very flight the lure will fly, the same to the bit, and a test can ask
 * where any cast lands without playing it.
 */
import { CAST } from './lake';
import type { Lake, Stand } from './lakes/lake';
import { HOME } from './lakes';

/** Gravity, in world units a second each second: the renderer's own, a tenth of a metre a unit. */
export const GRAVITY = 98.1;
/** How finely the arc is walked to find where it lands, in seconds, and how far that is then halved. */
const WALK = 1 / 240;
const HALVINGS = 30;
/** The longest a cast is ever in the air, in seconds: well past the longest arc at full power. */
const LONGEST = 6;

/**
 * Where the rod's tip is for an angler standing at `at` (the lake's own angler on the shore unless told, the boat's seat
 * aboard), which every cast is thrown from. The tip is held `tipHeight` over `at.base`, or over the ground there when it
 * has none, and `tipReach` out in front: due north unless the stand has a heading, which keeps the shore's sums as they were.
 */
export function rodTip(lake: Lake = HOME, at: Stand = lake.angler): [number, number, number] {
  return rodTipInto(lake, at, [0, 0, 0]);
}

/** `rodTip` written into `out`, for the flight, which asks every step and makes nothing. */
function rodTipInto<T extends number[] | Float64Array>(lake: Lake, at: Stand, out: T): T {
  const reach = at.tipReach;
  if (at.heading === undefined) {
    out[0] = at.x;
    out[1] = at.y + reach;
  } else {
    out[0] = at.x + Math.cos(at.heading) * reach;
    out[1] = at.y + Math.sin(at.heading) * reach;
  }
  out[2] = (at.base ?? lake.ground(at.x, at.y)) + at.tipHeight;
  return out;
}

/** How far the rod's tip is drawn down, and toward the fish, at the tightest line. */
export const BEND = { down: 2.4, toward: 1.2 } as const;

/**
 * Where the rod's tip is with the line at `tension` (nought to one) and the fish at `toward`: drawn down and toward it,
 * written into `out`, which is the very tip when the line is slack.
 */
export function bentTip(
  lake: Lake,
  tension: number,
  toward: ArrayLike<number>,
  out: Float64Array | number[] = [0, 0, 0],
  at: Stand = lake.angler,
): Float64Array | number[] {
  const t0 = rodTip(lake, at);
  const dx = toward[0] - t0[0],
    dy = toward[1] - t0[1];
  const flat = Math.hypot(dx, dy) || 1;
  out[0] = t0[0] + (dx / flat) * BEND.toward * tension;
  out[1] = t0[1] + (dy / flat) * BEND.toward * tension;
  out[2] = t0[2] - BEND.down * tension;
  return out;
}

/**
 * What a lake's casts are thrown from and at: the shore's rod tip and the speed of a cast at full power from it, worked
 * out once for each lake; and the speed at full power from any other tip height (the boat's), kept by that height, since
 * a lower tip throws a little less far for the same speed and `castReach` is the reach at full power from wherever.
 */
interface Throw {
  tip: [number, number, number];
  full: number;
  others: Map<number, number>;
}
const THROWS = new WeakMap<Lake, Throw>();

/** The speed of a cast at full power: what throws it the lake's `castReach` across flat water from the tip's height. */
function fullSpeed(h: number, reach: number): number {
  const c = Math.cos(CAST.launch),
    s = Math.sin(CAST.launch);
  const range = (v: number) => ((v * c) / GRAVITY) * (v * s + Math.sqrt((v * s) ** 2 + 2 * GRAVITY * h));
  let lo = 0,
    hi = 1000;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (range(mid) < reach) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The lake's throw, made the first time it is asked for and kept: the same lake is always thrown the same. */
function throwOf(lake: Lake): Throw {
  let made = THROWS.get(lake);
  if (!made) {
    const tip = rodTip(lake);
    made = { tip, full: fullSpeed(tip[2], lake.castReach), others: new Map() };
    THROWS.set(lake, made);
  }
  return made;
}

/** The tip a cast from somewhere other than the shore's angler is thrown from, written into every flight and never kept. */
const otherTip: [number, number, number] = [0, 0, 0];
const other = { tip: otherTip, full: 0 };

/** The most tip heights kept besides the shore's: a boat has one, so this is only a ceiling against a caller that makes many. */
const OTHERS_MOST = 8;

/**
 * Where a cast from `at` is thrown from and how fast at full power: the lake's memo for its own angler, to the bit, and
 * for any other stand the tip worked out into a scratch and the speed kept by the tip's height.
 */
function throwFrom(lake: Lake, at: Stand): { tip: readonly [number, number, number]; full: number } {
  const made = throwOf(lake);
  if (at === lake.angler) return made;
  rodTipInto(lake, at, otherTip);
  let full = made.others.get(otherTip[2]);
  if (full === undefined) {
    if (made.others.size >= OTHERS_MOST) made.others.clear();
    full = fullSpeed(otherTip[2], lake.castReach);
    made.others.set(otherTip[2], full);
  }
  other.full = full;
  return other;
}

/** No wind, which every cast without one is thrown in. */
export const NO_WIND: readonly [number, number] = Object.freeze([0, 0]);

/**
 * Where a cast of `angle` and `power` is at time `t` after it was thrown, written into `out`. The wind is a push, a
 * constant acceleration across the flight in world units a second each second, so the arc bends downwind; none gives
 * the plain arc to the bit.
 */
export function flightAt(
  angle: number,
  power: number,
  t: number,
  out: Float64Array | number[],
  lake: Lake = HOME,
  wind: readonly [number, number] = NO_WIND,
  stand: Stand = lake.angler,
): void {
  const { tip: TIP, full } = throwFrom(lake, stand);
  const v = full * Math.sqrt(Math.min(1, Math.max(0, power)));
  const across = v * Math.cos(CAST.launch) * t;
  out[0] = TIP[0] + Math.cos(angle) * across + (wind[0] * t * t) / 2;
  out[1] = TIP[1] + Math.sin(angle) * across + (wind[1] * t * t) / 2;
  out[2] = TIP[2] + v * Math.sin(CAST.launch) * t - 0.5 * GRAVITY * t * t;
}

/** What is under a point: the water's surface over the lake, the bank's ground elsewhere. */
function under(lake: Lake, x: number, y: number): number {
  return lake.inside(x, y) ? 0 : lake.ground(x, y);
}

const at = new Float64Array(3);

/** How long a cast is in the air before its path first meets what is under it. */
export function landingTime(
  angle: number,
  power: number,
  lake: Lake = HOME,
  wind: readonly [number, number] = NO_WIND,
  stand: Stand = lake.angler,
): number {
  let was = 0;
  for (let t = WALK; t <= LONGEST; t += WALK) {
    flightAt(angle, power, t, at, lake, wind, stand);
    if (at[2] <= under(lake, at[0], at[1])) {
      // between the last step above and this one below, halved until it is exact
      let lo = was,
        hi = t;
      for (let k = 0; k < HALVINGS; k++) {
        const mid = (lo + hi) / 2;
        flightAt(angle, power, mid, at, lake, wind, stand);
        if (at[2] <= under(lake, at[0], at[1])) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    was = t;
  }
  return LONGEST;
}

export interface Flight {
  /** Where it lands. */
  landing: [number, number, number];
  /** Whether that is on the water. */
  onWater: boolean;
  /** How long it is in the air, in seconds. */
  time: number;
}

/** Where a cast of `angle` and `power` lands, whether on the water, and when. */
export function flight(
  angle: number,
  power: number,
  lake: Lake = HOME,
  wind: readonly [number, number] = NO_WIND,
  stand: Stand = lake.angler,
): Flight {
  const time = landingTime(angle, power, lake, wind, stand);
  const out = new Float64Array(3);
  flightAt(angle, power, time, out, lake, wind, stand);
  return { landing: [out[0], out[1], out[2]], onWater: lake.inside(out[0], out[1]), time };
}

/**
 * The preview: `n` points along a cast's arc, evenly in time from the tip to where it lands, written into `out`, three
 * floats each; the last is the landing itself. Says whether it lands on the water.
 */
export function pathPoints(
  angle: number,
  power: number,
  n: number,
  out: Float64Array | Float32Array,
  lake: Lake = HOME,
  wind: readonly [number, number] = NO_WIND,
  stand: Stand = lake.angler,
): boolean {
  const time = landingTime(angle, power, lake, wind, stand);
  for (let k = 0; k < n; k++) {
    // the last point is the landing's own time and not a share of it, which a multiply and divide may miss by a bit
    flightAt(angle, power, k === n - 1 ? time : (time * k) / (n - 1), at, lake, wind, stand);
    out[k * 3] = at[0];
    out[k * 3 + 1] = at[1];
    out[k * 3 + 2] = at[2];
  }
  return lake.inside(out[(n - 1) * 3], out[(n - 1) * 3 + 1]);
}

/** How the aim is walked toward a target in a wind: rounds of moving the aim point by the error, and the error that ends them. */
const AIM_ROUNDS = 12;
const AIM_CLOSE = 1e-4;

/**
 * The cast that lands at (x, y), over flat water: aimed at it from the rod's tip, its power found by halving between
 * none and full until the flight is as far from the tip as the point is. A point past the reach gets full power. For
 * the test API and the tests, which put a lure where they want it. In a wind the flight is bent off its line, so the
 * aim point is moved by how far the last cast missed, a handful of rounds, until it lands on the target; with none the
 * first aim is the answer, to the bit.
 */
export function aimAt(
  x: number,
  y: number,
  lake: Lake = HOME,
  wind: readonly [number, number] = NO_WIND,
  stand: Stand = lake.angler,
): { angle: number; power: number } {
  let aim = aimStraight(x, y, lake, wind, stand);
  if (wind[0] === 0 && wind[1] === 0) return aim;
  let px = x,
    py = y;
  for (let round = 0; round < AIM_ROUNDS; round++) {
    const f = flight(aim.angle, aim.power, lake, wind, stand);
    const ex = x - f.landing[0],
      ey = y - f.landing[1];
    if (Math.hypot(ex, ey) < AIM_CLOSE) break;
    px += ex;
    py += ey;
    aim = aimStraight(px, py, lake, wind, stand);
  }
  return aim;
}

/** The cast whose flight, bent by the wind, ends as far from the tip as the point does and along the line to it. */
function aimStraight(
  x: number,
  y: number,
  lake: Lake,
  wind: readonly [number, number],
  stand: Stand,
): { angle: number; power: number } {
  // copied out of the scratch the flights below write the tip into
  const tip = throwFrom(lake, stand).tip;
  const TIP: readonly [number, number, number] = [tip[0], tip[1], tip[2]];
  const dx = x - TIP[0],
    dy = y - TIP[1];
  const angle = Math.atan2(dy, dx),
    want = Math.hypot(dx, dy);
  let lo = 0,
    hi = 1;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    const f = flight(angle, mid, lake, wind, stand);
    if (Math.hypot(f.landing[0] - TIP[0], f.landing[1] - TIP[1]) < want) lo = mid;
    else hi = mid;
  }
  return { angle, power: (lo + hi) / 2 };
}
