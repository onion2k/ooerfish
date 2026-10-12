/**
 * The fish of a lake, a school of them in fixed arrays: where each is, how
 * deep, which way it is heading and how fast. Each wanders by the seeded
 * chance it is handed, turns back from the shore before it reaches it, and
 * keeps between the surface and the bed. No more than they are here: the
 * bite, the lure and fleeing are the fishing's, and come with it.
 *
 * Sized once, at the most a lake can hold, so nothing is made while it
 * swims, and a lake with more fish than that is told so by `fill`.
 */
import {
  FISH_ABOVE_BED,
  FISH_CAPACITY,
  FISH_SHALLOWEST,
  FISH_SHORE,
  bedDepth,
  boulderGap,
  inShore,
  inside,
  inward,
  jettyGap,
  nearestBoulder,
  nearestOnDeck,
} from './lake';
import type { Random } from './random';

/** How fast a fish swims, the least and the most, in world units a second. */
const SPEED: readonly [number, number] = [1.2, 2.8];
/** How hard a fish's heading wanders, in radians a second at the most. */
const WANDER = 1.6;
/** How far ahead a fish looks for the shore, and how fast it turns from it. */
const LOOK = 5;
const TURN_BACK = 2.5;
/** How near a boulder a fish's look ahead may come before it turns away from it, in world units from its waterline. */
const BOULDER_LOOK = 1.5;
/** And the same from the jetty's deck, whose edge a fish turns from as from a boulder's waterline. */
const JETTY_LOOK = 1.5;
/** How fast a fish eases to the depth it is after, a share of the gap a second. */
const SINK = 0.4;

export class School {
  readonly x = new Float64Array(FISH_CAPACITY);
  readonly y = new Float64Array(FISH_CAPACITY);
  /** How far under the surface. */
  readonly depth = new Float64Array(FISH_CAPACITY);
  readonly heading = new Float64Array(FISH_CAPACITY);
  readonly speed = new Float64Array(FISH_CAPACITY);
  /** The depth each is easing toward, as a share of the water under it, so a fish keeps to a depth of its own. */
  readonly keeps = new Float64Array(FISH_CAPACITY);
  count = 0;
  /** The fish the bite is steering, which the wander leaves alone; minus one for none. */
  held = -1;

  /** The lake stocked with `n` fish at places in the water chosen by chance, as many as fit. */
  fill(n: number, random: Random) {
    this.count = Math.min(n, FISH_CAPACITY);
    for (let i = 0; i < this.count; i++) this.place(i, random);
  }

  /** Fish `i` let into the lake afresh, somewhere in it by chance: a landed fish's place taken by another. */
  respawn(i: number, random: Random) {
    if (this.held === i) this.held = -1;
    this.place(i, random);
  }

  private place(i: number, random: Random) {
    let x = 0,
      y = 0;
    // a point well in from the shore; a hundred tries is far more than the pond's shape needs
    for (let tries = 0; tries < 100; tries++) {
      x = (random() * 2 - 1) * 40;
      y = (random() * 2 - 1) * 30;
      if (inside(x, y, FISH_SHORE + 2)) break;
      x = y = 0;
    }
    this.x[i] = x;
    this.y[i] = y;
    this.heading[i] = random() * Math.PI * 2;
    this.speed[i] = SPEED[0] + random() * (SPEED[1] - SPEED[0]);
    this.keeps[i] = 0.2 + random() * 0.5;
    this.depth[i] = depthRange(x, y)[1] * this.keeps[i];
  }

  /** Every fish on by `dt` seconds. */
  step(dt: number, random: Random) {
    for (let i = 0; i < this.count; i++) {
      if (i === this.held) continue;
      let heading = this.heading[i] + (random() * 2 - 1) * WANDER * dt;
      const x = this.x[i],
        y = this.y[i];
      // the shore ahead: turn toward the middle, the harder the nearer it is; a boulder ahead: turn away from its middle
      const ax = x + Math.cos(heading) * LOOK,
        ay = y + Math.sin(heading) * LOOK;
      let away = Number.NaN;
      if (!inShore(ax, ay, FISH_SHORE)) away = Math.atan2(-y, -x);
      else if (boulderGap(ax, ay) < BOULDER_LOOK) {
        const b = nearestBoulder(ax, ay);
        away = Math.atan2(y - b.y, x - b.x);
      } else if (jettyGap(ax, ay) < JETTY_LOOK) {
        // from the nearest point of the deck, so a fish at its end turns off along it and one at its side turns off across
        const [dx, dy] = nearestOnDeck(ax, ay);
        away = Math.atan2(y - dy, x - dx);
      }
      if (!Number.isNaN(away)) {
        const off = Math.atan2(Math.sin(away - heading), Math.cos(away - heading));
        heading += Math.sign(off) * Math.min(Math.abs(off), TURN_BACK * dt);
      }
      const nx = x + Math.cos(heading) * this.speed[i] * dt,
        ny = y + Math.sin(heading) * this.speed[i] * dt;
      // a step that would come within half a unit of the shore or a boulder is not taken, and the fish turns about: a
      // turn too slow can never beach it. A step away from whichever it is near is, so long as it comes no nearer the
      // other, so a fish that has come that near swims out again
      if (inside(nx, ny, 0.5) || awayFromLand(x, y, nx, ny)) {
        this.x[i] = nx;
        this.y[i] = ny;
      } else heading += Math.PI;
      this.heading[i] = Math.atan2(Math.sin(heading), Math.cos(heading));
      const [lo, hi] = depthRange(this.x[i], this.y[i]);
      const want = Math.min(hi, Math.max(lo, hi * this.keeps[i]));
      const depth = this.depth[i] + (want - this.depth[i]) * Math.min(1, SINK * dt);
      // the bed rises under a fish swimming in toward the shore, faster than it eases up: it is kept off it
      this.depth[i] = Math.min(hi, Math.max(lo, depth));
    }
  }
}

/** How fast a fish turns toward where it is steered, in radians a second. */
const TURN_TO = 4;

/**
 * Fish `i` of the school swum toward (`tx`, `ty`) and eased toward `depth`, at `speed`, by the same rules that keep
 * every fish in the water and off the boulders: a step that would beach it is not taken, and it turns about. Says how
 * far it is from the point, in plan, after the step.
 */
export function steerTo(
  school: School,
  i: number,
  tx: number,
  ty: number,
  depth: number,
  speed: number,
  dt: number,
): number {
  const x = school.x[i],
    y = school.y[i];
  const want = Math.atan2(ty - y, tx - x);
  let heading = school.heading[i];
  const off = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
  heading += Math.sign(off) * Math.min(Math.abs(off), TURN_TO * dt);
  // no further than the point, so it stops there and does not swim round it
  const step = Math.min(speed * dt, Math.hypot(tx - x, ty - y));
  const nx = x + Math.cos(heading) * step,
    ny = y + Math.sin(heading) * step;
  if (inside(nx, ny, 0.5) || awayFromLand(x, y, nx, ny)) {
    school.x[i] = nx;
    school.y[i] = ny;
  } else heading += Math.PI;
  school.heading[i] = Math.atan2(Math.sin(heading), Math.cos(heading));
  const [lo, hi] = depthRange(school.x[i], school.y[i]);
  const eased = school.depth[i] + (depth - school.depth[i]) * Math.min(1, SINK * 4 * dt);
  school.depth[i] = Math.min(hi, Math.max(lo, eased));
  return Math.hypot(tx - school.x[i], ty - school.y[i]);
}

/**
 * Whether a step from (`x`, `y`) to (`nx`, `ny`), which comes within half a unit of the shore, a boulder or the deck, is still in
 * the water and goes away from whichever it is near without coming nearer the other. Only asked when the plain test
 * fails, which is seldom, so a step in open water pays for none of it.
 */
function awayFromLand(x: number, y: number, nx: number, ny: number): boolean {
  if (!inside(nx, ny)) return false;
  const gap = boulderGap(nx, ny);
  const offBoulder = gap > 0.5 || gap > boulderGap(x, y);
  const jetty = jettyGap(nx, ny);
  const offJetty = jetty > 0.5 || jetty > jettyGap(x, y);
  return offBoulder && offJetty && (inShore(nx, ny, 0.5) || inward(nx, ny) > inward(x, y));
}

/** How deep a fish may swim at a point: below the surface and above the bed, the gap halved where it is shallow. */
export function depthRange(x: number, y: number): [number, number] {
  const bed = bedDepth(x, y);
  return [Math.min(FISH_SHALLOWEST, bed * 0.25), Math.max(bed * 0.5, bed - FISH_ABOVE_BED)];
}
