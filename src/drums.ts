/**
 * The drums of waste on the pond's bed: where they lie and which have been hauled, as plain sums. Their places are cut
 * from a seed of their own, never the game's chance, so they are the same every run and a drum added or hauled moves
 * nothing else; the water they must lie in is handed in as functions, so this module knows nothing of the lake's
 * content, and `DRUMS` itself is handed in as the spec. The bite asks `snagged` whether a lure lying on the bed is near
 * enough to one, and the game and the page ask which are hauled.
 */
import { seeded } from './random';

/** What decides where the drums lie: the content, handed in. */
export interface DrumSpec {
  count: number;
  seed: number;
  where: {
    /** The least and most distance from `from`, and how far either side of due north (a bearing of a quarter turn) they lie. */
    distance: readonly [number, number];
    bearing: number;
    /** The least and most depth of the bed under a drum, and how far in from the shore and the boulders it keeps. */
    depth: readonly [number, number];
    margin: number;
    /** The least distance between two drums. */
    apart: number;
  };
}

/** The lake as the drums need it, handed in: where is the water, how deep is the bed, and where they are cast from. */
export interface DrumWorld {
  inside(x: number, y: number, margin: number): boolean;
  bedDepth(x: number, y: number): number;
  from: readonly [number, number];
}

/** How many tries a drum is given to find a place before the content is held to be wrong. */
const TRIES = 400;

/**
 * The places of the drums, in order: each drawn from the seed's stream a bearing and a distance from `from`, kept if it
 * is on the bed in the water, deep enough and no deeper, and apart from the ones already placed. Throws when a drum
 * finds no place, since that is the content being wrong and not a thing to play on from.
 */
export function drumPlaces(spec: DrumSpec, world: DrumWorld): [number, number][] {
  const random = seeded(spec.seed);
  const { distance, bearing, depth, margin, apart } = spec.where;
  const places: [number, number][] = [];
  for (let k = 0; k < spec.count; k++) {
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
      places.push([x, y]);
      found = true;
    }
    if (!found) throw new Error(`no place on the bed for drum ${k}`);
  }
  return places;
}

export class Drums {
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** One for each drum hauled up, from the bed for good. */
  readonly hauled: Uint8Array;
  readonly count: number;

  constructor(places: readonly (readonly [number, number])[]) {
    this.count = places.length;
    this.x = new Float64Array(this.count);
    this.y = new Float64Array(this.count);
    this.hauled = new Uint8Array(this.count);
    places.forEach(([x, y], i) => {
      this.x[i] = x;
      this.y[i] = y;
    });
  }

  /** How many are hauled. */
  hauledCount(): number {
    let n = 0;
    for (let i = 0; i < this.count; i++) n += this.hauled[i];
    return n;
  }

  /** The first `n` drums hauled and the rest on the bed: what a load of a save of `n` does; held to the drums there are. */
  load(n: number) {
    this.hauled.fill(0);
    this.hauled.fill(1, 0, Math.max(0, Math.min(n, this.count)));
  }

  /** Drum `i` hauled up. */
  haul(i: number) {
    this.hauled[i] = 1;
  }

  /**
   * The nearest drum still on the bed that a lure at (x, y) is within `reach` of, or minus one for none. A hauled drum is
   * never the answer, however near. Whether the lure lies on the bed is the caller's to say.
   */
  snagged(x: number, y: number, reach: number, skip?: ArrayLike<number>, t = 0): number {
    let found = -1,
      nearest = Infinity;
    for (let i = 0; i < this.count; i++) {
      if (this.hauled[i] || (skip && skip[i] > t)) continue;
      const d = Math.hypot(this.x[i] - x, this.y[i] - y);
      if (d <= reach && d < nearest) [found, nearest] = [i, d];
    }
    return found;
  }
}
