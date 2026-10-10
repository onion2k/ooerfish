/**
 * The rings as they are drawn: each a circle of short flat pieces lying just on the water, written each frame from
 * the splashes and the time into one group sized once, for every ring of every splash the pool holds. A ring is in
 * pieces so that it can thin as it grows (a scaled ring mesh thickens with its radius) and so that a piece over the
 * bank is simply left out: a ring stops at the shore.
 */
import type { GameGroup } from 'artshape-render/game/renderer';
import { SPLASH_CAPACITY, inside } from './lake';
import { place } from './matrix';
import { box } from './meshes';
import { PALETTE } from './palette';
import { RINGS, ringAt } from './ripples';
import type { Splashes } from './splash';
import { STILL, type Surface } from './water/swell';

/** How many pieces a ring is drawn with, how far each overlaps the next, and how high above the water it lies. */
export const PIECES = 24;
const OVERLAP = 1.15;
const ABOVE = 0.03;
const THIN = 0.02;

export class RippleDraw {
  readonly matrices = new Float32Array(SPLASH_CAPACITY * RINGS.count * PIECES * 16);
  /** Where the water stands, which each piece rides: still water unless the page says the water swells. */
  surface: Surface = STILL;

  /** The group, handed to the renderer once: its placements written by `write`, as many live as it says. */
  group(): GameGroup {
    return { mesh: box(1, 1, 1, true), matrices: this.matrices, count: 0, albedo: PALETTE.ripple, roughness: 0.4 };
  }

  /** Every live ring's pieces over the water at time `t`; says how many are placed. */
  write(splashes: Splashes, t: number): number {
    let n = 0;
    for (let i = 0; i < splashes.count; i++) {
      const age = splashes.age(i, t);
      for (let k = 0; k < RINGS.count; k++) {
        const ring = ringAt(age, k, splashes.size[i]);
        if (!ring) continue;
        const length = ((Math.PI * 2 * ring.radius) / PIECES) * OVERLAP;
        for (let j = 0; j < PIECES; j++) {
          const a = (j / PIECES) * Math.PI * 2;
          const x = splashes.x[i] + Math.cos(a) * ring.radius,
            y = splashes.y[i] + Math.sin(a) * ring.radius;
          if (!inside(x, y)) continue;
          // the piece along the ring, its length round it and its width across it
          place(this.matrices, n++, x, y, this.surface(x, y, t) + ABOVE, a + Math.PI / 2, length, ring.width, THIN);
        }
      }
    }
    return n;
  }
}
