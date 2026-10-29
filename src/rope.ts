/**
 * The fishing line as a rope: a chain of points pinned at the rod's tip and at whatever is on the line's end, hung
 * under gravity and pulled to its length, which is the chord plus slack by the fight's tension, so a slack line sags and
 * a strained one runs straight. It is the design's rope worked in the game, not the physics' (`docs/boat.md`), so it is
 * deterministic, stepped with the game, and held by tests of its own; a rope in the physics is a package change, and
 * only if this one does not feel right. Pure of game state: it takes the ends, the length and the floor it keeps off as
 * arguments, and makes nothing in a step.
 */
import { ROPE } from './lake';

export class Rope {
  /** Every point's x, y and z in turn, the first the rod's end and the last the line's. */
  readonly points = new Float64Array(ROPE.points * 3);
  /** Where each point was a step ago, which is its velocity. */
  private readonly prev = new Float64Array(ROPE.points * 3);

  /** The points laid straight from `a` to `b`, at rest. */
  reset(a: ArrayLike<number>, b: ArrayLike<number>) {
    const n = ROPE.points;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      for (let k = 0; k < 3; k++) this.points[i * 3 + k] = this.prev[i * 3 + k] = a[k] + (b[k] - a[k]) * s;
    }
  }

  /**
   * One step of `dt` seconds with the ends at `a` and `b` and the rope `length` long. `keepOut` says the lowest a
   * point may be at an x and y (the ground off the water, the bed on it, a little over), given where it is now so a
   * point plainly clear of the floor is answered cheaply.
   */
  step(
    dt: number,
    a: ArrayLike<number>,
    b: ArrayLike<number>,
    length: number,
    keepOut: (x: number, y: number, z: number) => number,
  ) {
    const n = ROPE.points,
      last = (n - 1) * 3,
      p = this.points,
      q = this.prev;
    // an end that has jumped (a slip, a reel-in, a landing) would whip the rope across the lake: lay it straight instead
    const reach = ROPE.whip * length;
    if (
      Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]) > reach ||
      Math.hypot(b[0] - p[last], b[1] - p[last + 1], b[2] - p[last + 2]) > reach
    )
      this.reset(a, b);

    // gravity is felt as the line is slack: a line with its length to spare hangs, and one drawn tight is held straight
    // by its tension, which a few relaxations of a rope exactly as long as its chord could not do against gravity
    const chord = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const slack = chord > 0 ? length / chord - 1 : 1;
    const fall = ROPE.gravity * dt * dt * Math.min(1, Math.max(0, slack / ROPE.slack));
    for (let i = 3; i < last; i += 3) {
      for (let k = 0; k < 3; k++) {
        const here = p[i + k];
        p[i + k] = here + (here - q[i + k]) * ROPE.damping - (k === 2 ? fall : 0);
        q[i + k] = here;
      }
    }
    for (let k = 0; k < 3; k++) {
      p[k] = q[k] = a[k];
      p[last + k] = q[last + k] = b[k];
    }

    const rest = length / (n - 1);
    // each pass sweeps the chain one way and then back, so a correction travels both ways down it and a strained
    // rope comes straight in few passes
    for (let pass = 0; pass < ROPE.iterations; pass++) {
      for (let s = 0; s < 2 * (n - 1); s++) {
        const i = s < n - 1 ? s : 2 * (n - 1) - 1 - s;
        const u = i * 3,
          v = u + 3;
        const dx = p[v] - p[u],
          dy = p[v + 1] - p[u + 1],
          dz = p[v + 2] - p[u + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const pull = (d - rest) / d;
        // an end is pinned, so the whole of the correction at the segment that holds it is the other point's
        const wu = i === 0 ? 0 : i === n - 2 ? 1 : 0.5;
        const wv = 1 - wu;
        p[u] += dx * pull * wu;
        p[u + 1] += dy * pull * wu;
        p[u + 2] += dz * pull * wu;
        p[v] -= dx * pull * wv;
        p[v + 1] -= dy * pull * wv;
        p[v + 2] -= dz * pull * wv;
      }
      for (let k = 0; k < 3; k++) {
        p[k] = a[k];
        p[last + k] = b[k];
      }
    }

    for (let i = 3; i < last; i += 3) {
      const floor = keepOut(p[i], p[i + 1], p[i + 2]);
      if (p[i + 2] < floor) p[i + 2] = floor;
    }
  }
}
