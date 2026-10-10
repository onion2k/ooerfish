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
import { FISH_ABOVE_BED, FISH_CAPACITY, FISH_SHALLOWEST, FISH_SHORE, bedDepth, inside, inward } from './lake';
import type { Random } from './random';

/** How fast a fish swims, the least and the most, in world units a second. */
const SPEED: readonly [number, number] = [1.2, 2.8];
/** How hard a fish's heading wanders, in radians a second at the most. */
const WANDER = 1.6;
/** How far ahead a fish looks for the shore, and how fast it turns from it. */
const LOOK = 5;
const TURN_BACK = 2.5;
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

  /** The lake stocked with `n` fish at places in the water chosen by chance, as many as fit. */
  fill(n: number, random: Random) {
    this.count = Math.min(n, FISH_CAPACITY);
    for (let i = 0; i < this.count; i++) {
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
  }

  /** Every fish on by `dt` seconds. */
  step(dt: number, random: Random) {
    for (let i = 0; i < this.count; i++) {
      let heading = this.heading[i] + (random() * 2 - 1) * WANDER * dt;
      const x = this.x[i],
        y = this.y[i];
      // the shore ahead: turn toward the middle, the harder the nearer it is
      if (!inside(x + Math.cos(heading) * LOOK, y + Math.sin(heading) * LOOK, FISH_SHORE)) {
        const home = Math.atan2(-y, -x);
        const off = Math.atan2(Math.sin(home - heading), Math.cos(home - heading));
        heading += Math.sign(off) * Math.min(Math.abs(off), TURN_BACK * dt);
      }
      const nx = x + Math.cos(heading) * this.speed[i] * dt,
        ny = y + Math.sin(heading) * this.speed[i] * dt;
      // a step toward the shore that would come within half a unit of it is not taken, and the fish turns about: a
      // turn too slow can never beach it. A step inward always is, so a fish that has come that near swims out again
      if (inside(nx, ny, 0.5) || inward(nx, ny) > inward(x, y)) {
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

/** How deep a fish may swim at a point: below the surface and above the bed, the gap halved where it is shallow. */
export function depthRange(x: number, y: number): [number, number] {
  const bed = bedDepth(x, y);
  return [Math.min(FISH_SHALLOWEST, bed * 0.25), Math.max(bed * 0.5, bed - FISH_ABOVE_BED)];
}
