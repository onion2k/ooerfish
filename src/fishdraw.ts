/**
 * The fish as they are drawn: a low-poly body each, glowing in the glow's
 * green with a light of its own (the renderer's `FLOW_GLOW`), placed where the
 * school is, under the water by its depth, its nose the way it swims. Under
 * opaque water they are hidden, and the surface's glow stands for them; under
 * see-through water they are seen, dimmed and tinted by the water over them.
 *
 * One group, its pool sized once at the most a lake holds, written each frame.
 */
import { FLOW_GLOW, packFlow } from 'artshape-render/game/flow';
import { PATTERN_STRIDE, type GameGroup } from 'artshape-render/game/renderer';
import type { School } from './fish';
import { FISH_CAPACITY } from './lake';
import { place } from './matrix';
import { ball } from './meshes';
import { PALETTE } from './palette';

/** A fish's length, width and height, in world units, and how brightly its own light glows. */
export const FISH_BODY = { length: 1.7, width: 0.6, height: 0.55, glow: 1.4 } as const;

export class FishDraw {
  readonly matrices = new Float32Array(FISH_CAPACITY * 16);

  /** The group, handed to the renderer once: its placements written by `write`, as many live as it says. */
  group(): GameGroup {
    const patterns = new Float32Array(FISH_CAPACITY * PATTERN_STRIDE);
    for (let i = 0; i < FISH_CAPACITY; i++)
      packFlow(patterns, i * PATTERN_STRIDE, {
        kind: FLOW_GLOW,
        scale: 0,
        speed: 0,
        glow: FISH_BODY.glow,
        second: PALETTE.glow,
      });
    return { mesh: ball(0.5, 4, 7), matrices: this.matrices, count: 0, albedo: PALETTE.glow, roughness: 0.6, patterns };
  }

  /** Every fish where it is now; says how many are placed. */
  write(fish: School): number {
    const n = Math.min(fish.count, FISH_CAPACITY);
    for (let i = 0; i < n; i++)
      place(
        this.matrices,
        i,
        fish.x[i],
        fish.y[i],
        -fish.depth[i],
        fish.heading[i],
        FISH_BODY.length,
        FISH_BODY.width,
        FISH_BODY.height,
      );
    return n;
  }
}
