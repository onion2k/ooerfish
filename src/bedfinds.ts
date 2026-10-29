/**
 * The things on the pond's bed (the drums of waste, and later the treasures): where they lie and which have been found,
 * as plain sums. Each set's places are cut from a seed of its own, never the game's chance, so they are the same every
 * run and a thing added or found moves nothing else; the water they must lie in is handed in as functions, so this
 * module knows nothing of the lake's content, and each set's spec (`DRUMS`) is handed in. The bite asks `snagged`
 * whether a lure lying on the bed is near enough to one, and the game and the page ask which are found.
 */
import { seeded } from './random';

/** What decides where a set lies: the content, handed in. */
export interface BedSpec {
  count: number;
  seed: number;
  where: {
    /** The least and most distance from `from`, and how far either side of due north (a bearing of a quarter turn) they lie. */
    distance: readonly [number, number];
    bearing: number;
    /** The least and most depth of the bed under a thing, and how far in from the shore and the boulders it keeps. */
    depth: readonly [number, number];
    margin: number;
    /** The least distance between two things of the set. */
    apart: number;
  };
  /**
   * A set grown after it was first drawn: the things from index `from` on keep only `apart` from the others (and from
   * the other set's), so the added ones fit where the first are crowded, and none of the first moves.
   */
  later?: { from: number; apart: number };
}

/** The lake as a set on the bed needs it, handed in: where is the water, how deep is the bed, and where they are cast from. */
export interface BedWorld {
  inside(x: number, y: number, margin: number): boolean;
  bedDepth(x: number, y: number): number;
  from: readonly [number, number];
}

/** How many tries a thing is given to find a place before the content is held to be wrong. */
const TRIES = 400;

/** How far thing `k` of a set keeps from the others: the set's `apart`, or the lesser of a later-grown thing. */
export function apartOf(spec: BedSpec, k: number): number {
  return spec.later && k >= spec.later.from ? spec.later.apart : spec.where.apart;
}

/**
 * The places of a set, in order: each drawn from the seed's stream a bearing and a distance from `from`, kept if it
 * is on the bed in the water, deep enough and no deeper, and apart from the ones already placed and from every place
 * in `avoid` (another set's, so two sets never lie on top of each other). Throws when a thing
 * finds no place, since that is the content being wrong and not a thing to play on from.
 */
export function places(
  spec: BedSpec,
  world: BedWorld,
  avoid: readonly (readonly [number, number])[] = [],
): [number, number][] {
  const random = seeded(spec.seed);
  const { distance, bearing, depth, margin } = spec.where;
  const places: [number, number][] = [];
  for (let k = 0; k < spec.count; k++) {
    const apart = apartOf(spec, k);
    let found = false;
    for (let tries = 0; tries < TRIES && !found; tries++) {
      const a = Math.PI / 2 + (random() * 2 - 1) * bearing;
      const r = distance[0] + random() * (distance[1] - distance[0]);
      const x = world.from[0] + Math.cos(a) * r,
        y = world.from[1] + Math.sin(a) * r;
      if (!world.inside(x, y, margin)) continue;
      const bed = world.bedDepth(x, y);
      if (bed < depth[0] || bed > depth[1]) continue;
      if (places.some(([px, py]) => Math.hypot(px - x, py - y) < apart)) continue;
      if (avoid.some(([px, py]) => Math.hypot(px - x, py - y) < apart)) continue;
      places.push([x, y]);
      found = true;
    }
    if (!found) throw new Error(`no place on the bed for thing ${k}`);
  }
  return places;
}

/** A set of things on the bed, with the places they lie at and which of them have been found. */
export class BedFinds {
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** One for each thing found, gone from the bed for good. */
  readonly found: Uint8Array;
  readonly count: number;

  constructor(places: readonly (readonly [number, number])[]) {
    this.count = places.length;
    this.x = new Float64Array(this.count);
    this.y = new Float64Array(this.count);
    this.found = new Uint8Array(this.count);
    places.forEach(([x, y], i) => {
      this.x[i] = x;
      this.y[i] = y;
    });
  }

  /** How many are found. */
  foundCount(): number {
    let n = 0;
    for (let i = 0; i < this.count; i++) n += this.found[i];
    return n;
  }

  /** Exactly the things of these ids found and the rest on the bed: what a load does. An id there is no thing for is ignored. */
  load(ids: Iterable<number>) {
    this.found.fill(0);
    for (const i of ids) if (Number.isInteger(i) && i >= 0 && i < this.count) this.found[i] = 1;
  }

  /** The first `n` found and the rest on the bed, held to the things there are: how the drums load, from a count. */
  loadFirst(n: number) {
    this.found.fill(0);
    this.found.fill(1, 0, Math.max(0, Math.min(n, this.count)));
  }

  /** Thing `i` found, and gone from the bed. */
  find(i: number) {
    this.found[i] = 1;
  }

  /**
   * The nearest thing still on the bed that a lure at (x, y) is within `reach` of, or minus one for none. A found thing
   * is never the answer, however near. Whether the lure lies on the bed is the caller's to say.
   */
  snagged(x: number, y: number, reach: number, skip?: ArrayLike<number>, t = 0): number {
    let found = -1,
      nearest = Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.found[i] || (skip && skip[i] > t)) continue;
      const d = Math.hypot(this.x[i] - x, this.y[i] - y);
      if (d <= reach && d < nearest) [found, nearest] = [i, d];
    }
    return found;
  }
}
