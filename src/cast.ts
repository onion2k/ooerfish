/**
 * A cast's flight, as sums: thrown from the rod's tip at an angle round the compass and a power, it flies a plain arc
 * under gravity, with no air to slow it, and lands where its path first meets the water's surface or the bank. Pure,
 * so the preview drawn while aiming is the very flight the lure will fly, the same to the bit, and a test can ask
 * where any cast lands without playing it.
 */
import { ANGLER, CAST, ground, inside } from './lake';

/** Gravity, in world units a second each second: the renderer's own, a tenth of a metre a unit. */
export const GRAVITY = 98.1;
/** How finely the arc is walked to find where it lands, in seconds, and how far that is then halved. */
const WALK = 1 / 240;
const HALVINGS = 30;
/** The longest a cast is ever in the air, in seconds: well past the longest arc at full power. */
const LONGEST = 6;

/** Where the rod's tip is, which every cast is thrown from. */
export function rodTip(): [number, number, number] {
  return [ANGLER.x, ANGLER.y + ANGLER.tipReach, ground(ANGLER.x, ANGLER.y) + ANGLER.tipHeight];
}
const TIP = rodTip();

/** The speed of a cast at full power: what throws it `CAST.reach` across flat water from the tip's height. */
const FULL = (() => {
  const c = Math.cos(CAST.launch),
    s = Math.sin(CAST.launch),
    h = TIP[2];
  const range = (v: number) => ((v * c) / GRAVITY) * (v * s + Math.sqrt((v * s) ** 2 + 2 * GRAVITY * h));
  let lo = 0,
    hi = 1000;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (range(mid) < CAST.reach) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/** Where a cast of `angle` and `power` is at time `t` after it was thrown, written into `out`. */
export function flightAt(angle: number, power: number, t: number, out: Float64Array | number[]): void {
  const v = FULL * Math.sqrt(Math.min(1, Math.max(0, power)));
  const across = v * Math.cos(CAST.launch) * t;
  out[0] = TIP[0] + Math.cos(angle) * across;
  out[1] = TIP[1] + Math.sin(angle) * across;
  out[2] = TIP[2] + v * Math.sin(CAST.launch) * t - 0.5 * GRAVITY * t * t;
}

/** What is under a point: the water's surface over the lake, the bank's ground elsewhere. */
function under(x: number, y: number): number {
  return inside(x, y) ? 0 : ground(x, y);
}

const at = new Float64Array(3);

/** How long a cast is in the air before its path first meets what is under it. */
export function landingTime(angle: number, power: number): number {
  let was = 0;
  for (let t = WALK; t <= LONGEST; t += WALK) {
    flightAt(angle, power, t, at);
    if (at[2] <= under(at[0], at[1])) {
      // between the last step above and this one below, halved until it is exact
      let lo = was,
        hi = t;
      for (let k = 0; k < HALVINGS; k++) {
        const mid = (lo + hi) / 2;
        flightAt(angle, power, mid, at);
        if (at[2] <= under(at[0], at[1])) hi = mid;
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
export function flight(angle: number, power: number): Flight {
  const time = landingTime(angle, power);
  const out = new Float64Array(3);
  flightAt(angle, power, time, out);
  return { landing: [out[0], out[1], out[2]], onWater: inside(out[0], out[1]), time };
}

/**
 * The preview: `n` points along a cast's arc, evenly in time from the tip to where it lands, written into `out`, three
 * floats each; the last is the landing itself. Says whether it lands on the water.
 */
export function pathPoints(angle: number, power: number, n: number, out: Float64Array | Float32Array): boolean {
  const time = landingTime(angle, power);
  for (let k = 0; k < n; k++) {
    flightAt(angle, power, (time * k) / (n - 1), at);
    out[k * 3] = at[0];
    out[k * 3 + 1] = at[1];
    out[k * 3 + 2] = at[2];
  }
  return inside(out[(n - 1) * 3], out[(n - 1) * 3 + 1]);
}
