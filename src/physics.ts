/**
 * The physics is a package of its own, artshape-physics, which knows nothing of lakes or boats: a body is a ball of some
 * radius, the rock is a grid of tiles, and what leaves the world is reported back. This is the game's side of it, and
 * the one door to it: nothing else in `src/` imports the package, so a change it needs goes in its own repo with a
 * version bump here (`docs/boat.md`, C1).
 *
 * The world's floor is the water's surface, flat, and the shore is its rock: the package refuses the bed as terrain at
 * every tile size, so what floats rests on the surface and the lure hangs under the bobber by the game's own sum.
 */
import { World, type Belt } from 'artshape-physics/world';
import { DRIFT, PHYSICS } from './lake';
import type { Lake } from './lakes/lake';

/** The kinds of body, by index in the world's radii. */
export const KIND = { bobber: 0, boat: 1 } as const;

/** A lake's grid and rock, worked out once. */
interface Layout {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  solid: Uint8Array;
}

const layouts = new WeakMap<Lake, Layout>();
const worlds = new WeakMap<Lake, World>();
const belts = new WeakMap<Lake, Belt[]>();

/**
 * The lake's currents as the package's belts (`docs/boat.md`, C3): each strip's middle, half its length along its
 * heading, its width across, the heading as a unit vector, and its speed. Made once for a lake and shared, since the
 * world only reads them.
 */
export function currentsOf(lake: Lake): Belt[] {
  let kept = belts.get(lake);
  if (!kept) {
    kept = lake.currents.map((c) => ({
      cx: c.x,
      cy: c.y,
      half: c.length / 2,
      width: c.width,
      dx: Math.cos(c.heading),
      dy: Math.sin(c.heading),
      speed: c.speed,
    }));
    belts.set(lake, kept);
  }
  return kept;
}

/**
 * How far from the middle the world's square reaches: the furthest the shore goes from it in the world, and the margin.
 * `shoreRadius` is in the lake's stretched frame, so the world's furthest point is found along each of a ring of rays
 * by halving, against `inShore`, which is the lake's own word for where its shore is.
 */
export function extent(lake: Lake): number {
  let reach = 0;
  for (let i = 0; i < 256; i++) reach = Math.max(reach, lake.shoreRadius((i / 256) * Math.PI * 2));
  const farthest = reach * 4;
  let furthest = 0;
  for (let i = 0; i < 256; i++) {
    const c = Math.cos((i / 256) * Math.PI * 2),
      s = Math.sin((i / 256) * Math.PI * 2);
    let near = 0,
      far = farthest;
    for (let k = 0; k < 40; k++) {
      const mid = (near + far) / 2;
      if (lake.inShore(c * mid, s * mid)) near = mid;
      else far = mid;
    }
    furthest = Math.max(furthest, near);
  }
  return furthest + PHYSICS.margin;
}

/**
 * The grid and the rock of a lake: a square about its middle, a tile rock when its middle is outside the shore by more
 * than a tile's half-diagonal. `inside` with a negative margin is the waterline pushed out by that much, so a tile whose
 * middle is within the half-diagonal outside the shore is still water, and a thing anywhere on the water is never in rock.
 */
function layoutOf(lake: Lake): Layout {
  let kept = layouts.get(lake);
  if (kept) return kept;
  const { tile } = PHYSICS;
  const cols = Math.ceil((2 * extent(lake)) / tile);
  const origin = -(cols * tile) / 2;
  const solid = new Uint8Array(cols * cols);
  const out = -tile * Math.SQRT1_2;
  for (let r = 0; r < cols; r++)
    for (let c = 0; c < cols; c++)
      solid[r * cols + c] = lake.inside(origin + (c + 0.5) * tile, origin + (r + 0.5) * tile, out) ? 0 : 1;
  kept = { cols, rows: cols, originX: origin, originY: origin, solid };
  layouts.set(lake, kept);
  return kept;
}

/**
 * A world of the lake made new, on its shared grid and rock. A game takes one of its own, since a world holds bodies and
 * two games must not share them; the rock is only read, so it is shared. Chance is a constant: a body's tilt is drawn
 * on spawning and nothing here reads it, and the game's chance is never spent on it.
 */
export function newWorld(lake: Lake): World {
  const { cols, rows, originX, originY, solid } = layoutOf(lake);
  // the tuning's `sleepDrift` is lowered so a slow drift is not taken for rest (see `DRIFT`)
  const world = new World({
    capacity: PHYSICS.capacity,
    grid: { cols, rows, originX, originY, tile: PHYSICS.tile },
    solid,
    bottom: PHYSICS.bottom,
    radii: [PHYSICS.radii.bobber, PHYSICS.radii.boat],
    random: () => 0.5,
    tuning: { sleepDrift: DRIFT.sleepDrift },
  });
  world.belts = currentsOf(lake);
  return world;
}

/** The lake's world, made the first time it is asked for and kept for that lake. */
export function worldFor(lake: Lake): World {
  let kept = worlds.get(lake);
  if (!kept) worlds.set(lake, (kept = newWorld(lake)));
  return kept;
}

/**
 * The game's bodies in a world: the bobber's, spawned carried at the angler's landing so the game places it, and the
 * boat's (a lake that keeps one), carried at the boat's place while it is rowed or anchored, the game putting it where
 * it rows, and let go to drift when the anchor is weighed (`docs/boat.md`, C3).
 */
export class Bodies {
  /** The bobber's slot in the world. */
  readonly bobber: number;
  /** The boat's slot, or minus one in a lake with no boat. */
  readonly boat: number;

  constructor(
    readonly world: World,
    lake: Lake,
    landing: readonly [number, number] = lake.landAt,
    boatAt: readonly [number, number] | null = lake.boat ? [lake.boat.mooring.x, lake.boat.mooring.y] : null,
  ) {
    this.bobber = world.spawn(KIND.bobber, landing[0], landing[1], PHYSICS.radii.bobber);
    if (this.bobber < 0) throw new Error('the physics world has no room for the bobber');
    world.carried[this.bobber] = 1;
    this.boat = boatAt ? world.spawn(KIND.boat, boatAt[0], boatAt[1], PHYSICS.radii.boat) : -1;
    if (boatAt && this.boat < 0) throw new Error('the physics world has no room for the boat');
    if (this.boat >= 0) world.carried[this.boat] = 1;
  }

  get x(): number {
    return this.world.x[this.bobber];
  }

  get y(): number {
    return this.world.y[this.bobber];
  }

  /** Whether the game holds it. */
  get held(): boolean {
    return this.world.carried[this.bobber] === 1;
  }

  get asleep(): boolean {
    return this.world.asleep[this.bobber] === 1;
  }

  /** Put where the game likes, while it is carried. */
  put(x: number, y: number) {
    const w = this.world,
      i = this.bobber;
    w.x[i] = x;
    w.y[i] = y;
    w.z[i] = PHYSICS.radii.bobber;
  }

  /** The boat's body put where the game rows it, while it is carried; nothing in a lake with no boat. */
  putBoat(x: number, y: number) {
    if (this.boat < 0) return;
    const w = this.world,
      i = this.boat;
    w.x[i] = x;
    w.y[i] = y;
    w.z[i] = PHYSICS.radii.boat;
  }

  /** The boat's body's place, or nought in a lake with none. */
  get boatX(): number {
    return this.boat < 0 ? 0 : this.world.x[this.boat];
  }

  get boatY(): number {
    return this.boat < 0 ? 0 : this.world.y[this.boat];
  }

  /** Whether the game holds the boat's body (it does, rowed or anchored; not adrift); true in a lake with none. */
  get boatHeld(): boolean {
    return this.boat < 0 || this.world.carried[this.boat] === 1;
  }

  /** Let go at (x, y), at rest on the surface: woken, so the world looks at it from there. */
  drop(x: number, y: number) {
    const w = this.world,
      i = this.bobber;
    this.put(x, y);
    w.vx[i] = w.vy[i] = w.vz[i] = 0;
    w.carried[i] = 0;
    w.wake(i);
  }

  /** Carried again: woken first, since a sleeper taken up is one the world never knew moved. */
  take() {
    this.world.wake(this.bobber);
    this.world.carried[this.bobber] = 1;
  }

  /** The boat's body let go where it is, at rest and woken, so it drifts: the anchor weighed. Nothing in a lake with no boat. */
  letGoBoat() {
    if (this.boat < 0) return;
    const w = this.world,
      i = this.boat;
    w.vx[i] = w.vy[i] = w.vz[i] = 0;
    w.carried[i] = 0;
    w.wake(i);
  }

  /** The boat's body carried again, still: the anchor dropped, or a row begun. Woken first, as `take` does. */
  holdBoat() {
    if (this.boat < 0) return;
    const w = this.world,
      i = this.boat;
    w.wake(i);
    w.vx[i] = w.vy[i] = w.vz[i] = 0;
    w.carried[i] = 1;
  }

  /** The bobber put back at (x, y) and stopped, still free: where the game's keep-off holds it. */
  still(x: number, y: number) {
    this.stillBody(this.bobber, x, y, PHYSICS.radii.bobber);
  }

  /** The boat's body put back at (x, y) and stopped, still free. */
  stillBoat(x: number, y: number) {
    if (this.boat >= 0) this.stillBody(this.boat, x, y, PHYSICS.radii.boat);
  }

  private stillBody(i: number, x: number, y: number, z: number) {
    const w = this.world;
    w.x[i] = x;
    w.y[i] = y;
    w.z[i] = z;
    w.vx[i] = w.vy[i] = w.vz[i] = 0;
    w.wake(i);
  }

  /**
   * The wind's push of (ax, ay) world units a second each second on the bodies of one kind for `dt`, as a hit: a free
   * body is given the speed, a carried one is left be, so it is only ever felt where something floats loose.
   */
  blow(kind: number, ax: number, ay: number, dt: number) {
    const i = kind === KIND.bobber ? this.bobber : this.boat;
    if (i >= 0) this.world.hit(i, ax * dt, ay * dt, 0);
  }

  /**
   * The world on by `dt`; nothing should ever leave it, and one that does is a bug the invariants and the fuzzer must see.
   * With every body carried there is nothing for the world to move, and it is not stepped: a lure on the rod costs the
   * idle game nothing, as the ready rope costs it nothing.
   */
  step(dt: number) {
    if (this.world.carried[this.bobber] && this.boatHeld) return;
    this.world.step(dt, (kind, x, y, slot, hole) => {
      throw new Error(`a body of kind ${kind} left the physics world at ${x},${y} (slot ${slot}, hole ${hole})`);
    });
  }
}
